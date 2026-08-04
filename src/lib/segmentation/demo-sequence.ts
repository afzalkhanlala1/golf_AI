/**
 * A synthetic, anatomically-plausible swing used to exercise the segmentation
 * renderer with no video and no GPU. This is a rendering/plumbing fixture —
 * it is not a real swing and must never be presented as analysis.
 */

import { KP, type PoseFrame } from "@/lib/metrics/geometry";

const WIDTH = 480;
const HEIGHT = 640;
const FPS = 30;
const FRAMES = 90;

type Rig = {
  /** Fraction of the backswing→downswing cycle, 0..1. */
  t: number;
};

function pose({ t }: Rig): PoseFrame {
  const f: PoseFrame = Array.from({ length: 17 }, () => ({ x: 0, y: 0, c: 0 }));

  // Swing phase: 0 → address, 0.45 → top, 0.7 → impact, 1 → finish.
  // Arm sweep angle drives the hands; the body rotates a lesser amount.
  const armAngle =
    t < 0.45
      ? -(t / 0.45) * 2.6 // backswing: hands rise behind
      : t < 0.7
        ? -2.6 + ((t - 0.45) / 0.25) * 3.4 // downswing: fast sweep through
        : 0.8 + ((t - 0.7) / 0.3) * 1.6; // follow-through

  const turn = Math.sin(armAngle * 0.35) * 12; // torso counter-rotation, px
  const hipShift = Math.sin(armAngle * 0.3) * 6;

  const cx = WIDTH / 2;
  const shoulderY = 250;
  const hipY = 360;
  const halfShoulder = 46;
  const halfHip = 30;

  f[KP.nose] = { x: cx + turn * 0.3, y: 190, c: 0.95 };

  f[KP.leftShoulder] = { x: cx - halfShoulder + turn, y: shoulderY, c: 0.94 };
  f[KP.rightShoulder] = { x: cx + halfShoulder + turn, y: shoulderY, c: 0.94 };

  f[KP.leftHip] = { x: cx - halfHip + hipShift, y: hipY, c: 0.93 };
  f[KP.rightHip] = { x: cx + halfHip + hipShift, y: hipY, c: 0.93 };

  // Hands travel on an arc around the upper chest — the visible "swing".
  const pivotX = cx + turn;
  const pivotY = shoulderY + 10;
  const armLen = 86;
  const handX = pivotX + Math.sin(armAngle) * armLen;
  const handY = pivotY + Math.cos(armAngle) * armLen;

  // Elbows sit partway along the arm arc, slightly inside it.
  const elbowT = 0.55;
  const lElbowX = pivotX - 14 + (handX - pivotX) * elbowT;
  const lElbowY = pivotY + (handY - pivotY) * elbowT;
  const rElbowX = pivotX + 14 + (handX - pivotX) * elbowT;
  const rElbowY = pivotY + (handY - pivotY) * elbowT;

  f[KP.leftElbow] = { x: lElbowX, y: lElbowY, c: 0.88 };
  f[KP.rightElbow] = { x: rElbowX, y: rElbowY, c: 0.88 };
  f[KP.leftWrist] = { x: handX - 8, y: handY, c: 0.9 };
  f[KP.rightWrist] = { x: handX + 8, y: handY, c: 0.9 };

  // Legs stay planted, flexing slightly with the hip shift.
  f[KP.leftKnee] = { x: cx - 30 + hipShift * 0.5, y: 470, c: 0.9 };
  f[KP.rightKnee] = { x: cx + 30 + hipShift * 0.5, y: 470, c: 0.9 };
  f[KP.leftAnkle] = { x: cx - 34, y: 580, c: 0.9 };
  f[KP.rightAnkle] = { x: cx + 34, y: 580, c: 0.9 };

  return f;
}

export function buildDemoSequence(): {
  frames: PoseFrame[];
  fps: number;
  width: number;
  height: number;
} {
  const frames: PoseFrame[] = [];
  for (let i = 0; i < FRAMES; i++) {
    frames.push(pose({ t: i / (FRAMES - 1) }));
  }
  return { frames, fps: FPS, width: WIDTH, height: HEIGHT };
}
