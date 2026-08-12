"use client";

import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";

/**
 * Every intro is the same shape: it paints over the app, runs a fixed
 * timeline, and calls `onDone` once. The host decides what "done" means —
 * unmount the overlay, navigate, mark the session.
 */
export type IntroProps = {
  onDone: () => void;
};

/**
 * Arms the end-of-timeline timer and the escape hatches. Any tap or key ends
 * the intro early, which is the difference between a splash and an obstacle
 * on the third launch of the day.
 *
 * Skip listeners arm after a beat so the click that started the intro — or a
 * double-click on a replay button — cannot immediately dismiss it.
 */
export function useIntroRunner(totalMs: number, onDone: () => void) {
  const done = useRef(false);

  useEffect(() => {
    const finish = () => {
      if (done.current) return;
      done.current = true;
      onDone();
    };

    const end = window.setTimeout(finish, totalMs);
    const arm = window.setTimeout(() => {
      window.addEventListener("keydown", finish);
      window.addEventListener("pointerdown", finish);
    }, 260);

    return () => {
      window.clearTimeout(end);
      window.clearTimeout(arm);
      window.removeEventListener("keydown", finish);
      window.removeEventListener("pointerdown", finish);
    };
  }, [totalMs, onDone]);
}

/**
 * The crest reads its colours from CSS custom properties, so re-declaring
 * those properties on any ancestor recolours the mark without the component
 * knowing. That is how the same `LogoMark` sits on paper, on deep green and
 * on black.
 *
 * `--green` carries the shield, rings and ground; `--ink` the golfer;
 * `--surface` the ball and its trail; `--none` the phantom ring arc.
 */
export const ON_GREEN: CSSProperties = {
  "--green": "#cfe3d6",
  "--ink": "#ffffff",
  "--surface": "#ffffff",
  "--none": "rgba(255,255,255,0.22)",
} as CSSProperties;

export const ON_BLACK: CSSProperties = {
  "--green": "#0aa863",
  "--ink": "#ffffff",
  "--surface": "#ffffff",
  "--none": "rgba(255,255,255,0.18)",
} as CSSProperties;

/**
 * The brand green, written out rather than read from `--green`. In dark mode
 * the token lightens to #8fd0ac so the accent survives a dark surface — right
 * for a control, wrong for a full-bleed wash, which would go pastel.
 */
export const GREEN_WASH = "#1f5a3f";
export const BLACK_WASH = "#07100b";

/**
 * Shows an intro at most once per browser session. Not used by the lab, which
 * has to be able to replay — this is for the real mount.
 *
 *   if (shouldPlayIntro()) setIntro(true);
 */
export function shouldPlayIntro(key = "gi-intro-seen"): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (window.sessionStorage.getItem(key)) return false;
    window.sessionStorage.setItem(key, "1");
    return true;
  } catch {
    // Private mode with storage disabled — better to skip than to throw.
    return false;
  }
}
