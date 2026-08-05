/**
 * Literature-backed limb checks and scoring.
 *
 * Ported from a collaborator's independent pipeline
 * (AdanNazir/golf-swing-analysis). Two things make this better than a
 * hand-tuned rubric and are the reason it was adopted:
 *
 *  1. EVERY BAND CITES ITS SOURCE, and the citation is surfaced to the
 *     golfer. They can always see *why* something was judged, not just
 *     that it was. A number with no citation behind it is never scored —
 *     it is shown informationally and excluded from the score entirely,
 *     rather than quietly inventing a threshold.
 *
 *  2. BANDS ARE DELIBERATELY WIDER THAN THE RAW LITERATURE FIGURE. These
 *     angles come from a single phone camera via monocular pose, not a
 *     motion-capture lab, so the measurement itself carries several degrees
 *     of error. Scoring against a lab-tight band with a phone-camera
 *     measurement manufactures false faults.
 *
 * A cautionary note carried over from that work, worth preserving: an
 * earlier version sourced four joint-angle bands from a third-party
 * academic dataset (CaddieSet) on the assumption that a 3-point joint
 * angle is geometrically unambiguous. Tested against a textbook Tour
 * top-of-backswing, that produced a "severe fault" on technique that is
 * unambiguously good — the convention did not match. It was removed
 * rather than patched. Bands here come from published literature or from
 * the golfer's own address frame, nothing else.
 */

export type LimbKind = "arm" | "leg";
export type LimbRole = "trail" | "lead";
export type SwingEventName =
  | "address"
  | "toe_up"
  | "mid_backswing"
  | "top"
  | "mid_downswing"
  | "impact"
  | "mid_follow_through"
  | "finish";

export type LimbMeasurement = {
  limb: LimbKind;
  side: "left" | "right";
  role: LimbRole | null;
  event: SwingEventName;
  frame: number;
  valueDeg: number;
  confidence: number;
  spreadDeg: number;
  scorable: boolean;
  notScorableReason: string | null;
};

type Check =
  | { type: "range"; lo: number; hi: number; cite: string }
  | { type: "min"; min: number; cite: string }
  | { type: "deviation"; maxDev: number; referenceEvent: SwingEventName; cite: string }
  | {
      type: "extension";
      minGain: number;
      referenceEvent: SwingEventName;
      cite: string;
    };

function key(limb: LimbKind, event: SwingEventName, role: LimbRole): string {
  return `${limb}|${event}|${role}`;
}

export const LIMB_CHECKS: Record<string, Check> = {
  // ── Address ──────────────────────────────────────────────────────────
  // Lead-knee flexion at address ~18°±12° (systematic review of golf swing
  // kinematics, Sports 2022;10(6):91). Converted to this file's convention
  // (180 = straight): 180 − (18±12) = 150–174. Widened to 140–178 for
  // monocular measurement error.
  [key("leg", "address", "lead")]: {
    type: "range",
    lo: 140,
    hi: 178,
    cite: "lead-knee flex at address of roughly 18°±12° (systematic review of golf swing kinematics, Sports 2022)",
  },
  [key("leg", "address", "trail")]: {
    type: "range",
    lo: 140,
    hi: 178,
    cite: "a similar athletic knee flex at address (~20–30°) to the lead knee (golf kinematics literature)",
  },

  // ── Top of backswing ─────────────────────────────────────────────────
  // Trail elbow ~90° at the top (widely-taught "90 degree rule"). Widened
  // to 65–130: below 65 the arm has collapsed, above 130 there is
  // effectively no fold storing width.
  [key("arm", "top", "trail")]: {
    type: "range",
    lo: 65,
    hi: 130,
    cite: "the ~90° trail-elbow guideline at the top of the backswing (widely-taught coaching standard)",
  },
  // Strong qualitative consensus, no single precise study located — so a
  // floor rather than a tight band.
  [key("arm", "top", "lead")]: {
    type: "min",
    min: 150,
    cite: 'the "straight lead arm at the top" coaching consensus',
  },
  // Lead-knee flexion at top ~33°±8° → 139–155. Widened to 131–163.
  [key("leg", "top", "lead")]: {
    type: "range",
    lo: 131,
    hi: 163,
    cite: "lead-knee flex at the top of roughly 33°±8° (golf swing kinematics literature)",
  },
  // Trail knee straightens only slightly (~3–6°) address→top. Checked
  // self-referentially against this golfer's own address frame, so it
  // cannot be thrown off by any external convention mismatch.
  [key("leg", "top", "trail")]: {
    type: "deviation",
    maxDev: 15,
    referenceEvent: "address",
    cite: "research showing the trail knee straightens only slightly (~3–6°) from address to the top",
  },

  // ── Impact ───────────────────────────────────────────────────────────
  [key("arm", "impact", "lead")]: {
    type: "min",
    min: 145,
    cite: "professionals retaining an extended lead arm through impact (pro swing kinematics literature)",
  },
  [key("arm", "impact", "trail")]: {
    type: "range",
    lo: 95,
    hi: 170,
    cite: "professionals holding the trail elbow in a still-flexed position just prior to contact (pro swing kinematics literature)",
  },
  [key("leg", "impact", "lead")]: {
    type: "extension",
    minGain: 0,
    referenceEvent: "top",
    cite: "research showing the lead knee undergoes rapid extension through impact",
  },
};

