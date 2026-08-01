/** Placeholder clip for demo runs — analysis is mock; video is only for the player. */
export const DEMO_VIDEO_URL =
  "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";

export const DEMO_SWINGS = [
  {
    id: "good",
    club: "good-demo",
    title: "Good swing",
    description: "Clean metrics, no major faults. High overall score.",
  },
  {
    id: "early_extension",
    club: "7i",
    title: "Early extension",
    description: "Hips thrust toward the ball — primary fault + posture loss.",
  },
  {
    id: "low_fps",
    club: "reject-demo",
    title: "Low FPS reject",
    description: "Simulates a 30fps clip that gets rejected with refilm advice.",
  },
] as const;

export type DemoId = (typeof DEMO_SWINGS)[number]["id"];
