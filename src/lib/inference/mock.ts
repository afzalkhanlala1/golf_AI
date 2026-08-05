import type { AnalysisResult } from "../../../contract/analysis.schema";
import { METRIC_TARGETS } from "@/lib/scoring/rubric.config";

export type MockVariant = "good" | "early_extension" | "reduced_fps" | "low_fps";

function metric(
  key: string,
  value: number,
  confidence = 0.9,
): AnalysisResult["metrics"][number] {
  const cfg = METRIC_TARGETS[key];
  return {
    key,
    value,
    unit: key.includes("ms")
      ? "ms"
      : key.includes("ratio") || key.includes("index")
        ? key.includes("index")
          ? "index"
          : "ratio"
        : key.includes("norm") ||
            key.startsWith("hip_") ||
            key.startsWith("head_") ||
            key.startsWith("weight_")
          ? "norm"
          : "deg",
    phase: cfg?.phase ?? "full",
    confidence,
    target: cfg ? { min: cfg.min, max: cfg.max } : null,
  };
}

function events(fps: number, reducedFps = false): AnalysisResult["events"] {
  const frames = {
    address: 24,
    toe_up: 90,
    mid_backswing: 160,
    top: 240,
    mid_downswing: 300,
    impact: 340,
    mid_follow_through: 400,
    finish: 480,
  };
  return (Object.entries(frames) as [AnalysisResult["events"][number]["event"], number][]).map(
    ([event, frame]) => {
      const base = event === "impact" ? 0.94 : 0.86;
      // Mirrors inference/pipeline/analyze.py::_fps_confidence_scale — impact
      // is under-sampled below 120fps, other phases barely move.
      const scale = !reducedFps ? 1 : event === "impact" ? 0.5 : 0.85;
      return {
        event,
        frame,
        timestampMs: (frame / fps) * 1000,
        confidence: Math.round(base * scale * 100) / 100,
      };
    },
  );
}

/**
 * Reliability-gated limb angles. The "bad" variant deliberately includes an
 * occluded lead arm so the UI's not-scorable path is exercised by a demo —
 * that path is easy to break silently otherwise.
 */
function limbs(
  good: boolean,
  reducedFps: boolean,
): AnalysisResult["limbs"] {
  const conf = reducedFps ? 0.55 : 0.88;
  const rows: AnalysisResult["limbs"] = [
    {
      limb: "arm", side: "right", role: "trail", event: "top", frame: 240,
      valueDeg: good ? 96 : 142, confidence: conf, spreadDeg: 4.2,
      scorable: !reducedFps, notScorableReason: reducedFps ? "joint_occluded" : null,
    },
    {
      limb: "arm", side: "left", role: "lead", event: "top", frame: 240,
      valueDeg: good ? 168 : 138, confidence: 0.52, spreadDeg: 6.1,
      // Lead arm hidden behind the body from this angle — measured but
      // never graded.
      scorable: false, notScorableReason: "joint_occluded",
    },
    {
      limb: "leg", side: "left", role: "lead", event: "top", frame: 240,
      valueDeg: good ? 148 : 128, confidence: conf, spreadDeg: 3.4,
      scorable: !reducedFps, notScorableReason: reducedFps ? "joint_occluded" : null,
    },
    {
      limb: "leg", side: "left", role: "lead", event: "impact", frame: 340,
      valueDeg: good ? 165 : 122, confidence: conf, spreadDeg: 5.0,
      scorable: !reducedFps, notScorableReason: reducedFps ? "joint_occluded" : null,
    },
    {
      limb: "arm", side: "left", role: "lead", event: "impact", frame: 340,
      valueDeg: good ? 158 : 131, confidence: conf, spreadDeg: 7.7,
      scorable: !reducedFps, notScorableReason: reducedFps ? "joint_occluded" : null,
    },
  ];
  return rows;
}

