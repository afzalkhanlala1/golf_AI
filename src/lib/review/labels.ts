import { z } from "zod";
import { FaultCode } from "../../../contract/analysis.schema";

export const REVIEW_SAMPLE_ID = "review-sample-v1";

export const FAULT_CODES = FaultCode.options;

export const FAULT_LABELS: Record<(typeof FAULT_CODES)[number], string> = {
  s_posture: "S-posture",
  c_posture: "C-posture",
  loss_of_posture: "Loss of posture",
  flat_shoulder_plane: "Flat shoulder plane",
  early_extension: "Early extension",
  over_the_top: "Over the top",
  sway: "Sway",
  slide: "Slide",
  reverse_spine_angle: "Reverse spine angle",
  hanging_back: "Hanging back",
  casting: "Casting",
  chicken_wing: "Chicken wing",
};

export const CoachReviewLabels = z.object({
  overallScore: z.number().int().min(0).max(100),
  primaryFault: z.union([FaultCode, z.literal("none")]),
  faults: z.array(FaultCode),
  notes: z.string().max(2000),
});

export type CoachReviewLabels = z.infer<typeof CoachReviewLabels>;

export function faultLabel(code: string): string {
  return FAULT_LABELS[code as keyof typeof FAULT_LABELS] ?? code.replaceAll("_", " ");
}

export function sampleVideoUrl(): string | null {
  const dedicated = process.env.COACH_REVIEW_SAMPLE_URL?.trim();
  if (dedicated) return dedicated;
  const smoke = process.env.SMOKE_VIDEO_URL?.trim();
  return smoke || null;
}
