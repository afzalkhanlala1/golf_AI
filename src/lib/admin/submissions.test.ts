import { describe, expect, it } from "vitest";
import {
  groupSubmitters,
  type SubmissionRow,
} from "@/lib/admin/submissions";

function row(
  partial: Partial<SubmissionRow> & {
    userId: string;
    swingId: string;
    createdAt: Date;
  },
): SubmissionRow {
  return {
    userId: partial.userId,
    email: partial.email ?? `${partial.userId}@example.com`,
    source: partial.source ?? "upload",
    swing: {
      id: partial.swingId,
      club: partial.swing?.club ?? "7i",
      view: partial.swing?.view ?? "face_on",
      status: partial.swing?.status ?? "COMPLETE",
      blobUrl: partial.swing?.blobUrl ?? "https://example.com/a.mp4",
      createdAt: partial.createdAt,
    },
  };
}

describe("groupSubmitters", () => {
  it("groups newest-first rows into people and keeps their latest swing", () => {
    const newer = new Date("2026-08-28T12:00:00Z");
    const older = new Date("2026-08-20T12:00:00Z");
    const people = groupSubmitters([
      row({
        userId: "user_a",
        email: "a@golf.test",
        swingId: "swing-new",
        createdAt: newer,
        swing: {
          id: "swing-new",
          club: "d",
          view: "face_on",
          status: "COMPLETE",
          blobUrl: "https://example.com/new.mp4",
          createdAt: newer,
        },
      }),
      row({
        userId: "user_b",
        email: "b@golf.test",
        swingId: "swing-b",
        createdAt: older,
      }),
      row({
        userId: "user_a",
        email: "a@golf.test",
        swingId: "swing-old",
        createdAt: older,
        swing: {
          id: "swing-old",
          club: "pw",
          view: "down_the_line",
          status: "FAILED",
          blobUrl: "https://example.com/old.mp4",
          createdAt: older,
        },
      }),
    ]);

    expect(people).toHaveLength(2);
    expect(people[0]).toMatchObject({
      userId: "user_a",
      email: "a@golf.test",
      swingCount: 2,
      latestSwingId: "swing-new",
      latestStatus: "COMPLETE",
    });
    expect(people[0]?.swings.map((s) => s.id)).toEqual([
      "swing-new",
      "swing-old",
    ]);
    expect(people[1]?.userId).toBe("user_b");
    expect(people[1]?.swingCount).toBe(1);
  });

  it("returns an empty list when there are no rows", () => {
    expect(groupSubmitters([])).toEqual([]);
  });
});
