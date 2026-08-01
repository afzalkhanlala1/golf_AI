import type { SwingEvent } from "../../../contract/analysis.schema";
import {
  angleFromVertical,
  hipWidth,
  jointAngle,
  KP,
  lineInclination,
  midHip,
  midShoulder,
  type PoseFrame,
  shoulderWidth,
  stanceWidth,
} from "./geometry";

export type EventMap = Partial<Record<SwingEvent, number>>;

export type MetricValue = {
  key: string;
  value: number;
  unit: "deg" | "ratio" | "norm" | "ms" | "index";
  phase: string;
};

function requireFrame(frames: PoseFrame[], idx: number, label: string): PoseFrame {
  const f = frames[idx];
  if (!f) throw new Error(`Missing frame for ${label} at index ${idx}`);
  return f;
}

export function tempoRatio(events: EventMap): number {
  const address = events.address;
  const top = events.top;
  const impact = events.impact;
  if (address == null || top == null || impact == null) {
    throw new Error("tempo_ratio requires address, top, impact");
  }
  const back = top - address;
  const down = impact - top;
  if (down <= 0) throw new Error("Invalid event ordering for tempo_ratio");
  return back / down;
}

export function backswingDurationMs(events: EventMap, fps: number): number {
  const address = events.address;
  const top = events.top;
  if (address == null || top == null) {
    throw new Error("backswing_duration_ms requires address, top");
  }
  return ((top - address) / fps) * 1000;
}

export function shoulderTurnTop(
  frames: PoseFrame[],
  events: EventMap,
): number {
  const address = requireFrame(frames, events.address!, "address");
  const top = requireFrame(frames, events.top!, "top");
  const a = lineInclination(address[KP.leftShoulder], address[KP.rightShoulder]);
  const t = lineInclination(top[KP.leftShoulder], top[KP.rightShoulder]);
  return Math.abs(t - a);
}

export function hipTurnTop(frames: PoseFrame[], events: EventMap): number {
  const address = requireFrame(frames, events.address!, "address");
  const top = requireFrame(frames, events.top!, "top");
  const a = lineInclination(address[KP.leftHip], address[KP.rightHip]);
  const t = lineInclination(top[KP.leftHip], top[KP.rightHip]);
  return Math.abs(t - a);
}

export function xFactorTop(frames: PoseFrame[], events: EventMap): number {
  return shoulderTurnTop(frames, events) - hipTurnTop(frames, events);
}

export function spineAngleAddress(
  frames: PoseFrame[],
  events: EventMap,
): number {
  const address = requireFrame(frames, events.address!, "address");
  return Math.abs(
    angleFromVertical(midHip(address), midShoulder(address)),
  );
}

export function spineAngleChange(
  frames: PoseFrame[],
  events: EventMap,
): number {
  const address = requireFrame(frames, events.address!, "address");
  const impact = requireFrame(frames, events.impact!, "impact");
  const a = Math.abs(angleFromVertical(midHip(address), midShoulder(address)));
  const i = Math.abs(angleFromVertical(midHip(impact), midShoulder(impact)));
  return Math.abs(i - a);
}

/** Lateral tilt at top; negative ≈ reverse spine. */
export function spineTiltTop(frames: PoseFrame[], events: EventMap): number {
  const top = requireFrame(frames, events.top!, "top");
  return angleFromVertical(midHip(top), midShoulder(top));
}

export function hipDepthChangeDownswing(
  frames: PoseFrame[],
  events: EventMap,
): number {
  const address = requireFrame(frames, events.address!, "address");
  const impact = requireFrame(frames, events.impact!, "impact");
  // Toward camera/ball approximated as decrease in hip y (image coords: y down)
  // For face-on, early extension ≈ hip center moving toward ball (often +y in standing pose... )
  // Spec: hip-centre movement toward camera/ball vs address ÷ hip width
  // Use vertical displacement of mid-hip (y increases toward ball for typical upright camera)
  const dy = midHip(impact).y - midHip(address).y;
  const hw = hipWidth(address);
  if (hw <= 0) throw new Error("Invalid hip width");
  return Math.max(0, dy / hw);
}

export function hipLateralBackswing(
  frames: PoseFrame[],
  events: EventMap,
): number {
  const address = requireFrame(frames, events.address!, "address");
  const top = requireFrame(frames, events.top!, "top");
  const dx = Math.abs(midHip(top).x - midHip(address).x);
  const hw = hipWidth(address);
  if (hw <= 0) throw new Error("Invalid hip width");
  return dx / hw;
}

export function hipLateralDownswing(
  frames: PoseFrame[],
  events: EventMap,
): number {
  const address = requireFrame(frames, events.address!, "address");
  const impact = requireFrame(frames, events.impact!, "impact");
  const dx = Math.abs(midHip(impact).x - midHip(address).x);
  const hw = hipWidth(address);
  if (hw <= 0) throw new Error("Invalid hip width");
  return dx / hw;
}

export function headMovement(frames: PoseFrame[], events: EventMap): number {
  const address = requireFrame(frames, events.address!, "address");
  const finish = requireFrame(frames, events.finish!, "finish");
  const start = events.address!;
  const end = events.finish!;
  let max = 0;
  const origin = address[KP.nose];
  const sw = shoulderWidth(address);
  if (sw <= 0) throw new Error("Invalid shoulder width");
  for (let i = start; i <= end; i++) {
    const f = frames[i];
    if (!f) continue;
    max = Math.max(max, Math.hypot(f[KP.nose].x - origin.x, f[KP.nose].y - origin.y));
  }
  void finish;
  return max / sw;
}

