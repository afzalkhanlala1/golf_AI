import type { AnalysisResult, Metric } from "../../../contract/analysis.schema";
import {
  METRIC_TARGETS,
  PHASE_WEIGHTS,
  RUBRIC_VERSION,
  type PhaseKey,
} from "./rubric.config";

export type MetricScoreDetail = {
  key: string;
  value: number;
  unit: string;
  phase: string;
  confidence: number;
  score: number;
  target: { min: number; max: number } | null;
  lowConfidence: boolean;
};

export type PhaseScoreDetail = {
  phase: PhaseKey;
  score: number;
  metrics: MetricScoreDetail[];
};

export type ScoreResult = {
  overall: number;
  phases: Record<PhaseKey, number>;
  details: PhaseScoreDetail[];
  rubricVersion: string;
};

export function scoreMetric(
  value: number,
  target: { min: number; max: number },
  tolerance: number,
): number {
  if (value >= target.min && value <= target.max) return 100;
  const d = value < target.min ? target.min - value : value - target.max;
  return Math.max(0, 100 - 100 * (d / tolerance));
}

function resolveTarget(m: Metric): {
  min: number;
  max: number;
  tolerance: number;
} | null {
  if (m.target) {
    const cfg = METRIC_TARGETS[m.key];
    return {
      min: m.target.min,
      max: m.target.max,
      tolerance: cfg?.tolerance ?? Math.max(1, (m.target.max - m.target.min) * 1.5),
    };
  }
  const cfg = METRIC_TARGETS[m.key];
  if (!cfg) return null;
  return { min: cfg.min, max: cfg.max, tolerance: cfg.tolerance };
}

export function scoreAnalysis(result: AnalysisResult): ScoreResult {
  const phaseBuckets: Record<PhaseKey, MetricScoreDetail[]> = {
    setup: [],
    backswing: [],
    top: [],
    downswing: [],
    impact: [],
    finish: [],
  };

  for (const m of result.metrics) {
    const resolved = resolveTarget(m);
    const score = resolved
      ? scoreMetric(m.value, resolved, resolved.tolerance)
      : 70;
    const detail: MetricScoreDetail = {
      key: m.key,
      value: m.value,
      unit: m.unit,
      phase: m.phase,
      confidence: m.confidence,
      score,
      target: resolved ? { min: resolved.min, max: resolved.max } : m.target,
      lowConfidence: m.confidence < 0.5,
    };

    if (m.phase === "full") {
      // Attribute full-swing metrics to the weaker of setup/finish for display
      phaseBuckets.setup.push(detail);
      phaseBuckets.finish.push(detail);
      continue;
    }
    if (m.phase in phaseBuckets) {
      phaseBuckets[m.phase as PhaseKey].push(detail);
    }
  }

  const phases = {} as Record<PhaseKey, number>;
  const details: PhaseScoreDetail[] = [];

  for (const phase of Object.keys(PHASE_WEIGHTS) as PhaseKey[]) {
    const metrics = phaseBuckets[phase];
    let phaseScore = 75;
    if (metrics.length > 0) {
      let weighted = 0;
      let weightSum = 0;
      for (const m of metrics) {
        const w = Math.max(0.1, m.confidence);
        weighted += m.score * w;
        weightSum += w;
      }
      phaseScore = weightSum > 0 ? weighted / weightSum : 75;
    }
    phases[phase] = Math.round(phaseScore * 10) / 10;
    details.push({ phase, score: phases[phase], metrics });
  }

  let overall = 0;
  for (const phase of Object.keys(PHASE_WEIGHTS) as PhaseKey[]) {
    overall += phases[phase] * PHASE_WEIGHTS[phase];
  }

  return {
    overall: Math.round(overall * 10) / 10,
    phases,
    details,
    rubricVersion: RUBRIC_VERSION,
  };
}
