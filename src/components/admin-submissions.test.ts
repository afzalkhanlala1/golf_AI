import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SubmitterList } from "@/components/admin-submissions";
import type { Submitter } from "@/lib/admin/submissions";

const person: Submitter = {
  userId: "user_abc",
  email: "golfer@example.com",
  swingCount: 1,
  latestAt: new Date("2026-08-28T15:00:00Z"),
  latestStatus: "COMPLETE",
  latestSwingId: "swing-1",
  swings: [
    {
      id: "swing-1",
      club: "7i",
      view: "face_on",
      status: "COMPLETE",
      blobUrl: "https://example.com/real.mp4",
      createdAt: new Date("2026-08-28T15:00:00Z"),
    },
  ],
};

describe("SubmitterList", () => {
  it("shows the person and a link to their clip", () => {
    const html = renderToStaticMarkup(
      createElement(SubmitterList, {
        title: "Own videos",
        note: "1 clip",
        people: [person],
        empty: "No one has uploaded.",
      }),
    );
    expect(html).toContain("golfer@example.com");
    expect(html).toContain("user_abc");
    expect(html).toContain("/swings/swing-1");
    expect(html).toContain("https://example.com/real.mp4");
    expect(html).not.toContain("No one has uploaded.");
  });

  it("shows the empty copy when nobody submitted", () => {
    const html = renderToStaticMarkup(
      createElement(SubmitterList, {
        title: "Own videos",
        note: "0 clips",
        people: [],
        empty: "No one has uploaded.",
      }),
    );
    expect(html).toContain("No one has uploaded.");
    expect(html).not.toContain("golfer@example.com");
  });
});
