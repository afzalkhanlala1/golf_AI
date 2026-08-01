export const RUBRIC_VERSION = "1.0.0";

export type PhaseKey =
  | "setup"
  | "backswing"
  | "top"
  | "downswing"
  | "impact"
  | "finish";

export const PHASE_WEIGHTS: Record<PhaseKey, number> = {
  setup: 0.12,
  backswing: 0.15,
  top: 0.18,
  downswing: 0.22,
  impact: 0.20,
  finish: 0.13,
};

/** Mid-handicap target bands (not Tour ranges). */
export const METRIC_TARGETS: Record<
  string,
  { min: number; max: number; tolerance: number; phase: PhaseKey | "full" }
> = {
  tempo_ratio: { min: 2.7, max: 3.3, tolerance: 1.2, phase: "full" },
  backswing_duration_ms: {
    min: 700,
    max: 1200,
    tolerance: 500,
    phase: "backswing",
  },
  shoulder_turn_top: { min: 80, max: 105, tolerance: 30, phase: "top" },
  hip_turn_top: { min: 35, max: 55, tolerance: 25, phase: "top" },
  x_factor_top: { min: 30, max: 50, tolerance: 25, phase: "top" },
  spine_angle_address: { min: 25, max: 40, tolerance: 15, phase: "setup" },
  spine_angle_change: { min: 0, max: 8, tolerance: 12, phase: "impact" },
  spine_tilt_top: { min: -2, max: 12, tolerance: 15, phase: "top" },
  hip_depth_change_downswing: {
    min: 0,
    max: 0.05,
    tolerance: 0.2,
    phase: "downswing",
  },
  hip_lateral_backswing: {
    min: 0,
    max: 0.08,
    tolerance: 0.2,
    phase: "backswing",
  },
  hip_lateral_downswing: {
    min: 0,
    max: 0.08,
    tolerance: 0.2,
    phase: "downswing",
  },
  head_movement: { min: 0, max: 0.15, tolerance: 0.25, phase: "full" },
  lead_arm_angle_top: { min: 150, max: 180, tolerance: 40, phase: "top" },
  lead_arm_angle_impact: { min: 145, max: 180, tolerance: 40, phase: "impact" },
  kinematic_sequence_index: {
    min: 0.7,
    max: 1.0,
    tolerance: 0.5,
    phase: "downswing",
  },
  shoulder_plane_top: { min: 35, max: 55, tolerance: 25, phase: "top" },
  weight_forward_finish: {
    min: 0.55,
    max: 0.85,
    tolerance: 0.35,
    phase: "finish",
  },
};

/** Aspirational Tour markers for UI only — not scoring targets. */
export const TOUR_RANGES: Record<string, { min: number; max: number }> = {
  tempo_ratio: { min: 2.8, max: 3.2 },
  shoulder_turn_top: { min: 90, max: 110 },
  x_factor_top: { min: 40, max: 55 },
};
