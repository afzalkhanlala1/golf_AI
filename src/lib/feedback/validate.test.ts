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

  it("rejects ball-flight terms this pipeline never measures", () => {
    const cases = [
      "spin rate improved",
      "launch angle is perfect",
      "carry distance exploded",
    ];
    for (const text of cases) {
      expect(validateGrounding(text, findings).some((x) => x.includes("Banned term"))).toBe(
        true,
      );
    }
  });

  it("rejects club-delivery terms when that metric was not measured", () => {
    // These are real measurements now, but only on a face-on clip at 60fps+.
    // On this swing they are absent, so talking about them is invention.
    const cases = [
      "Your clubhead speed looks great",
      "ball speed is up",
      "smash factor of dreams",
      "attack angle is shallow",
    ];
    for (const text of cases) {
      expect(
        validateGrounding(text, findings).some((x) =>
          x.includes("was not measured"),
        ),
      ).toBe(true);
    }
  });

  it("allows a club-delivery term once that metric is present", () => {
    const measured: FindingsPayload = {
      ...findings,
      metrics: [
        ...findings.metrics,
        { key: "clubhead_speed_mph", value: 98, unit: "mph", target: null },
      ],
    };
    expect(validateGrounding("Clubhead speed of 98 is strong.", measured)).toEqual(
      [],
    );
    // ...and the ones still unmeasured stay blocked in the same breath.
    expect(
      validateGrounding("ball speed is up", measured).some((x) =>
        x.includes("was not measured"),
      ),
    ).toBe(true);
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
