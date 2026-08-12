"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LogoMark } from "@/components/logo-mark";
import { useIntroRunner, type IntroProps } from "./shared";
import "./intro.css";

const SWING_AT = 260;
const SWING_S = 1.6;
const FLY_AT = SWING_AT + SWING_S * 1000 * 0.72; // let the ball clear, then go
const FLY_MS = 880;

export const HANDOFF_TOTAL = Math.round(FLY_AT + FLY_MS);

/** The slot the crest flies into. Put it on the page's own logo wrapper. */
export const INTRO_TARGET_ATTR = "data-intro-target";

/**
 * II. Handoff — the crest never leaves the screen.
 *
 * It swings once at 200px in the centre, then travels to the exact slot the
 * page's own crest occupies while the chrome fades up around it. Nothing
 * cuts, which is the whole trick: the splash does not end, it becomes the
 * header.
 *
 * Measured rather than hardcoded (a FLIP: read both rects, transform the
 * difference, hand over). That keeps it correct across the 38px sidebar slot
 * and the 32px phone one without knowing which is mounted. If no target is on
 * the page it hands off immediately instead of flying somewhere wrong.
 */
export function IntroHandoff({ onDone }: IntroProps) {
  const [flying, setFlying] = useState(false);
  const crest = useRef<HTMLDivElement>(null);
  const finished = useRef(false);

  const finish = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    onDone();
  }, [onDone]);

  // Backstop only — the flight below normally gets there first.
  useIntroRunner(HANDOFF_TOTAL + 120, finish);

  useEffect(() => {
    const t = window.setTimeout(() => setFlying(true), FLY_AT);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!flying) return;

    const el = crest.current;
    // A page can carry more than one slot — the shell has a 38px crest in the
    // sidebar and a 32px one in the phone header, and whichever is not in play
    // is display:none. Pick the one with layout, or the flight would aim at a
    // zero-width box and skip itself on exactly the viewport that most wants
    // the animation.
    const target = [
      ...document.querySelectorAll<HTMLElement>(`[${INTRO_TARGET_ATTR}]`),
    ].find((node) => node.getBoundingClientRect().width > 0);
    if (!el || !target) {
      finish();
      return;
    }

    const from = el.getBoundingClientRect();
    const to = target.getBoundingClientRect();
    if (!from.width || !to.width) {
      finish();
      return;
    }

    // The page's crest sits under ours for the whole flight; showing both
    // would give the landing a shadow to land on.
    const held = target.style.opacity;
    target.style.opacity = "0";

    el.style.transition = `transform ${FLY_MS}ms cubic-bezier(.66,0,.2,1)`;
    el.style.transform = [
      `translate(${to.left + to.width / 2 - (from.left + from.width / 2)}px,`,
      `${to.top + to.height / 2 - (from.top + from.height / 2)}px)`,
      `scale(${to.width / from.width})`,
    ].join(" ");

    const t = window.setTimeout(finish, FLY_MS);
    return () => {
      window.clearTimeout(t);
      target.style.opacity = held;
    };
  }, [flying, finish]);

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {/* Paper, not a brand wash — the destination is paper, so there is no
          colour to get out of the way of. */}
      <div
        className="absolute inset-0 bg-[color:var(--paper)] transition-opacity duration-[420ms] ease-out"
        style={{ opacity: flying ? 0 : 1 }}
      />

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div ref={crest} className="will-change-transform">
          <LogoMark
            size={200}
            animate
            loop={false}
            duration={SWING_S}
            delay={SWING_AT}
          />
        </div>

        <div
          className="mt-8 flex flex-col items-center"
          style={{
            animation: flying
              ? "gi-intro-drop 260ms ease-in both"
              : `gi-intro-lift 700ms cubic-bezier(.22,1,.36,1) ${SWING_AT + 180}ms both`,
          }}
        >
          <p className="gi-display text-[clamp(22px,5vw,32px)] font-medium">
            Grip Intelligence
          </p>
          <p className="mt-2.5 text-[9px] tracking-[0.28em] text-[color:var(--faint)] uppercase">
            AI Golfing Coach · Est. MMXXIV
          </p>
        </div>
      </div>
    </div>
  );
}
