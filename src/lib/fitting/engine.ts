/**
 * Equipment fitting from what the swing analysis already measured.
 *
 * This is a *starting specification*, not a substitute for being fitted in
 * person with a launch monitor and a bag of test heads. Every output says
 * which inputs produced it and how firm those inputs were, so a golfer can
 * tell the difference between "your measured 98mph puts you in stiff" and
 * "people your height usually play standard length".
 *
 * ## Degrading honestly
 *
 * Clubhead speed is the single most useful fitting input and it is also the
 * one most often missing — it needs a face-on camera at 60fps or better.
 * So the engine is built to answer whatever it can from whatever it has:
 * length and iron category come from body measurements and handicap and do
 * not need speed at all. A golfer with a 30fps down-the-line clip still
 * gets real recommendations, plus a specific note about what filming
 * differently would unlock.
 *
 * ## Sources
 *
 * Flex bands and loft-vs-speed follow the ranges published by the major
 * shaft manufacturers and used across the industry. The length chart is
 * wrist-to-floor primary, which is what fitters actually measure — height
 * alone misfits anyone whose arms are long or short for their height, and
 * those are exactly the players a fitting helps most.
 */

export type Confidence = "measured" | "estimated";

export type FittingCategory = "shaft" | "loft" | "length" | "irons" | "ball";

export type Recommendation = {
  category: FittingCategory;
  /** The specification itself, e.g. "Regular flex". */
  title: string;
  /** Why this, in a sentence a golfer can check against their own sense. */
  detail: string;
  confidence: Confidence;
  /** Human names of the inputs used, for the "based on" line. */
  basedOn: string[];
};

export type FittingInput = {
  clubheadSpeedMph: number | null;
  attackAngleDeg: number | null;
  heightCm: number | null;
  wristToFloorCm: number | null;
  handicap: number | null;
};

export type FittingResult = {
  recommendations: Recommendation[];
  /** What to supply or film differently to unlock more, in priority order. */
  unlocks: string[];
};

const CM_PER_INCH = 2.54;

/** Industry-standard driver flex bands, in mph. */
const FLEX_BANDS: Array<{ max: number; flex: string; note: string }> = [
  { max: 75, flex: "Ladies (L)", note: "under 75 mph" },
  { max: 84, flex: "Senior (A)", note: "75–84 mph" },
  { max: 96, flex: "Regular (R)", note: "85–96 mph" },
  { max: 104, flex: "Stiff (S)", note: "97–104 mph" },
  { max: Infinity, flex: "Extra Stiff (X)", note: "105 mph and up" },
];

export function flexForSpeed(mph: number): { flex: string; note: string } {
  const band = FLEX_BANDS.find((b) => mph <= b.max)!;
  return { flex: band.flex, note: band.note };
}

/**
 * Driver loft. Slower swings need more loft to carry; a descending strike
 * needs more still, because attack angle comes straight off dynamic loft.
 */
export function driverLoft(mph: number, attackAngleDeg: number | null): number {
  let loft: number;
  if (mph < 85) loft = 12.5;
  else if (mph < 95) loft = 11;
  else if (mph < 105) loft = 10;
  else loft = 9;

  if (attackAngleDeg !== null) {
    // Roughly half a degree of loft per degree of attack angle, which is
    // the rule of thumb fitters use to keep launch in the same window.
    loft += -attackAngleDeg * 0.5;
  }
  return Math.round(Math.max(7.5, Math.min(15, loft)) * 2) / 2;
}

/**
 * Length adjustment in inches off standard, from wrist-to-floor.
 *
 * Returned in half-inch steps because that is how clubs are actually built.
 */
export function lengthFromWristToFloor(cm: number): number {
  const inches = cm / CM_PER_INCH;
  if (inches < 29) return -1;
  if (inches < 32) return -0.5;
  if (inches < 34.5) return 0;
  if (inches < 36.5) return 0.5;
  return 1;
}

/** Fallback when only height is known. Deliberately coarser. */
export function lengthFromHeight(cm: number): number {
  if (cm < 160) return -1;
  if (cm < 170) return -0.5;
  if (cm < 185) return 0;
  if (cm < 193) return 0.5;
  return 1;
}

export function ironCategory(handicap: number): { title: string; detail: string } {
  if (handicap >= 20) {
    return {
      title: "Super game improvement irons",
      detail:
        "Wide soles and deep perimeter weighting keep mishits playable, which matters far more than workability at this stage.",
    };
  }
  if (handicap >= 12) {
    return {
      title: "Game improvement irons",
      detail:
        "Forgiving through the turf with enough offset to help squaring the face, without the very thick topline of a super game improvement head.",
    };
  }
  if (handicap >= 5) {
    return {
      title: "Players distance irons",
      detail:
        "A thinner profile with hidden forgiveness — you strike it well enough to want feedback, but not so consistently that a blade pays.",
    };
  }
  return {
    title: "Players irons",
    detail:
      "Compact heads with minimal offset give the shot-shaping control and feedback a single-figure player can actually use.",
  };
}

