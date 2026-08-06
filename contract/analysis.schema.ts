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

export const MetricUnit = z.enum(["deg", "ratio", "norm", "ms", "index", "mph"]);
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

/**
 * Reliability-gated limb angle at one swing event.
 *
 * `scorable` is the pipeline's verdict that this number is solid enough to
 * GRADE, which is a higher bar than being solid enough to display: it
 * requires the joint to have been genuinely observed rather than inferred
 * behind an occlusion, and requires the frames around the event to agree
 * with each other. See inference/pipeline/posture.py.
 */
export const LimbMeasurement = z.object({
  limb: z.enum(["arm", "leg"]),
  side: z.enum(["left", "right"]),
  /** Determined per-swing from the backswing fold, never assumed from handedness. */
  role: z.enum(["trail", "lead"]).nullable(),
  event: SwingEvent,
  frame: z.number().int(),
  valueDeg: z.number(),
  confidence: z.number().min(0).max(1),
  /** Degrees of disagreement between frames around the event. */
  spreadDeg: z.number(),
  scorable: z.boolean(),
  notScorableReason: z
    .enum(["joint_occluded", "unstable_tracking", "role_undetermined"])
    .nullable(),
});
export type LimbMeasurement = z.infer<typeof LimbMeasurement>;

/**
 * Why clubhead speed is missing, when it is.
 *
 * These are NOT quality warnings. A down-the-line camera is a perfectly
 * good video; it just cannot measure a velocity pointed along its own
 * optical axis. Telling the golfer "turn the camera face-on" is actionable,
 * where "low quality" would be wrong and discouraging.
 */
export const ClubSpeedUnavailableReason = z.enum([
  /** The clubhead could not be followed through the strike at all. */
  "not_tracked",
  /** Followed elsewhere in the swing, but lost across impact itself. */
  "not_tracked_at_impact",
  /** Down-the-line or unknown view: impact travel is foreshortened. */
  "needs_face_on",
  /** Below 60fps the frame interval smears the peak. */
  "needs_high_fps",
  /** No metric body reconstruction, so no pixels-per-metre. */
  "needs_3d_pose",
  /** Tracked, but the resulting number was outside physical range. */
  "implausible_result",
  /** Tracking raised. The rest of the analysis is unaffected. */
  "tracking_failed",
]);
export type ClubSpeedUnavailableReason = z.infer<typeof ClubSpeedUnavailableReason>;

export const BallSpeedUnavailableReason = z.enum([
  /** A struck ball clears the frame in ~1 frame below 120fps. */
  "needs_120fps",
  "not_detected",
  /** Without clubhead speed there is nothing to pair it with. */
  "needs_clubhead_speed",
]);
export type BallSpeedUnavailableReason = z.infer<typeof BallSpeedUnavailableReason>;

export const ClubTrackingInfo = z.object({
  /** Whether a clubhead path exists. The polyline itself is in the keypoints blob. */
  tracked: z.boolean(),
  /** Image scale from the metric pose reconstruction; null when unavailable. */
  scalePxPerM: z.number().nullable(),
  speedUnavailableReason: ClubSpeedUnavailableReason.nullable(),
  ballUnavailableReason: BallSpeedUnavailableReason.nullable(),
});
export type ClubTrackingInfo = z.infer<typeof ClubTrackingInfo>;

export const AnalysisResult = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  swingId: z.string().uuid(),
  status: SwingStatus,
  rejectionReason: z.string().nullable(),
  capture: CaptureInfo,
  quality: QualityInfo,
  events: z.array(DetectedEvent),
  metrics: z.array(Metric),
  /** Optional so older payloads still validate. */
  limbs: z.array(LimbMeasurement).default([]),
  /**
   * Null on results produced before club tracking existed, and on rejected
   * swings that never reached the tracker.
   */
  club: ClubTrackingInfo.nullable().default(null),
  faults: z.array(Fault),
  /** Blob URL to gzipped keypoint JSON — never inline */
  keypointsUrl: z.string().url().nullable(),
});
export type AnalysisResult = z.infer<typeof AnalysisResult>;

/**
 * The gzipped blob at `keypointsUrl`. Fetched by the player, never inlined
 * into the analysis result — at 21 joints × 4 numbers × a thousand frames
 * it dwarfs everything else in the payload.
 *
 * Version 2.0 added `world` and `tracer`. `frames` is unchanged from 1.0,
 * so a 1.0 blob still drives the 2D player; it simply has no 3D to offer.
 */
export const KEYPOINTS_SCHEMA_VERSION = "2.0" as const;

export const TracerPoint = z.object({
  f: z.number().int(),
  x: z.number(),
  y: z.number(),
  c: z.number().min(0).max(1),
});
export type TracerPoint = z.infer<typeof TracerPoint>;

export const KeypointsPayload = z.object({
  schemaVersion: z.string(),
  swingId: z.string(),
  fps: z.number(),
  width: z.number(),
  height: z.number(),
  frameCount: z.number().int(),
  /** T × 21 × [x, y, confidence] in image pixels. */
  frames: z.array(z.array(z.array(z.number()))),
  /**
   * T × 21 × [x, y, z, visibility] in METRES, origin at the hip midpoint.
   * Null on 1.0 blobs and on any backend without a 3D head — the 3D player
   * must check rather than assume.
   */
  world: z.array(z.array(z.array(z.number()))).nullable().default(null),
  /** Clubhead path in image pixels, one entry per tracked frame. */
  tracer: z.array(TracerPoint).nullable().default(null),
});
export type KeypointsPayload = z.infer<typeof KeypointsPayload>;
