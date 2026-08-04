import { z } from "zod";

/**
 * Single source of truth for the web ↔ inference contract.
 *
 * Swing events align with GolfDB / SwingNet (McNally et al.):
 *   0 Address, 1 Toe-up, 2 Mid-backswing, 3 Top,
 *   4 Mid-downswing, 5 Impact, 6 Mid-follow-through, 7 Finish
 *   (+ class 8 = no-event in the model head — not emitted here)
 *
 * SwingNet preprocess (for Phase D): 160×160, ImageNet mean/std RGB
 *   mean [0.485, 0.456, 0.406], std [0.229, 0.224, 0.225]
 */

export const SCHEMA_VERSION = "1.0" as const;

export const SwingEvent = z.enum([
  "address",
  "toe_up",
  "mid_backswing",
  "top",
  "mid_downswing",
  "impact",
  "mid_follow_through",
  "finish",
]);
export type SwingEvent = z.infer<typeof SwingEvent>;

export const CameraView = z.enum(["face_on", "down_the_line", "unknown"]);
export type CameraView = z.infer<typeof CameraView>;

export const QualityWarning = z.enum([
  "low_fps",
  "low_light",
  "partial_body",
  "multiple_people",
  "camera_moved",
  "view_ambiguous",
  "short_clip",
  "no_swing_detected",
]);
export type QualityWarning = z.infer<typeof QualityWarning>;

export const MetricUnit = z.enum(["deg", "ratio", "norm", "ms", "index"]);
export type MetricUnit = z.infer<typeof MetricUnit>;

export const MetricPhase = z.enum([
  "setup",
  "backswing",
  "top",
  "downswing",
  "impact",
  "finish",
  "full",
]);
export type MetricPhase = z.infer<typeof MetricPhase>;

/** TPI Big 12 fault codes */
export const FaultCode = z.enum([
  "s_posture",
  "c_posture",
  "loss_of_posture",
  "flat_shoulder_plane",
  "early_extension",
  "over_the_top",
  "sway",
  "slide",
  "reverse_spine_angle",
  "hanging_back",
  "casting",
  "chicken_wing",
]);
export type FaultCode = z.infer<typeof FaultCode>;

export const SwingStatus = z.enum(["OK", "REJECTED"]);
export type SwingStatus = z.infer<typeof SwingStatus>;

export const CaptureInfo = z.object({
  fps: z.number(),
  width: z.number(),
  height: z.number(),
  frameCount: z.number(),
  durationMs: z.number(),
  view: CameraView,
});
export type CaptureInfo = z.infer<typeof CaptureInfo>;

export const QualityInfo = z.object({
  poseConfidenceMean: z.number().min(0).max(1),
  fpsAdequate: z.boolean(),
  fullBodyInFrame: z.boolean(),
  warnings: z.array(QualityWarning),
});
export type QualityInfo = z.infer<typeof QualityInfo>;

export const DetectedEvent = z.object({
  event: SwingEvent,
  frame: z.number().int(),
  timestampMs: z.number(),
  confidence: z.number().min(0).max(1),
});
export type DetectedEvent = z.infer<typeof DetectedEvent>;

export const Metric = z.object({
  key: z.string(),
  value: z.number(),
  unit: MetricUnit,
  phase: MetricPhase,
  confidence: z.number().min(0).max(1),
  target: z.object({ min: z.number(), max: z.number() }).nullable(),
});
export type Metric = z.infer<typeof Metric>;

export const Fault = z.object({
  code: FaultCode,
  severity: z.number().min(0).max(1),
  phase: z.string(),
  detectedFrom: z.array(z.string()),
  confidence: z.number().min(0).max(1),
});
export type Fault = z.infer<typeof Fault>;

export const AnalysisResult = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  swingId: z.string().uuid(),
  status: SwingStatus,
  rejectionReason: z.string().nullable(),
  capture: CaptureInfo,
  quality: QualityInfo,
  events: z.array(DetectedEvent),
  metrics: z.array(Metric),
  faults: z.array(Fault),
  /** Blob URL to gzipped keypoint JSON — never inline */
  keypointsUrl: z.string().url().nullable(),
});
export type AnalysisResult = z.infer<typeof AnalysisResult>;