export function leadArmAngleTop(
  frames: PoseFrame[],
  events: EventMap,
  lead: "left" | "right" = "left",
): number {
  const top = requireFrame(frames, events.top!, "top");
  if (lead === "left") {
    return jointAngle(
      top[KP.leftShoulder],
      top[KP.leftElbow],
      top[KP.leftWrist],
    );
  }
  return jointAngle(
    top[KP.rightShoulder],
    top[KP.rightElbow],
    top[KP.rightWrist],
  );
}

export function leadArmAngleImpact(
  frames: PoseFrame[],
  events: EventMap,
  lead: "left" | "right" = "left",
): number {
  const impact = requireFrame(frames, events.impact!, "impact");
  if (lead === "left") {
    return jointAngle(
      impact[KP.leftShoulder],
      impact[KP.leftElbow],
      impact[KP.leftWrist],
    );
  }
  return jointAngle(
    impact[KP.rightShoulder],
    impact[KP.rightElbow],
    impact[KP.rightWrist],
  );
}

export function shoulderPlaneTop(
  frames: PoseFrame[],
  events: EventMap,
): number {
  const top = requireFrame(frames, events.top!, "top");
  return Math.abs(
    lineInclination(top[KP.leftShoulder], top[KP.rightShoulder]),
  );
}

export function weightForwardFinish(
  frames: PoseFrame[],
  events: EventMap,
): number {
  const address = requireFrame(frames, events.address!, "address");
  const finish = requireFrame(frames, events.finish!, "finish");
  const stance = stanceWidth(address);
  if (stance <= 0) throw new Error("Invalid stance width");
  const left = address[KP.leftAnkle].x;
  // Fraction of stance from trail (right) toward lead (left) for RH golfer face-on:
  // hip x relative to ankles
  const hipX = midHip(finish).x;
  return Math.min(1, Math.max(0, (hipX - left) / stance));
}

/**
 * Directional kinematic sequence proxy: 1.0 when pelvis→thorax→arm peaks
 * occur in order through the downswing with sensible gaps.
 */
export function kinematicSequenceIndex(
  pelvisPeakFrame: number,
  thoraxPeakFrame: number,
  armPeakFrame: number,
): number {
  if (!(pelvisPeakFrame < thoraxPeakFrame && thoraxPeakFrame < armPeakFrame)) {
    // Count pairwise order violations
    let ok = 0;
    if (pelvisPeakFrame < thoraxPeakFrame) ok += 1;
    if (thoraxPeakFrame < armPeakFrame) ok += 1;
    if (pelvisPeakFrame < armPeakFrame) ok += 1;
    return ok / 3;
  }
  const g1 = thoraxPeakFrame - pelvisPeakFrame;
  const g2 = armPeakFrame - thoraxPeakFrame;
  // Ideal gaps ~2–12 frames at 240fps proxy; decay outside
  const gapScore = (g: number) => {
    if (g >= 2 && g <= 12) return 1;
    if (g < 2) return Math.max(0, g / 2);
    return Math.max(0, 1 - (g - 12) / 20);
  };
  return (gapScore(g1) + gapScore(g2)) / 2;
}

export function computeAllMetrics(
  frames: PoseFrame[],
  events: EventMap,
  fps: number,
  sequencePeaks?: { pelvis: number; thorax: number; arm: number },
): MetricValue[] {
  const metrics: MetricValue[] = [
    { key: "tempo_ratio", value: tempoRatio(events), unit: "ratio", phase: "full" },
    {
      key: "backswing_duration_ms",
      value: backswingDurationMs(events, fps),
      unit: "ms",
      phase: "backswing",
    },
    {
      key: "shoulder_turn_top",
      value: shoulderTurnTop(frames, events),
      unit: "deg",
      phase: "top",
    },
    {
      key: "hip_turn_top",
      value: hipTurnTop(frames, events),
      unit: "deg",
      phase: "top",
    },
    {
      key: "x_factor_top",
      value: xFactorTop(frames, events),
      unit: "deg",
      phase: "top",
    },
    {
      key: "spine_angle_address",
      value: spineAngleAddress(frames, events),
      unit: "deg",
      phase: "setup",
    },
    {
      key: "spine_angle_change",
      value: spineAngleChange(frames, events),
      unit: "deg",
      phase: "impact",
    },
    {
      key: "spine_tilt_top",
      value: spineTiltTop(frames, events),
      unit: "deg",
      phase: "top",
    },
    {
      key: "hip_depth_change_downswing",
      value: hipDepthChangeDownswing(frames, events),
      unit: "norm",
      phase: "downswing",
    },
    {
      key: "hip_lateral_backswing",
      value: hipLateralBackswing(frames, events),
      unit: "norm",
      phase: "backswing",
    },
    {
      key: "hip_lateral_downswing",
      value: hipLateralDownswing(frames, events),
      unit: "norm",
      phase: "downswing",
    },
    {
      key: "head_movement",
      value: headMovement(frames, events),
      unit: "norm",
      phase: "full",
    },
    {
      key: "lead_arm_angle_top",
      value: leadArmAngleTop(frames, events),
      unit: "deg",
      phase: "top",
    },
    {
      key: "lead_arm_angle_impact",
      value: leadArmAngleImpact(frames, events),
      unit: "deg",
      phase: "impact",
    },
    {
      key: "shoulder_plane_top",
      value: shoulderPlaneTop(frames, events),
      unit: "deg",
      phase: "top",
    },
    {
      key: "weight_forward_finish",
      value: weightForwardFinish(frames, events),
      unit: "norm",
      phase: "finish",
    },
  ];

  if (sequencePeaks) {
    metrics.push({
      key: "kinematic_sequence_index",
      value: kinematicSequenceIndex(
        sequencePeaks.pelvis,
        sequencePeaks.thorax,
        sequencePeaks.arm,
      ),
      unit: "index",
      phase: "downswing",
    });
  }

  return metrics;
}
