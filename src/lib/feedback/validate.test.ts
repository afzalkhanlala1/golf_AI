import { describe, expect, it } from "vitest";
import { validateGrounding } from "./validate";
import type { FindingsPayload } from "./prompt";

const findings: FindingsPayload = {
  faults: [
    {
      code: "early_extension",
      severity: 0.62,
      phase: "downswing",
      detectedFrom: ["hip_depth_change_downswing"],
      confidence: 0.88,
    },
  ],
  metrics: [
    {
      key: "hip_depth_change_downswing",
      value: 0.18,
      unit: "norm",
      target: { min: 0, max: 0.05 },
    },
    {
      key: "tempo_ratio",
      value: 2.4,
      unit: "ratio",
      target: { min: 2.7, max: 3.3 },
    },
  ],
  phaseScores: { downswing: 58, top: 72, setup: 80 },
  overall: 64,
  qualityWarnings: [],
};

describe("validateGrounding", () => {
  it("accepts grounded numbers including targets and scores", () => {
    const text =
      "Overall 64. Downswing 58. Hip depth 0.18 vs target 0.05. Tempo 2.4 (want 2.7–3.3). Do 8 reps.";
    expect(validateGrounding(text, findings)).toEqual([]);
  });

  it("rejects invented numbers", () => {
    const text = "You gained 47 yards of distance somehow.";
    const v = validateGrounding(text, findings);
    expect(v.some((x) => x.includes("Ungrounded number: 47"))).toBe(true);
  });

  it("rejects banned clubhead / ball flight terms", () => {
    const cases = [
      "Your clubhead speed looks great",
      "ball speed is up",
      "spin rate improved",
      "launch angle is perfect",
      "smash factor of dreams",
      "carry distance exploded",
    ];
    for (const text of cases) {
      expect(validateGrounding(text, findings).some((x) => x.includes("Banned term"))).toBe(
        true,
      );
    }
  });

  it("rejects wrist / force-plate / medical claims", () => {
    const cases = [
      "Check your wrist flexion",
      "radial deviation issue",
      "ground reaction force is off",
      "force plate would confirm",
      "weight distribution problem",
      "this may cause injury",
      "see a physiotherapy clinic",
      "herniated disc risk",
      "my diagnosis is early extension",
    ];
    for (const text of cases) {
      expect(
        validateGrounding(text, findings).some((x) => x.includes("Banned term")),
      ).toBe(true);
    }
  });

  it("allows rep counts 1–20 without findings membership", () => {
    expect(validateGrounding("Do 12 slow swings.", findings)).toEqual([]);
  });
});
