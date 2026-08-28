import { describe, expect, it } from "vitest";
import {
  DEMO_VIDEO_URL,
  isCannedDemoUrl,
  sourceForNewSwing,
} from "@/lib/demos";

describe("sourceForNewSwing", () => {
  it("tags an explicit demo payload as demo", () => {
    expect(
      sourceForNewSwing({
        isDemo: true,
        blobUrl: DEMO_VIDEO_URL,
      }),
    ).toBe("demo");
  });

  it("tags a real upload as upload", () => {
    expect(
      sourceForNewSwing({
        isDemo: false,
        blobUrl: "https://blob.vercel-storage.com/swing.mp4",
      }),
    ).toBe("upload");
  });

  it("treats the canned placeholder URL as a demo even without the flag", () => {
    expect(
      sourceForNewSwing({
        isDemo: false,
        blobUrl: DEMO_VIDEO_URL,
      }),
    ).toBe("demo");
    expect(isCannedDemoUrl(DEMO_VIDEO_URL)).toBe(true);
  });
});
