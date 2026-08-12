"use client";

import type { ComponentType } from "react";
import type { IntroProps } from "./shared";
import { DRAW_TOTAL, IntroDraw } from "./intro-draw";
import { HANDOFF_TOTAL, IntroHandoff } from "./intro-handoff";
import { IMPACT_TOTAL, IntroImpact } from "./intro-impact";
import { IntroLedger, LEDGER_TOTAL } from "./intro-ledger";
import { IntroSlam, SLAM_TOTAL } from "./intro-slam";

export type IntroVariant = {
  id: string;
  numeral: string;
  name: string;
  /** What it does, in the terms the design conversation used. */
  blurb: string;
  /** The honest trade — read this before picking one. */
  note: string;
  ms: number;
  Component: ComponentType<IntroProps>;
};

export const INTRO_VARIANTS: IntroVariant[] = [
  {
    id: "draw",
    numeral: "I",
    name: "The Draw",
    blurb:
      "Green wash. The shield inks itself on, the rings follow, one swing, and the burst at the apex blooms into the page.",
    note: "Most on-brand. It is the hero crest played once and at speed, not a new motion language.",
    ms: DRAW_TOTAL,
    Component: IntroDraw,
  },
  {
    id: "handoff",
    numeral: "II",
    name: "Handoff",
    blurb:
      "The crest swings once at 200px, then travels to the exact slot the page's own crest occupies while the chrome fades up around it.",
    note: "Nothing cuts — the splash becomes the header. Measured at runtime, so it needs a [data-intro-target] on the page.",
    ms: HANDOFF_TOTAL,
    Component: IntroHandoff,
  },
  {
    id: "impact",
    numeral: "III",
    name: "Impact wipe",
    blurb:
      "Everything holds still but the club. At contact: one frame of green, the ball's line at viewport scale, a curtain off the top-right.",
    note: "Built around a single moment rather than a sequence. The fastest of the paper-based three.",
    ms: IMPACT_TOTAL,
    Component: IntroImpact,
  },
  {
    id: "ledger",
    numeral: "IV",
    name: "Ledger unfurl",
    blurb:
      "Hairlines close a frame, the crest inks itself inside it, the kicker sets a character at a time. The frame then pushes out to become the page's borders.",
    note: "No swing at all. Treats the brand as a masthead — quiet, and the most distinctive of the five.",
    ms: LEDGER_TOTAL,
    Component: IntroLedger,
  },
  {
    id: "slam",
    numeral: "V",
    name: "Slam",
    blurb:
      "Black. Crest oversized and off-centre with two frames of overshoot, wordmark hard-cut and cropped by the edge, green sweep through.",
    note: "The Puma reading. A brand decision, not a page one — it fights the serif marketing hero unless the app follows it.",
    ms: SLAM_TOTAL,
    Component: IntroSlam,
  },
];

export function introById(id: string): IntroVariant | undefined {
  return INTRO_VARIANTS.find((v) => v.id === id);
}
