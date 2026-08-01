import type { AnalysisResult, Fault } from "../../../contract/analysis.schema";

export type MetricMap = Record<
  string,
  { value: number; confidence: number } | undefined
>;

export type FaultHit = {
  severity: number;
  phase: string;
  detectedFrom: string[];
  confidence: number;
};

function clamp01(n: number) {
  return Math.min(1, Math.max(0, n));
}

export function toMetricMap(result: AnalysisResult): MetricMap {
  const map: MetricMap = {};
  for (const m of result.metrics) {
    map[m.key] = { value: m.value, confidence: m.confidence };
  }
  return map;
}

export function detectEarlyExtension(m: MetricMap): FaultHit | null {
  const d = m.hip_depth_change_downswing;
  if (!d || d.value < 0.06) return null;
  return {
    severity: clamp01((d.value - 0.06) / 0.2),
    phase: "downswing",
    detectedFrom: ["hip_depth_change_downswing", "spine_angle_change"],
    confidence: d.confidence,
  };
}

export function detectSway(m: MetricMap): FaultHit | null {
  const d = m.hip_lateral_backswing;
  if (!d || d.value < 0.1) return null;
  return {
    severity: clamp01((d.value - 0.1) / 0.2),
    phase: "backswing",
    detectedFrom: ["hip_lateral_backswing"],
    confidence: d.confidence,
  };
}

export function detectSlide(m: MetricMap): FaultHit | null {
  const d = m.hip_lateral_downswing;
  if (!d || d.value < 0.1) return null;
  return {
    severity: clamp01((d.value - 0.1) / 0.2),
    phase: "downswing",
    detectedFrom: ["hip_lateral_downswing"],
    confidence: d.confidence,
  };
}

export function detectReverseSpine(m: MetricMap): FaultHit | null {
  const d = m.spine_tilt_top;
  if (!d || d.value >= -2) return null;
  return {
    severity: clamp01((-2 - d.value) / 12),
    phase: "top",
    detectedFrom: ["spine_tilt_top"],
    confidence: d.confidence,
  };
}

export function detectChickenWing(m: MetricMap): FaultHit | null {
  const d = m.lead_arm_angle_impact;
  if (!d || d.value >= 145) return null;
  return {
    severity: clamp01((145 - d.value) / 40),
    phase: "impact",
    detectedFrom: ["lead_arm_angle_impact"],
    confidence: d.confidence,
  };
}

export function detectFlatShoulderPlane(m: MetricMap): FaultHit | null {
  const d = m.shoulder_plane_top;
  if (!d || d.value >= 35) return null;
  return {
    severity: clamp01((35 - d.value) / 20),
    phase: "top",
    detectedFrom: ["shoulder_plane_top"],
    confidence: d.confidence,
  };
}

export function detectLossOfPosture(m: MetricMap): FaultHit | null {
  const d = m.spine_angle_change;
  if (!d || d.value <= 8) return null;
  return {
    severity: clamp01((d.value - 8) / 15),
    phase: "impact",
    detectedFrom: ["spine_angle_change", "spine_angle_address"],
    confidence: d.confidence,
  };
}

export function detectHangingBack(m: MetricMap): FaultHit | null {
  const d = m.weight_forward_finish;
  if (!d || d.value >= 0.5) return null;
  return {
    severity: clamp01((0.5 - d.value) / 0.35),
    phase: "finish",
    detectedFrom: ["weight_forward_finish"],
    confidence: d.confidence,
  };
}

const DETECTORS: Array<{
  code: Fault["code"];
  fn: (m: MetricMap) => FaultHit | null;
}> = [
  { code: "early_extension", fn: detectEarlyExtension },
  { code: "sway", fn: detectSway },
  { code: "slide", fn: detectSlide },
  { code: "reverse_spine_angle", fn: detectReverseSpine },
  { code: "chicken_wing", fn: detectChickenWing },
  { code: "flat_shoulder_plane", fn: detectFlatShoulderPlane },
  { code: "loss_of_posture", fn: detectLossOfPosture },
  { code: "hanging_back", fn: detectHangingBack },
];

/** Derive faults from metrics only. Rank top 3 with severity > 0.25 and confidence > 0.5. */
export function detectFaults(result: AnalysisResult): Fault[] {
  const map = toMetricMap(result);
  const hits: Fault[] = [];
  for (const { code, fn } of DETECTORS) {
    const hit = fn(map);
    if (!hit) continue;
    if (hit.severity <= 0.25 || hit.confidence <= 0.5) continue;
    hits.push({ code, ...hit });
  }
  return hits.sort((a, b) => b.severity - a.severity).slice(0, 3);
}
