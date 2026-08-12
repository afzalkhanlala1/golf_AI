"use client";

import type { CSSProperties } from "react";
import { LogoMark } from "@/components/logo-mark";
import { useIntroRunner, type IntroProps } from "./shared";
import "./intro.css";

const RULES_AT = 0;
const RULES_MS = 560;
const CREST_AT = 380;
const WORD_AT = 900;
const KICKER = "AI GOLFING COACH · EST. MMXXIV";
const KICKER_AT = 1080;
const KICKER_MS = 760;
const OUT_AT = 1620;
const OUT_MS = 560;

export const LEDGER_TOTAL = OUT_AT + OUT_MS;

/**
 * IV. Ledger unfurl — the editorial reading.
 *
 * Four hairlines draw in from the edges and close a frame; the crest inks
 * itself inside it; the kicker sets a character at a time. Then the frame
 * pushes outward to the viewport edges and becomes the page's own borders —
 * the sidebar rule, the header rule — rather than fading away.
 *
 * No swing anywhere in it. This is the option that treats the brand as a
 * masthead instead of a sport mark, and the restraint is the point.
 */
export function IntroLedger({ onDone }: IntroProps) {
  useIntroRunner(LEDGER_TOTAL, onDone);

  /** Distance each rule travels to reach its edge — the frame's own inset. */
  const inset = "clamp(22px, 6vw, 92px)";

  const rule = (edge: "t" | "b" | "l" | "r", delay: number) => {
    const horizontal = edge === "t" || edge === "b";
    return {
      className: [
        "absolute bg-[color:var(--rule-strong)]",
        horizontal ? "left-0 h-px w-full origin-center" : "top-0 w-px h-full origin-center",
        edge === "t" && "top-0",
        edge === "b" && "bottom-0",
        edge === "l" && "left-0",
        edge === "r" && "right-0",
      ]
        .filter(Boolean)
        .join(" "),
      style: {
        animation: [
          `${horizontal ? "gi-intro-ruleh" : "gi-intro-rulev"} ${RULES_MS}ms cubic-bezier(.22,1,.36,1) ${delay}ms both`,
          // `forwards`, not `both`. Both animations write `transform`, and a
          // backwards fill on the second would apply its start value from
          // frame one — overriding the draw-in and showing the rules already
          // there. Forwards keeps it silent until its turn.
          `gi-intro-edge-${edge} ${OUT_MS}ms cubic-bezier(.5,0,.2,1) ${OUT_AT}ms forwards`,
        ].join(", "),
      } as CSSProperties,
    };
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden bg-[color:var(--paper)]"
      style={{
        animation: `gi-intro-out 320ms ease-out ${OUT_AT + 240}ms both`,
      }}
    >
      <div
        className="absolute"
        style={
          {
            inset,
            // Read by the gi-intro-edge-* keyframes, so each rule travels
            // exactly as far as the frame is inset and lands flush on the
            // viewport edge at any width.
            "--gi-inset": inset,
          } as CSSProperties
        }
      >
        <span {...rule("t", RULES_AT)} />
        <span {...rule("b", RULES_AT + 60)} />
        <span {...rule("l", RULES_AT + 130)} />
        <span {...rule("r", RULES_AT + 190)} />

        <div className="flex h-full flex-col items-center justify-center">
          <LogoMark size={132} draw drawDelay={CREST_AT} />

          <p
            className="gi-display mt-8 text-[clamp(24px,5vw,36px)] font-medium whitespace-nowrap"
            style={{
              animation: `gi-intro-lift 640ms cubic-bezier(.22,1,.36,1) ${WORD_AT}ms both`,
            }}
          >
            Grip Intelligence
          </p>

          {/* Clipped to its own box and stepped once per character, so a glyph
              is either set or not yet set — never caught mid-fade. */}
          <p
            className="mt-4 text-[9.5px] tracking-[0.28em] whitespace-nowrap text-[color:var(--faint)] tabular-nums"
            style={{
              clipPath: "inset(0 100% 0 0)",
              animation: `gi-intro-set ${KICKER_MS}ms steps(${KICKER.length}, end) ${KICKER_AT}ms both`,
            }}
          >
            {KICKER}
          </p>
        </div>
      </div>
    </div>
  );
}
