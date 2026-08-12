"use client";

import { useCallback, useEffect, useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { INTRO_VARIANTS } from "./registry";
import { IntroStage } from "./intro-stage";

/**
 * The bench: the stage is always mounted, and playing a variant drops its
 * overlay on top of it. That is deliberately the same arrangement the real
 * mount would use, so what you judge here is what would ship — in particular
 * variant II can only be judged against a real crest to land on.
 *
 * Controls unmount during playback. There is no on-screen skip button because
 * the intros themselves take any tap or key as a skip, and a button floating
 * over a splash would be the one thing you cannot un-see while judging it.
 */
export function IntroLab() {
  const [playing, setPlaying] = useState<string | null>(null);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const q = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(q.matches);
    sync();
    q.addEventListener("change", sync);
    return () => q.removeEventListener("change", sync);
  }, []);

  const stop = useCallback(() => setPlaying(null), []);

  const active = INTRO_VARIANTS.find((v) => v.id === playing);
  const Active = active?.Component;

  return (
    <>
      <IntroStage />

      {Active ? <Active key={active.id} onDone={stop} /> : null}

      {!playing ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[color:var(--rule)] bg-[color:var(--surface)]/95 backdrop-blur-md">
          <div className="mx-auto max-w-[1120px] px-5 py-4 sm:px-8">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div>
                <p className="gi-kicker">Intro lab · not linked, not indexed</p>
                <p className="mt-1.5 text-[12px] text-[color:var(--muted)]">
                  Pick one to play it over the shell. Any tap or key skips.
                </p>
              </div>
              <ThemeToggle />
            </div>

            {reduced ? (
              <p className="mt-3 border-l-2 border-[color:var(--warn)] pl-3 text-[12px] text-[color:var(--muted)]">
                Reduced motion is on in your OS. Every animation is disabled
                app-wide, so each intro will render its end state and route
                straight through — the timings below still apply.
              </p>
            ) : null}

            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              {INTRO_VARIANTS.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setPlaying(v.id)}
                  className="group gi-panel flex flex-col gap-1.5 p-3 text-left transition hover:border-[color:var(--green)]"
                >
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="gi-display text-[15px] font-medium">
                      <span className="mr-1.5 text-[color:var(--faint)]">
                        {v.numeral}
                      </span>
                      {v.name}
                    </span>
                    <span className="shrink-0 text-[10px] tabular-nums text-[color:var(--faint)]">
                      {(v.ms / 1000).toFixed(2)}s
                    </span>
                  </span>
                  <span className="text-[11.5px] leading-[1.55] text-[color:var(--muted)]">
                    {v.blurb}
                  </span>
                  <span className="mt-0.5 border-t border-[color:var(--rule)] pt-1.5 text-[11px] leading-[1.5] text-[color:var(--faint)]">
                    {v.note}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
