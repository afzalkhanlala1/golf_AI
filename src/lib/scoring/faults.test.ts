import { describe, expect, it } from "vitest";
import { buildMockAnalysis } from "@/lib/inference/mock";
import {
  detectChickenWing,
  detectEarlyExtension,
  detectFaults,
  detectFlatShoulderPlane,
  detectHangingBack,
  detectLossOfPosture,
  detectReverseSpine,
  detectSlide,
  detectSway,
  toMetricMap,
} from "./faults";

describe("fault detectors", () => {
  it("detectEarlyExtension fires above threshold", () => {
    const hit = detectEarlyExtension({
      hip_depth_change_downswing: { value: 0.18, confidence: 0.9 },
    });
    expect(hit).not.toBeNull();
    expect(hit!.severity).toBeCloseTo((0.18 - 0.06) / 0.2, 5);
    expect(hit!.detectedFrom).toContain("hip_depth_change_downswing");
  });

  it("detectEarlyExtension ignores small movement", () => {
    expect(
      detectEarlyExtension({
        hip_depth_change_downswing: { value: 0.05, confidence: 0.9 },
      }),
    ).toBeNull();
  });

  it("detectSway / detectSlide", () => {
    expect(
      detectSway({ hip_lateral_backswing: { value: 0.2, confidence: 0.9 } })
        ?.phase,
    ).toBe("backswing");
    expect(
      detectSlide({ hip_lateral_downswing: { value: 0.2, confidence: 0.9 } })
        ?.phase,
    ).toBe("downswing");
  });

  it("detectReverseSpine on negative tilt", () => {
    const hit = detectReverseSpine({
      spine_tilt_top: { value: -8, confidence: 0.85 },
    });
    expect(hit).not.toBeNull();
    expect(hit!.phase).toBe("top");
  });

  it("detectChickenWing on collapsed lead arm", () => {
    const hit = detectChickenWing({
      lead_arm_angle_impact: { value: 120, confidence: 0.9 },
    });
    expect(hit).not.toBeNull();
  });

  it("detectFlatShoulderPlane", () => {
    expect(
      detectFlatShoulderPlane({
        shoulder_plane_top: { value: 20, confidence: 0.9 },
      }),
    ).not.toBeNull();
  });

  it("detectLossOfPosture", () => {
    expect(
      detectLossOfPosture({
        spine_angle_change: { value: 14, confidence: 0.9 },
      }),
    ).not.toBeNull();
  });

  it("detectHangingBack", () => {
    expect(
      detectHangingBack({
        weight_forward_finish: { value: 0.3, confidence: 0.9 },
      }),
    ).not.toBeNull();
  });

  it("detectFaults ranks top 3 from metrics and filters low severity", () => {
    const analysis = buildMockAnalysis(
      "00000000-0000-4000-8000-000000000010",
      "early_extension",
    );
    // Clear inference faults so derivation is metric-only
    analysis.faults = [];
    const faults = detectFaults(analysis);
    expect(faults.length).toBeGreaterThan(0);
    expect(faults.length).toBeLessThanOrEqual(3);
    expect(faults[0]!.severity).toBeGreaterThan(0.25);
    expect(faults[0]!.confidence).toBeGreaterThan(0.5);
    for (let i = 1; i < faults.length; i++) {
      expect(faults[i - 1]!.severity).toBeGreaterThanOrEqual(faults[i]!.severity);
    }
  });

  it("good swing surfaces no major faults", () => {
    const analysis = buildMockAnalysis(
      "00000000-0000-4000-8000-000000000011",
      "good",
    );
    analysis.faults = [];
    const faults = detectFaults(analysis);
    expect(faults.length).toBe(0);
  });

  it("toMetricMap indexes by key", () => {
    const analysis = buildMockAnalysis(
      "00000000-0000-4000-8000-000000000012",
      "good",
    );
    const map = toMetricMap(analysis);
    expect(map.tempo_ratio?.value).toBeDefined();
  });
});
