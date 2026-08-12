"use client";

import { LogoMark, LogoWord } from "@/components/logo-mark";
import { NAV_PRIMARY } from "@/components/nav-items";
import { INTRO_TARGET_ATTR } from "./intro-handoff";

/**
 * The page each intro flows into.
 *
 * A still of the app shell rather than the shell itself — the real one is a
 * server component that reads a swing count and a Clerk session, neither of
 * which belongs in a motion test. What has to be exact is the crest: 38px, in
 * the sidebar's identity block, carrying the handoff target. Get that wrong
 * and variant II lands somewhere the real app would not put it.
 */
export function IntroStage() {
  return (
    <div className="min-h-screen bg-[color:var(--paper)] lg:grid lg:grid-cols-[264px_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-screen flex-col self-start border-r border-[color:var(--rule)] bg-[color:var(--surface)] lg:flex">
        <div className="border-b border-[color:var(--rule)] px-[22px] pt-[26px] pb-5">
          <div className="flex items-center gap-[11px]">
            {/* The slot variant II measures and flies into. */}
            <span {...{ [INTRO_TARGET_ATTR]: "" }} className="flex">
              <LogoMark size={38} />
            </span>
            <LogoWord />
          </div>
        </div>

        <nav className="flex flex-col py-2">
          {NAV_PRIMARY.map((item, i) => (
            <span
              key={item.href}
              className={`flex items-baseline justify-between px-[22px] py-[9px] text-[13.5px] ${
                i === 0
                  ? "text-[color:var(--green)]"
                  : "text-[color:var(--muted)]"
              }`}
            >
              {item.label}
              <span className="text-[9px] tracking-[0.18em] text-[color:var(--faint)] uppercase">
                {item.note}
              </span>
            </span>
          ))}
        </nav>

        <div className="mt-auto px-[22px] pb-[18px]">
          <span className="block w-full rounded-[3px] border border-[color:var(--green)] px-3.5 py-2.5 text-center text-[13px] font-semibold tracking-[0.03em] text-[color:var(--green)]">
            Upload a swing
          </span>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        {/* Phone header — the sidebar's identity block, compressed. On a
            narrow viewport this is the crest the handoff finds. */}
        <div className="flex items-center gap-3 border-b border-[color:var(--rule)] bg-[color:var(--surface)] px-5 py-3.5 lg:hidden">
          <span className="flex min-w-0 items-center gap-2.5">
            <span {...{ [INTRO_TARGET_ATTR]: "" }} className="flex">
              <LogoMark size={32} />
            </span>
            <span className="gi-display truncate text-[18px] font-semibold">
              Grip Intelligence
            </span>
          </span>
        </div>

        <main className="mx-auto w-full max-w-[900px] px-5 py-10 sm:px-8">
          <p className="gi-kicker">Dashboard · Overview</p>
          <h1 className="gi-title">Your swing, read back to you.</h1>
          <p className="gi-lede">
            A still of the app shell, here so each intro has something real to
            hand off to. Nothing on this page is wired up.
          </p>

          <div className="mt-10 grid gap-8 border-t border-b border-[color:var(--rule-strong)] py-8 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-center sm:gap-[34px]">
            <div>
              <p className="gi-kicker">Swing score · sample</p>
              <p className="gi-figure mt-2 text-[76px]">78</p>
              <p className="mt-3 text-[12px] text-[color:var(--muted)]">
                7-iron · face-on · 8 of 10 checks
              </p>
            </div>
            <div className="flex flex-col gap-3">
              {[
                ["Early extension", "Hips toward the ball through P6"],
                ["Reverse spine angle", "Upper body away from target at top"],
                ["Chicken wing", "Lead arm folding past impact"],
              ].map(([fault, detail]) => (
                <div
                  key={fault}
                  className="gi-row flex items-baseline justify-between gap-4 pb-2.5"
                >
                  <span className="text-[13.5px]">{fault}</span>
                  <span className="text-right text-[12px] text-[color:var(--faint)]">
                    {detail}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
