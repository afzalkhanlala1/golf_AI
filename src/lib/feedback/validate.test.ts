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
  ],
  phaseScores: { downswing: 58, top: 72 },
  overall: 64,
  qualityWarnings: [],
};

describe("validateGrounding", () => {
  it("accepts grounded numbers", () => {
    const text =
      "Your overall is 64. Early extension severity 0.62 showed hips moving 0.18.";
    expect(validateGrounding(text, findings)).toEqual([]);
  });

  it("rejects invented numbers", () => {
    const text = "You gained 47 yards of distance somehow.";
    const v = validateGrounding(text, findings);
    expect(v.some((x) => x.includes("Ungrounded number: 47"))).toBe(true);
  });

  it("rejects banned terminology", () => {
    const text = "This looks like an injury risk with bad clubhead speed.";
    const v = validateGrounding(text, findings);
    expect(v.some((x) => x.includes("Banned term"))).toBe(true);
  });
});
