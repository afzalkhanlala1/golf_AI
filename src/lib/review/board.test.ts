import { describe, expect, it } from "vitest";
import { mergeInvitesWithSubmissions } from "@/lib/review/board";

describe("mergeInvitesWithSubmissions", () => {
  it("marks who submitted and keeps outstanding coaches visible", () => {
    const invitedAt = new Date("2026-08-01T12:00:00Z");
    const submittedAt = new Date("2026-08-20T15:00:00Z");
    const rows = mergeInvitesWithSubmissions(
      [
        {
          id: "inv-a",
          name: "Jane PGA",
          codeHint: "P9QX",
          createdAt: invitedAt,
        },
        {
          id: "inv-b",
          name: "Tom Club",
          codeHint: "7K2M",
          createdAt: invitedAt,
        },
      ],
      [
        {
          inviteId: "inv-a",
          submittedAt,
          overallScore: 72,
          primaryFault: "early_extension",
          faults: ["early_extension", "loss_of_posture"],
          notes: "Hips fire early.",
          sampleId: "review-sample-v1",
        },
      ],
    );

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      name: "Jane PGA",
      submitted: true,
      overallScore: 72,
      primaryFault: "early_extension",
    });
    expect(rows[1]).toMatchObject({
      name: "Tom Club",
      submitted: false,
      overallScore: null,
      faults: [],
    });
  });
});
