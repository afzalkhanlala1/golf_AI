"use client";

import { LogoMark } from "@/components/logo-mark";
import { GREEN_WASH, useIntroRunner, type IntroProps } from "./shared";
import "./intro.css";

const SWING_AT = 300;
const SWING_S = 1.5;
const IMPACT = SWING_AT + SWING_S * 1000 * 0.36; // 840ms — contact
const FLASH_MS = 300;
const STREAK_AT = IMPACT + 15;
const CURTAIN_AT = IMPACT + 80;
const CURTAIN_MS = 880;
/*
 * The curtain keyframe holds at translateY(0) from 46% to 60% of its run, so
 * anywhere in that band it is provably covering the viewport whatever the
 * easing does. Cutting the paper underneath at 53% therefore lands mid-plateau
 * with ~60ms of slack either side, rather than on the single frame a
 * constant-speed sweep would have given.
 */
const CURTAIN_EASE = "cubic-bezier(.45,0,.55,1)";
const COVERED = CURTAIN_AT + CURTAIN_MS * 0.53;

export const IMPACT_TOTAL = Math.round(CURTAIN_AT + CURTAIN_MS);

/**
 * III. Impact wipe — the whole splash is built around one frame.
 *
 * Nothing moves but the club. At contact the screen takes a single frame of
 * green, the ball's line is redrawn at viewport scale, and a curtain follows
 * it off the top-right corner, dragging the page in behind.
 *
 * The streak is anchored to the tee inside the crest (71.5%, 70% of the
 * viewBox), so it leaves from where the ball actually was rather than from a
 * corner that happens to look close.
 */
export function IntroImpact({ onDone }: IntroProps) {
  useIntroRunner(IMPACT_TOTAL, onDone);

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Paper and crest — gone by the time the curtain has cleared them. */}
      <div
        className="absolute inset-0 flex items-center justify-center bg-[color:var(--paper)]"
        style={{
          animation: `gi-intro-out 1ms steps(1, end) ${COVERED}ms both`,
        }}
      >
        <div className="relative h-[200px] w-[200px]">
          <LogoMark
            size={200}
            animate
            loop={false}
            duration={SWING_S}
            delay={SWING_AT}
          />

          {/* The ball's line, at viewport scale. Leaves the tee going up and
              right, matching the crest's own flight path.

              Two elements, because one cannot carry both: the keyframe owns
              `transform` outright, so the aim has to live on a wrapper or the
              animation would flatten it back to horizontal. */}
          <span
            className="absolute origin-left"
            style={{ left: "71.5%", top: "70%", transform: "rotate(-32deg)" }}
          >
            <span
              className="block h-[2px] origin-left rounded-full"
              style={{
                width: "220vmax",
                background:
                  "linear-gradient(90deg, rgba(31,90,63,.95), rgba(31,90,63,0))",
                animation: `gi-intro-streak 620ms cubic-bezier(.12,.7,.25,1) ${STREAK_AT}ms both`,
              }}
            />
          </span>

          <p className="gi-display absolute top-[calc(100%+34px)] left-1/2 -translate-x-1/2 text-[26px] font-medium whitespace-nowrap">
            Grip Intelligence
          </p>
        </div>
      </div>

      {/* One frame of contact. */}
      <div
        className="absolute inset-0"
        style={{
          background: GREEN_WASH,
          opacity: 0,
          animation: `gi-intro-hit ${FLASH_MS}ms linear ${IMPACT}ms both`,
        }}
      />

      {/* Oversized so a 28° rotation still clears the corners on any aspect
          ratio — the plateau makes the extra travel cost nothing. */}
      <div
        className="absolute inset-[-75%]"
        style={{
          background: GREEN_WASH,
          animation: `gi-intro-curtain ${CURTAIN_MS}ms ${CURTAIN_EASE} ${CURTAIN_AT}ms both`,
        }}
      />
    </div>
  );
}
