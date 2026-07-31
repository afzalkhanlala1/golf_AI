import { describe, expect, it } from "vitest";
import { AnalysisResult, SwingEvent } from "./analysis.schema";

const validResult = {
  schemaVersion: "1.0" as const,
  swingId: "550e8400-e29b-41d4-a716-446655440000",
  status: "OK" as const,
  rejectionReason: null,
  capture: {
    fps: 240,
    width: 1080,
    height: 1920,
    frameCount: 1200,
    durationMs: 5000,
    view: "face_on" as const,
  },
  quality: {
    poseConfidenceMean: 0.91,
    fpsAdequate: true,
    fullBodyInFrame: true,
    warnings: [],
  },
  events: [
    {
      event: "address" as const,
      frame: 10,
      timestampMs: 41.7,
      confidence: 0.88,
    },
    {
      event: "impact" as const,
      frame: 640,
      timestampMs: 2666.7,
      confidence: 0.93,
    },
  ],
  metrics: [
    {
      key: "tempo_ratio",
      value: 3.0,
      unit: "ratio" as const,
      phase: "full" as const,
      confidence: 0.9,
      target: { min: 2.7, max: 3.3 },
    },
  ],
  faults: [
    {
      code: "early_extension" as const,
      severity: 0.42,
      phase: "downswing",
      detectedFrom: ["hip_depth_change_downswing"],
      confidence: 0.8,
    },
  ],
  keypointsUrl: "https://blob.example.com/keypoints/swing.json.gz",
};

describe("AnalysisResult contract", () => {
  it("accepts a valid analysis payload", () => {
    const parsed = AnalysisResult.parse(validResult);
    expect(parsed.schemaVersion).toBe("1.0");
    expect(parsed.events[0]?.event).toBe("address");
  });

  it("exposes the GolfDB eight-event taxonomy", () => {
    expect(SwingEvent.options).toEqual([
      "address",
      "toe_up",
      "mid_backswing",
      "top",
      "mid_downswing",
      "impact",
      "mid_follow_through",
      "finish",
    ]);
  });

  it("rejects inline keypoint blobs that are not URLs", () => {
    const result = AnalysisResult.safeParse({
      ...validResult,
      keypointsUrl: "not-a-url",
    });
    expect(result.success).toBe(false);
  });

  it("rejects unknown schema versions", () => {
    const result = AnalysisResult.safeParse({
      ...validResult,
      schemaVersion: "2.0",
    });
    expect(result.success).toBe(false);
  });
});