export function ballForSpeed(mph: number): { title: string; detail: string } {
  if (mph < 85) {
    return {
      title: "Low compression (soft) ball",
      detail:
        "Below about 85 mph a firm tour ball never fully compresses, so you lose distance and feel for nothing.",
    };
  }
  if (mph < 100) {
    return {
      title: "Mid compression ball",
      detail:
        "Fast enough to compress a mid-range ball fully, which is the widest sweet spot between distance and greenside control.",
    };
  }
  return {
    title: "Tour / high compression ball",
    detail:
      "At this speed a softer ball over-compresses and spins too much off the driver. A firmer urethane ball holds its line and still checks on approach.",
  };
}

export function fitEquipment(input: FittingInput): FittingResult {
  const recs: Recommendation[] = [];
  const unlocks: string[] = [];

  const { clubheadSpeedMph, attackAngleDeg, heightCm, wristToFloorCm, handicap } =
    input;

  // --- speed-driven: shaft, loft, ball -----------------------------
  if (clubheadSpeedMph !== null) {
    const { flex, note } = flexForSpeed(clubheadSpeedMph);
    recs.push({
      category: "shaft",
      title: flex,
      detail: `Your measured ${clubheadSpeedMph.toFixed(0)} mph falls in the ${note} band. Too stiff and the face arrives open with a low, weak flight; too soft and it is inconsistent.`,
      confidence: "measured",
      basedOn: ["Clubhead speed"],
    });

    const loft = driverLoft(clubheadSpeedMph, attackAngleDeg);
    recs.push({
      category: "loft",
      title: `${loft.toFixed(1)}° driver`,
      detail:
        attackAngleDeg !== null
          ? `Based on ${clubheadSpeedMph.toFixed(0)} mph and a ${attackAngleDeg > 0 ? "+" : ""}${attackAngleDeg.toFixed(1)}° attack angle. Attack angle feeds straight into dynamic loft, so ${attackAngleDeg < 0 ? "hitting down needs more loft on the head to launch it" : "hitting up lets you play less loft and still carry it"}.`
          : `Based on ${clubheadSpeedMph.toFixed(0)} mph. A measured attack angle would sharpen this — it changes the answer by a degree or more.`,
      confidence: attackAngleDeg !== null ? "measured" : "estimated",
      basedOn:
        attackAngleDeg !== null
          ? ["Clubhead speed", "Attack angle"]
          : ["Clubhead speed"],
    });

    const ball = ballForSpeed(clubheadSpeedMph);
    recs.push({
      category: "ball",
      title: ball.title,
      detail: ball.detail,
      confidence: "measured",
      basedOn: ["Clubhead speed"],
    });
  } else {
    unlocks.push(
      "Film one swing face-on in slow motion (120fps+). Clubhead speed drives shaft flex, driver loft and ball choice — three of the five recommendations here.",
    );
  }

  // --- body-driven: length -----------------------------------------
  if (wristToFloorCm !== null) {
    const adj = lengthFromWristToFloor(wristToFloorCm);
    recs.push({
      category: "length",
      title: describeLength(adj),
      detail: `From a ${(wristToFloorCm / CM_PER_INCH).toFixed(1)}" wrist-to-floor measurement — the number fitters actually build to, because it accounts for arm length rather than assuming it from height.`,
      confidence: "measured",
      basedOn: ["Wrist-to-floor"],
    });
  } else if (heightCm !== null) {
    const adj = lengthFromHeight(heightCm);
    recs.push({
      category: "length",
      title: describeLength(adj),
      detail: `Estimated from your height. Height is a rough proxy — if your arms are long or short for your build this will be off by half an inch, which is enough to matter.`,
      confidence: "estimated",
      basedOn: ["Height"],
    });
    unlocks.push(
      "Add a wrist-to-floor measurement to your profile. Stand straight in flat shoes and measure from your wrist crease to the ground — it fits club length far better than height.",
    );
  } else {
    unlocks.push(
      "Add your height, and ideally a wrist-to-floor measurement, to get a club length recommendation.",
    );
  }

  // --- handicap-driven: iron category ------------------------------
  if (handicap !== null) {
    const irons = ironCategory(handicap);
    recs.push({
      category: "irons",
      title: irons.title,
      detail: irons.detail,
      confidence: "measured",
      basedOn: ["Handicap"],
    });
  } else {
    unlocks.push(
      "Add your handicap to get an iron head recommendation — forgiveness versus workability is decided by how consistently you strike it, not how fast you swing.",
    );
  }

  return { recommendations: recs, unlocks };
}

function describeLength(adjustmentInches: number): string {
  if (adjustmentInches === 0) return "Standard length";
  const sign = adjustmentInches > 0 ? "+" : "−";
  return `${sign}${Math.abs(adjustmentInches)}" from standard`;
}
