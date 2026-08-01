import type { PoseFrame } from "../../src/lib/metrics/geometry";
import { KP } from "../../src/lib/metrics/geometry";
import type { EventMap } from "../../src/lib/metrics/compute";

function blank(): PoseFrame {
  return Array.from({ length: 17 }, () => ({ x: 0, y: 0, c: 1 }));
}

/**
 * Deterministic synthetic swing. Geometry is chosen so expected metric
 * values are simple closed-form numbers for unit tests.
 */
export const SYNTHETIC_FPS = 240;

export const SYNTHETIC_EVENTS: EventMap = {
  address: 0,
  toe_up: 20,
  mid_backswing: 40,
  top: 60,
  mid_downswing: 75,
  impact: 80,
  mid_follow_through: 100,
  finish: 120,
};

export const SYNTHETIC_SEQUENCE_PEAKS = {
  pelvis: 70,
  thorax: 74,
  arm: 78,
};

/** Closed-form expectations from the poses below. */
export const SYNTHETIC_EXPECTED = {
  tempo_ratio: 3,
  backswing_duration_ms: 250,
  spine_angle_address: 30,
  shoulder_turn_top: 90,
  hip_turn_top: 45,
  x_factor_top: 45,
  hip_depth_change_downswing: 0.2,
  hip_lateral_backswing: 0.5,
  lead_arm_angle_top: 180,
  kinematic_sequence_index: 1,
};

function poseAddress(): PoseFrame {
  const f = blank();
  // midHip (0,0), midShoulder (50, 86.60254) → atan2(50,86.60254)=30°
  // hip width 30, shoulder width 40
  f[KP.leftHip] = { x: -15, y: 0, c: 1 };
  f[KP.rightHip] = { x: 15, y: 0, c: 1 };
  f[KP.leftShoulder] = { x: 30, y: 86.6025403784, c: 1 };
  f[KP.rightShoulder] = { x: 70, y: 86.6025403784, c: 1 };
  f[KP.leftElbow] = { x: 30, y: 126.6025403784, c: 1 };
  f[KP.leftWrist] = { x: 30, y: 166.6025403784, c: 1 };
  f[KP.rightElbow] = { x: 70, y: 126.6025403784, c: 1 };
  f[KP.rightWrist] = { x: 70, y: 166.6025403784, c: 1 };
  f[KP.nose] = { x: 50, y: 56.6025403784, c: 1 };
  f[KP.leftAnkle] = { x: -25, y: 120, c: 1 };
  f[KP.rightAnkle] = { x: 25, y: 120, c: 1 };
  f[KP.leftKnee] = { x: -20, y: 60, c: 1 };
  f[KP.rightKnee] = { x: 20, y: 60, c: 1 };
  return f;
}

function poseTop(): PoseFrame {
  const f = blank();
  // midHip shifted +15 in x → lateral / hipWidth = 15/30 = 0.5
  // shoulders vertical line → inclination 90°; address was 0° → turn 90°
  // hips at 45° inclination; address hips 0° → turn 45°
  f[KP.leftHip] = { x: 0, y: -15, c: 1 };
  f[KP.rightHip] = { x: 30, y: 15, c: 1 };
  f[KP.leftShoulder] = { x: 65, y: 66.6025403784, c: 1 };
  f[KP.rightShoulder] = { x: 65, y: 106.6025403784, c: 1 };
  // Straight lead arm 180°
  f[KP.leftElbow] = { x: 25, y: 66.6025403784, c: 1 };
  f[KP.leftWrist] = { x: -15, y: 66.6025403784, c: 1 };
  f[KP.rightElbow] = { x: 85, y: 126.6025403784, c: 1 };
  f[KP.rightWrist] = { x: 85, y: 166.6025403784, c: 1 };
  f[KP.nose] = { x: 65, y: 40, c: 1 };
  f[KP.leftAnkle] = { x: -25, y: 120, c: 1 };
  f[KP.rightAnkle] = { x: 25, y: 120, c: 1 };
  f[KP.leftKnee] = { x: -20, y: 60, c: 1 };
  f[KP.rightKnee] = { x: 20, y: 60, c: 1 };
  return f;
}

function poseImpact(): PoseFrame {
  const f = blank();
  // midHip y = 6 vs address 0 → depth 6/30 = 0.2
  f[KP.leftHip] = { x: -15, y: 6, c: 1 };
  f[KP.rightHip] = { x: 15, y: 6, c: 1 };
  f[KP.leftShoulder] = { x: 0, y: 80, c: 1 };
  f[KP.rightShoulder] = { x: 40, y: 80, c: 1 };
  // 120° elbow: vectors of equal length 40 at 120°
  f[KP.leftElbow] = { x: 40, y: 80, c: 1 };
  f[KP.leftWrist] = {
    x: 40 + 40 * Math.cos(Math.PI / 3),
    y: 80 + 40 * Math.sin(Math.PI / 3),
    c: 1,
  };
  f[KP.rightElbow] = { x: 60, y: 110, c: 1 };
  f[KP.rightWrist] = { x: 80, y: 140, c: 1 };
  f[KP.nose] = { x: 20, y: 50, c: 1 };
  f[KP.leftAnkle] = { x: -25, y: 120, c: 1 };
  f[KP.rightAnkle] = { x: 25, y: 120, c: 1 };
  f[KP.leftKnee] = { x: -20, y: 60, c: 1 };
  f[KP.rightKnee] = { x: 20, y: 60, c: 1 };
  return f;
}

function poseFinish(): PoseFrame {
  const f = poseAddress();
  // hip center at x=10; left ankle -25, stance 50 → (10-(-25))/50 = 0.7
  f[KP.leftHip] = { x: -5, y: 0, c: 1 };
  f[KP.rightHip] = { x: 25, y: 0, c: 1 };
  f[KP.nose] = { x: 10, y: 50, c: 1 };
  return f;
}

export function buildSyntheticFrames(): PoseFrame[] {
  const address = poseAddress();
  const top = poseTop();
  const impact = poseImpact();
  const finish = poseFinish();
  const frames: PoseFrame[] = [];
  for (let i = 0; i <= 120; i++) {
    if (i < 60) frames.push(structuredClone(address));
    else if (i < 80) frames.push(structuredClone(top));
    else if (i < 120) frames.push(structuredClone(impact));
    else frames.push(structuredClone(finish));
  }
  frames[0] = address;
  frames[60] = top;
  frames[80] = impact;
  frames[120] = finish;
  return frames;
}