export function buildMockAnalysis(
  swingId: string,
  variant: MockVariant = "early_extension",
): AnalysisResult {
  if (variant === "low_fps") {
    return {
      schemaVersion: "1.0",
      swingId,
      status: "REJECTED",
      rejectionReason:
        "Clip appears to be ~15fps, which is too low to track a golf swing at all. Re-film at 30fps or higher — your phone's native slow-motion mode (120fps+) gives the most accurate result, especially around impact.",
      capture: {
        fps: 15,
        width: 1080,
        height: 1920,
        frameCount: 45,
        durationMs: 3000,
        view: "face_on",
      },
      quality: {
        poseConfidenceMean: 0.4,
        fpsAdequate: false,
        fullBodyInFrame: true,
        warnings: ["low_fps", "short_clip"],
      },
      events: [],
      metrics: [],
      limbs: [],
      faults: [],
      keypointsUrl: null,
    };
  }

  const reducedFps = variant === "reduced_fps";
  const fps = reducedFps ? 30 : 240;
  const good = variant === "good";

  const metrics = [
    metric("tempo_ratio", good ? 3.0 : 2.4),
    metric("backswing_duration_ms", good ? 900 : 1100),
    metric("shoulder_turn_top", good ? 95 : 82),
    metric("hip_turn_top", good ? 45 : 48),
    metric("x_factor_top", good ? 50 : 34),
    metric("spine_angle_address", good ? 32 : 30),
    metric("spine_angle_change", good ? 4 : 11),
    metric("spine_tilt_top", good ? 6 : 4),
    metric("hip_depth_change_downswing", good ? 0.02 : 0.18),
    metric("hip_lateral_backswing", good ? 0.04 : 0.07),
    metric("hip_lateral_downswing", good ? 0.03 : 0.09),
    metric("head_movement", good ? 0.08 : 0.14),
    metric("lead_arm_angle_top", good ? 168 : 160),
    metric("lead_arm_angle_impact", good ? 162 : 150),
    metric("kinematic_sequence_index", good ? 0.92 : 0.55),
    metric("shoulder_plane_top", good ? 45 : 38),
    metric("weight_forward_finish", good ? 0.72 : 0.58),
  ].map((m) =>
    reducedFps
      ? {
          ...m,
          confidence:
            Math.round(
              m.confidence * (m.phase === "impact" || m.phase === "downswing" ? 0.5 : 0.85) * 100,
            ) / 100,
        }
      : m,
  );

  const faults: AnalysisResult["faults"] = good
    ? []
    : [
        {
          code: "early_extension",
          severity: 0.62,
          phase: "downswing",
          detectedFrom: ["hip_depth_change_downswing", "spine_angle_change"],
          confidence: 0.88,
        },
        {
          code: "loss_of_posture",
          severity: 0.38,
          phase: "impact",
          detectedFrom: ["spine_angle_change"],
          confidence: 0.8,
        },
      ];

  return {
    schemaVersion: "1.0",
    swingId,
    status: "OK",
    rejectionReason: null,
    capture: {
      fps,
      width: 1080,
      height: 1920,
      frameCount: 520,
      durationMs: Math.round((520 / fps) * 1000),
      view: "face_on",
    },
    quality: {
      poseConfidenceMean: reducedFps ? 0.68 : good ? 0.93 : 0.87,
      fpsAdequate: !reducedFps,
      fullBodyInFrame: true,
      warnings: reducedFps ? ["low_fps"] : [],
    },
    events: events(fps, reducedFps),
    metrics,
    limbs: limbs(good, reducedFps),
    faults,
    // Keypoints stay on blob in real inference; mock returns null (UI still works).
    keypointsUrl: null,
  };
}

export function pickMockVariant(club?: string | null): MockVariant {
  if (club === "reject-demo") return "low_fps";
  if (club === "30fps-demo") return "reduced_fps";
  if (club === "good-demo") return "good";
  return "early_extension";
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
