import type { FindingsPayload } from "./prompt";

const BANNED_TERMS = [
  "wrist flexion",
  "wrist extension",
  "radial deviation",
  "ground reaction",
  "force plate",
  "weight distribution",
  "clubhead speed",
  "ball speed",
  "spin rate",
  "launch angle",
  "smash factor",
  "carry distance",
  "injury",
  "physiotherapy",
  "physical therapy",
  "herniated",
  "diagnosis",
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

  return violations;
}
