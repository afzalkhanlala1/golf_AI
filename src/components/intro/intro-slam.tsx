"use client";

import { LogoMark } from "@/components/logo-mark";
import { BLACK_WASH, ON_BLACK, useIntroRunner, type IntroProps } from "./shared";
import "./intro.css";

const CREST_AT = 100;
const CREST_MS = 560;
const LINE_1 = 400;
const LINE_2 = 480;
const SWEEP_AT = 540;
const SWEEP_MS = 520;
const OUT_AT = 1060;
const OUT_MS = 320;

export const SLAM_TOTAL = OUT_AT + OUT_MS;

/**
 * V. Slam — the sport-brand reading.
 *
 * Black, oversized, off-centre, cropped by the viewport edge. The crest
 * arrives with two frames of overshoot, the wordmark hard-cuts in stacked and
 * runs off the right edge, and a green bar sweeps through. Just over a
 * second, no easing in anywhere.
 *
 * This one is a brand decision rather than a page decision: it is loud in a
 * way the serif marketing hero is not, and it only works if the rest of the
 * app follows it.
 */
export function IntroSlam({ onDone }: IntroProps) {
  useIntroRunner(SLAM_TOTAL, onDone);

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden"
      style={{
        background: BLACK_WASH,
        animation: `gi-intro-blackout ${SLAM_TOTAL}ms linear both`,
      }}
    >
      <div className="absolute inset-0 flex flex-col justify-center pl-[7vw]">
        <div
          style={{
            ...ON_BLACK,
            animation: `gi-intro-slam ${CREST_MS}ms cubic-bezier(.16,.9,.28,1) ${CREST_AT}ms both`,
          }}
        >
          <LogoMark size={116} />
        </div>

        {/* Set to run past the right edge — the crop is the composition, so
            it must not be allowed to wrap or shrink to fit. */}
        <div className="mt-7 -ml-[0.06em] leading-[0.86] whitespace-nowrap">
          <p
            className="gi-display text-[clamp(72px,19vw,210px)] font-semibold tracking-[-0.02em] text-white uppercase"
            style={{
              animation: `gi-intro-cut 1ms steps(1, end) ${LINE_1}ms both`,
            }}
          >
            Grip
          </p>
          <p
            className="gi-display text-[clamp(72px,19vw,210px)] font-semibold tracking-[-0.02em] text-[#0aa863] uppercase"
            style={{
              animation: `gi-intro-cut 1ms steps(1, end) ${LINE_2}ms both`,
            }}
          >
            Intelligence
          </p>
        </div>
      </div>

      <div
        className="pointer-events-none absolute inset-y-0 -left-1/4 w-1/2"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(10,168,99,.14) 30%, rgba(10,168,99,.5) 50%, rgba(10,168,99,.14) 70%, transparent)",
          animation: `gi-intro-sweep ${SWEEP_MS}ms cubic-bezier(.5,0,.3,1) ${SWEEP_AT}ms both`,
        }}
      />
    </div>
  );
}