/** How many band half-widths of error counts as more than "moderate". */
const SEVERITY_MODERATE_Z = 2.0;

export type LimbFinding = {
  limb: LimbKind;
  side: "left" | "right";
  role: LimbRole;
  event: SwingEventName;
  valueDeg: number;
  flagged: boolean;
  severity: "typical" | "moderate" | "high";
  /** Plain-language explanation, including the citation. */
  detail: string;
  cite: string;
  /** Deviation in band half-widths; drives the score. */
  z: number;
  confidence: number;
};

function baselineFor(
  measurements: LimbMeasurement[],
  m: LimbMeasurement,
  referenceEvent: SwingEventName,
): LimbMeasurement | undefined {
  return measurements.find(
    (o) => o.limb === m.limb && o.side === m.side && o.event === referenceEvent,
  );
}

/**
 * Apply the literature checks to reliability-gated measurements.
 *
 * A measurement is only evaluated when the pipeline marked it `scorable`
 * (both gates passed and trail/lead was determined) AND a citation exists
 * for that combination. Everything else is left out — it is still shown in
 * the UI as a measured number, just never graded.
 */
export function evaluateLimbs(measurements: LimbMeasurement[]): LimbFinding[] {
  const out: LimbFinding[] = [];

  for (const m of measurements) {
    if (!m.scorable || !m.role) continue;
    const check = LIMB_CHECKS[key(m.limb, m.event, m.role)];
    if (!check) continue;

    const roleLabel = `${m.role} ${m.limb}`;
    let flagged = false;
    let z = 0;
    let detail = "";

    if (check.type === "range") {
      const mid = (check.lo + check.hi) / 2;
      const half = (check.hi - check.lo) / 2;
      flagged = m.valueDeg < check.lo || m.valueDeg > check.hi;
      z = half === 0 ? 0 : (m.valueDeg - mid) / half;
      const direction = m.valueDeg < check.lo ? "more bent than" : "straighter than";
      detail = `${Math.round(m.valueDeg)}° (${roleLabel}) — ${
        flagged ? `outside (${direction})` : "consistent with"
      } ${check.cite}`;
    } else if (check.type === "min") {
      flagged = m.valueDeg < check.min;
      // Soft slope: a "min" comes from a directional claim, so there is no
      // natural half-width to normalise by.
      z = flagged ? (m.valueDeg - check.min) / 20 : 0;
      detail = `${Math.round(m.valueDeg)}° (${roleLabel}) — ${
        flagged ? "more bent than" : "consistent with"
      } ${check.cite}`;
    } else if (check.type === "deviation") {
      const base = baselineFor(measurements, m, check.referenceEvent);
      if (!base || !base.scorable) continue;
      const deviation = m.valueDeg - base.valueDeg;
      flagged = Math.abs(deviation) > check.maxDev;
      z = deviation / check.maxDev;
      const moved = deviation < 0 ? "bent more" : "straightened";
      detail = `${Math.round(m.valueDeg)}° (${roleLabel}) — ${Math.abs(
        Math.round(deviation),
      )}° ${moved} vs. address, ${flagged ? "more than" : "in line with"} ${check.cite}`;
    } else {
      const base = baselineFor(measurements, m, check.referenceEvent);
      if (!base || !base.scorable) continue;
      const gain = m.valueDeg - base.valueDeg;
      flagged = gain < check.minGain;
      z = flagged ? (gain - check.minGain) / 20 : 0;
      const moved = gain >= 0 ? "straightened" : "bent further";
      detail = `${Math.round(m.valueDeg)}° (${roleLabel}) — ${Math.abs(
        Math.round(gain),
      )}° ${moved} since the top, ${flagged ? "against" : "as expected from"} ${check.cite}`;
    }

    out.push({
      limb: m.limb,
      side: m.side,
      role: m.role,
      event: m.event,
      valueDeg: m.valueDeg,
      flagged,
      severity: !flagged
        ? "typical"
        : Math.abs(z) <= SEVERITY_MODERATE_Z
          ? "moderate"
          : "high",
      detail,
      cite: check.cite,
      z: Number(z.toFixed(2)),
      confidence: m.confidence,
    });
  }

  return out;
}

export type LiteratureScore = {
  score: number | null;
  contributions: Array<{
    label: string;
    event: SwingEventName;
    z: number;
    subScore: number;
  }>;
};

/**
 * Aggregate findings into 0–100.
 *
 * Gaussian decay rather than a linear penalty or a hard cutoff: 100 at
 * dead-on reference, ~61 one band-width off, ~14 at two, ~1 at three. A
 * swing sitting just either side of a threshold shouldn't see its score
 * lurch — it should read as realistic, not pass/fail.
 *
 * Returns null when nothing in the swing had enough real reference data to
 * score against, which is a meaningfully different answer from zero.
 */
export function scoreFromLiterature(findings: LimbFinding[]): LiteratureScore {
  const contributions = findings.map((f) => ({
    label: `${f.role} ${f.limb}`,
    event: f.event,
    z: f.z,
    subScore: Number((100 * Math.exp(-(f.z * f.z) / 2)).toFixed(1)),
  }));

  if (contributions.length === 0) return { score: null, contributions: [] };

  const raw =
    contributions.reduce((sum, c) => sum + c.subScore, 0) / contributions.length;
  return {
    score: Math.max(0, Math.min(100, Math.round(raw))),
    contributions,
  };
}
