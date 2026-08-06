import type { FindingsPayload } from "./prompt";

/** Never measured by this pipeline, so never groundable. */
const BANNED_TERMS = [
  "wrist flexion",
  "wrist extension",
  "radial deviation",
  "ground reaction",
  "force plate",
  "weight distribution",
  "spin rate",
  "launch angle",
  "carry distance",
  "injury",
  "physiotherapy",
  "physical therapy",
  "herniated",
  "diagnosis",
];

/**
 * Terms that are legitimate *when the pipeline actually measured them*.
 *
 * These used to sit in the flat ban list, correctly, because nothing
 * produced them. Club tracking now does — but only for face-on clips at
 * 60fps or better, so on most swings they are still ungrounded. Keying the
 * ban to the presence of the metric enforces the real rule: the coach may
 * talk about a number we measured, and may never talk about one we did not.
 */
const METRIC_GATED_TERMS: Array<{ term: string; metricKey: string }> = [
  { term: "clubhead speed", metricKey: "clubhead_speed_mph" },
  { term: "club head speed", metricKey: "clubhead_speed_mph" },
  { term: "ball speed", metricKey: "ball_speed_mph" },
  { term: "smash factor", metricKey: "smash_factor" },
  { term: "attack angle", metricKey: "attack_angle_deg" },
];

function collectAllowedNumbers(findings: FindingsPayload): number[] {
  const nums: number[] = [findings.overall];
  for (const s of Object.values(findings.phaseScores)) nums.push(s);
  for (const f of findings.faults) {
    nums.push(f.severity, f.confidence);
  }
  for (const m of findings.metrics) {
    nums.push(m.value);
    if (m.target) {
      nums.push(m.target.min, m.target.max);
    }
  }
  // Whitelist trivial integers used in drills/reps
  for (let i = 1; i <= 20; i++) nums.push(i);
  return nums;
}

function extractNumbers(text: string): number[] {
  const matches = text.match(/-?\d+(?:\.\d+)?/g) ?? [];
  return matches.map(Number).filter((n) => !Number.isNaN(n));
}

export function validateGrounding(
  text: string,
  findings: FindingsPayload,
): string[] {
  const violations: string[] = [];
  const allowed = collectAllowedNumbers(findings);

  for (const n of extractNumbers(text)) {
    if (
      !allowed.some(
        (a) => Math.abs(a - n) <= Math.max(0.5, Math.abs(a) * 0.02),
      )
    ) {
      violations.push(`Ungrounded number: ${n}`);
    }
  }

  const lower = text.toLowerCase();
  for (const term of BANNED_TERMS) {
    if (lower.includes(term)) violations.push(`Banned term: ${term}`);
  }

  const measured = new Set(findings.metrics.map((m) => m.key));
  for (const { term, metricKey } of METRIC_GATED_TERMS) {
    if (lower.includes(term) && !measured.has(metricKey)) {
      violations.push(`Term "${term}" used but ${metricKey} was not measured`);
    }
  }

  return violations;
}
