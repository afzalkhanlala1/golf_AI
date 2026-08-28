import { describe, expect, it } from "vitest";
import { CoachReviewLabels } from "@/lib/review/labels";

describe("CoachReviewLabels", () => {
  it("accepts a labelled sample", () => {
    const parsed = CoachReviewLabels.parse({
      overallScore: 64,
      primaryFault: "early_extension",
      faults: ["early_extension", "loss_of_posture"],
      notes: "Hips fire toward the ball before the arms drop.",
    });
    expect(parsed.primaryFault).toBe("early_extension");
  });

  it("rejects a score outside 0–100", () => {
    expect(() =>
      CoachReviewLabels.parse({
        overallScore: 140,
        primaryFault: "none",
        faults: [],
        notes: "",
      }),
    ).toThrow();
  });
});
