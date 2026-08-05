import { describe, expect, it } from "vitest";
import {
  evaluateLimbs,
  scoreFromLiterature,
  type LimbMeasurement,
} from "./literature";

function m(over: Partial<LimbMeasurement> = {}): LimbMeasurement {
  return {
    limb: "arm",
    side: "right",
    role: "trail",
    event: "top",
    frame: 100,
    valueDeg: 90,
    confidence: 0.9,
    spreadDeg: 4,
    scorable: true,
    notScorableReason: null,
    ...over,
  };
}

describe("evaluateLimbs — reliability gating", () => {
  it("grades a confident, stable measurement inside its literature band", () => {
    const [f] = evaluateLimbs([m({ valueDeg: 92 })]);
    expect(f).toBeDefined();
    expect(f!.flagged).toBe(false);
    expect(f!.severity).toBe("typical");
    // The citation must reach the user, not just the verdict.
    expect(f!.detail).toContain("90°");
    expect(f!.cite.length).toBeGreaterThan(10);
  });

  it("refuses to grade an occluded joint even though a band exists", () => {
    // This is the failure the gate exists for: the pose model confidently
    // infers a hidden joint, so every frame agrees on the same wrong answer.
    const findings = evaluateLimbs([
      m({ valueDeg: 30, scorable: false, notScorableReason: "joint_occluded" }),
    ]);
    expect(findings).toHaveLength(0);
  });

  it("refuses to grade when the frames disagree with each other", () => {
    const findings = evaluateLimbs([
      m({ valueDeg: 90, scorable: false, notScorableReason: "unstable_tracking" }),
    ]);
    expect(findings).toHaveLength(0);
  });

  it("refuses to grade when trail/lead could not be determined", () => {
    expect(
      evaluateLimbs([m({ role: null, scorable: false, notScorableReason: "role_undetermined" })]),
    ).toHaveLength(0);
  });

  it("emits nothing when no citation covers that limb/event/role", () => {
    // No literature entry for a trail arm at mid_backswing.
    expect(evaluateLimbs([m({ event: "mid_backswing" })])).toHaveLength(0);
  });
});

describe("evaluateLimbs — check types", () => {
  it("flags a collapsed trail elbow below the band", () => {
    const [f] = evaluateLimbs([m({ valueDeg: 40 })]);
    expect(f!.flagged).toBe(true);
    expect(f!.detail).toContain("more bent than");
  });

  it("flags a bent lead arm against a 'min' floor", () => {
    const [f] = evaluateLimbs([
      m({ role: "lead", side: "left", valueDeg: 120, event: "top" }),
    ]);
    expect(f!.flagged).toBe(true);
    expect(f!.severity).toBe("moderate");
  });

  it("uses the golfer's own address frame for a deviation check", () => {
    const measurements = [
      m({ limb: "leg", side: "right", role: "trail", event: "address", valueDeg: 150 }),
      m({ limb: "leg", side: "right", role: "trail", event: "top", valueDeg: 155 }),
    ];
    const findings = evaluateLimbs(measurements);
    const top = findings.find((f) => f.event === "top")!;
    // 5 deg of straightening is within the 15 deg tolerance.
    expect(top.flagged).toBe(false);
    expect(top.detail).toContain("vs. address");
  });

  it("flags a trail knee that straightens far more than the literature allows", () => {
    const findings = evaluateLimbs([
      m({ limb: "leg", side: "right", role: "trail", event: "address", valueDeg: 145 }),
      m({ limb: "leg", side: "right", role: "trail", event: "top", valueDeg: 178 }),
    ]);
    expect(findings.find((f) => f.event === "top")!.flagged).toBe(true);
  });

  it("skips a deviation check whose baseline is itself ungradeable", () => {
    const findings = evaluateLimbs([
      m({
        limb: "leg", side: "right", role: "trail", event: "address",
        valueDeg: 150, scorable: false, notScorableReason: "joint_occluded",
      }),
      m({ limb: "leg", side: "right", role: "trail", event: "top", valueDeg: 155 }),
    ]);
    // Grading against an unreliable baseline is exactly as wrong as
    // grading an unreliable measurement.
    expect(findings.find((f) => f.event === "top")).toBeUndefined();
  });

  it("checks lead-knee extension through impact against the top", () => {
    const findings = evaluateLimbs([
      m({ limb: "leg", side: "left", role: "lead", event: "top", valueDeg: 140 }),
      m({ limb: "leg", side: "left", role: "lead", event: "impact", valueDeg: 130 }),
    ]);
    // The knee bent further instead of extending — flagged.
    const impact = findings.find((f) => f.event === "impact")!;
    expect(impact.flagged).toBe(true);
    expect(impact.detail).toContain("bent further");
  });
});

describe("scoreFromLiterature", () => {
  it("returns null — not zero — when nothing could be graded", () => {
    // Meaningfully different: "we couldn't measure" vs "you scored 0".
    expect(scoreFromLiterature([]).score).toBeNull();
  });

  it("scores a dead-on-reference swing at 100", () => {
    // 90 deg is the exact midpoint of the 65-130 trail-elbow band... but
    // the band midpoint is 97.5, so use that for a true z of 0.
    const [f] = evaluateLimbs([m({ valueDeg: 97.5 })]);
    expect(scoreFromLiterature([f!]).score).toBe(100);
  });

  it("decays smoothly rather than falling off a cliff", () => {
    const near = evaluateLimbs([m({ valueDeg: 97.5 })]);
    const oneBand = evaluateLimbs([m({ valueDeg: 130 })]); // z = 1
    const twoBands = evaluateLimbs([m({ valueDeg: 162.5 })]); // z = 2

    const s0 = scoreFromLiterature(near).score!;
    const s1 = scoreFromLiterature(oneBand).score!;
    const s2 = scoreFromLiterature(twoBands).score!;

    expect(s0).toBeGreaterThan(s1);
    expect(s1).toBeGreaterThan(s2);
    expect(s1).toBeGreaterThan(55); // ~61 at one band-width
    expect(s1).toBeLessThan(70);
    expect(s2).toBeLessThan(25); // ~14 at two
  });

  it("reports what the score was built from", () => {
    const findings = evaluateLimbs([m({ valueDeg: 92 })]);
    const { contributions } = scoreFromLiterature(findings);
    expect(contributions).toHaveLength(1);
    expect(contributions[0]!.label).toBe("trail arm");
    expect(contributions[0]!.event).toBe("top");
  });

  it("keeps the score inside 0-100 for an absurd measurement", () => {
    const findings = evaluateLimbs([m({ valueDeg: 179 })]);
    const s = scoreFromLiterature(findings).score!;
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(100);
  });
});
