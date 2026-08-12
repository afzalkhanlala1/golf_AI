"use client";

import { LogoMark } from "@/components/logo-mark";
import { GREEN_WASH, ON_GREEN, useIntroRunner, type IntroProps } from "./shared";
import "./intro.css";

/* One timeline, written once. Every element below reads its cue from here, so
   moving impact moves the wipe with it instead of leaving them a frame apart. */
const DRAW = 0; //      shield inks on
const SWING_AT = 950; // address breaks
const SWING_S = 1.8; //  full swing, seconds — impact at 36%, burst at 58%
const BURST = SWING_AT + SWING_S * 1000 * 0.58; // ≈ 1994ms
const BLOOM = BURST - 40; //                       the burst *is* the cut
const BLOOM_MS = 460;
/* The wash leaves inside the window where the bloom is fully opaque (22–38%
   of BLOOM_MS), so the swap happens behind cover rather than in view. */
const WASH_OUT = BLOOM + BLOOM_MS * 0.26;

export const DRAW_TOTAL = Math.round(BLOOM + BLOOM_MS);

/**
 * I. The Draw — the full crest sequence.
 *
 * Deep green wash. The shield inks itself on, the rings follow, the golfer
 * arrives with the last stroke and takes one swing. The burst at the apex of
 * the ball flight blooms into the page's own background colour and the wash
 * is gone behind it.
 *
 * The most on-brand of the five: it is the marketing hero's crest, played
 * once and at speed, rather than a new piece of motion language.
 */
export function IntroDraw({ onDone }: IntroProps) {
  useIntroRunner(DRAW_TOTAL, onDone);

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div
        className="absolute inset-0 flex flex-col items-center justify-center"
        style={{
          background: GREEN_WASH,
          animation: `gi-intro-out 1ms steps(1, end) ${WASH_OUT}ms both`,
        }}
      >
        <div style={ON_GREEN}>
          <LogoMark
            size={200}
            draw
            drawDelay={DRAW}
            animate
            loop={false}
            duration={SWING_S}
            delay={SWING_AT}
          />
        </div>

        <p
          className="gi-display mt-9 text-[clamp(22px,5vw,34px)] font-medium whitespace-nowrap text-[#f2f7f3]"
          style={{
            animation: `gi-intro-tighten 900ms cubic-bezier(.22,1,.36,1) ${SWING_AT + 320}ms both`,
          }}
        >
          Grip Intelligence
        </p>

        <span
          className="mt-5 block h-px w-[132px] origin-center bg-[#cfe3d6]/45"
          style={{
            animation: `gi-intro-rule-out 620ms cubic-bezier(.22,1,.36,1) ${SWING_AT + 620}ms both`,
          }}
        />

        <p
          className="mt-4 text-[9px] tracking-[0.3em] text-[#cfe3d6]/70 uppercase"
          style={{
            animation: `gi-fade 500ms ease ${SWING_AT + 780}ms both`,
          }}
        >
          AI Golfing Coach · Est. MMXXIV
        </p>
      </div>

      {/* Blooms in --paper, so it lands on the page rather than on white. */}
      <div
        className="absolute inset-0 bg-[color:var(--paper)]"
        style={{
          opacity: 0,
          animation: `gi-intro-bloom ${BLOOM_MS}ms ease-out ${BLOOM}ms both`,
        }}
      />
    </div>
  );
}
