import { describe, expect, it } from "vitest";
import {
  SYNTHETIC_EVENTS,
  SYNTHETIC_EXPECTED,
  SYNTHETIC_FPS,
  SYNTHETIC_SEQUENCE_PEAKS,
  buildSyntheticFrames,
} from "../../../fixtures/keypoints/synthetic-swing";
import {
  backswingDurationMs,
  hipDepthChangeDownswing,
  hipLateralBackswing,
  hipTurnTop,
  kinematicSequenceIndex,
  leadArmAngleImpact,
  leadArmAngleTop,
  shoulderTurnTop,
  spineAngleAddress,
  tempoRatio,
  weightForwardFinish,
  xFactorTop,
} from "./compute";

const frames = buildSyntheticFrames();
const events = SYNTHETIC_EVENTS;

describe("metric functions against synthetic fixture", () => {
  it("tempo_ratio", () => {
    expect(tempoRatio(events)).toBeCloseTo(SYNTHETIC_EXPECTED.tempo_ratio, 5);
  });

  it("backswing_duration_ms", () => {
    expect(backswingDurationMs(events, SYNTHETIC_FPS)).toBeCloseTo(
      SYNTHETIC_EXPECTED.backswing_duration_ms,
      5,
    );
  });

  it("spine_angle_address", () => {
    expect(spineAngleAddress(frames, events)).toBeCloseTo(
      SYNTHETIC_EXPECTED.spine_angle_address,
      0,
    );
  });

  it("shoulder_turn_top", () => {
    expect(shoulderTurnTop(frames, events)).toBeCloseTo(
      SYNTHETIC_EXPECTED.shoulder_turn_top,
      0,
    );
  });

  it("hip_turn_top", () => {
    expect(hipTurnTop(frames, events)).toBeCloseTo(
      SYNTHETIC_EXPECTED.hip_turn_top,
      0,
    );
  });

  it("x_factor_top", () => {
    expect(xFactorTop(frames, events)).toBeCloseTo(
      SYNTHETIC_EXPECTED.x_factor_top,
      0,
    );
  });

  it("hip_depth_change_downswing", () => {
    expect(hipDepthChangeDownswing(frames, events)).toBeCloseTo(
      SYNTHETIC_EXPECTED.hip_depth_change_downswing,
      5,
    );
  });

  it("hip_lateral_backswing", () => {
    expect(hipLateralBackswing(frames, events)).toBeCloseTo(
      SYNTHETIC_EXPECTED.hip_lateral_backswing,
      5,
    );
  });

  it("lead_arm_angle_top", () => {
    expect(leadArmAngleTop(frames, events)).toBeCloseTo(
      SYNTHETIC_EXPECTED.lead_arm_angle_top,
      0,
    );
  });

  it("lead_arm_angle_impact is acute enough for chicken-wing territory", () => {
    expect(leadArmAngleImpact(frames, events)).toBeCloseTo(120, 0);
  });

  it("weight_forward_finish", () => {
    expect(weightForwardFinish(frames, events)).toBeCloseTo(0.7, 5);
  });

  it("kinematic_sequence_index", () => {
    expect(
      kinematicSequenceIndex(
        SYNTHETIC_SEQUENCE_PEAKS.pelvis,
        SYNTHETIC_SEQUENCE_PEAKS.thorax,
        SYNTHETIC_SEQUENCE_PEAKS.arm,
      ),
    ).toBeCloseTo(SYNTHETIC_EXPECTED.kinematic_sequence_index, 5);
  });

  it("kinematic_sequence_index decays when order is wrong", () => {
    expect(kinematicSequenceIndex(80, 70, 60)).toBeLessThan(0.5);
  });
});
