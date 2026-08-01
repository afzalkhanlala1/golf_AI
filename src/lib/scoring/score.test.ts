import { describe, expect, it } from "vitest";
import { buildMockAnalysis } from "@/lib/inference/mock";
import { scoreAnalysis, scoreMetric } from "./score";
import { RUBRIC_VERSION } from "./rubric.config";

describe("scoreMetric", () => {
  it("returns 100 inside the band", () => {
    expect(scoreMetric(3.0, { min: 2.7, max: 3.3 }, 1.2)).toBe(100);
  });

  it("decays linearly outside the band", () => {
    // 1.2 below min with tolerance 1.2 → 0
    expect(scoreMetric(1.5, { min: 2.7, max: 3.3 }, 1.2)).toBe(0);
    // half tolerance below → 50
    expect(scoreMetric(2.1, { min: 2.7, max: 3.3 }, 1.2)).toBeCloseTo(50, 5);
  });
});

describe("scoreAnalysis", () => {
  it("scores a good swing higher than an early-extension swing", () => {
    const good = scoreAnalysis(
      buildMockAnalysis("00000000-0000-4000-8000-000000000001", "good"),
    );
    const bad = scoreAnalysis(
      buildMockAnalysis("00000000-0000-4000-8000-000000000002", "early_extension"),
    );
    expect(good.overall).toBeGreaterThan(bad.overall);
    expect(good.rubricVersion).toBe(RUBRIC_VERSION);
    expect(good.details.every((d) => d.metrics.length >= 0)).toBe(true);
  });

  it("marks low-confidence metrics", () => {
    const result = buildMockAnalysis(
      "00000000-0000-4000-8000-000000000003",
      "good",
    );
    result.metrics = result.metrics.map((m) =>
      m.key === "tempo_ratio" ? { ...m, confidence: 0.3 } : m,
    );
    const scored = scoreAnalysis(result);
    const tempo = scored.details
      .flatMap((d) => d.metrics)
      .find((m) => m.key === "tempo_ratio");
    expect(tempo?.lowConfidence).toBe(true);
  });

  it("attributes deductions to specific metrics", () => {
    const scored = scoreAnalysis(
      buildMockAnalysis("00000000-0000-4000-8000-000000000004", "early_extension"),
    );
    const down = scored.details.find((d) => d.phase === "downswing");
    expect(down?.metrics.some((m) => m.key === "hip_depth_change_downswing")).toBe(
      true,
    );
    const hip = down?.metrics.find((m) => m.key === "hip_depth_change_downswing");
    expect(hip!.score).toBeLessThan(100);
  });
});
