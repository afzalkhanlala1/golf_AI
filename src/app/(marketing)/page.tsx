import Link from "next/link";
import { Button } from "@/components/ui/button";

const STEPS = [
  {
    n: "01",
    title: "Film it slow",
    body: "Your phone's native slow-motion camera — 120fps or higher gets the sharpest read on impact.",
  },
  {
    n: "02",
    title: "Upload the clip",
    body: "Straight to storage, never through a browser recorder. Face-on or down-the-line.",
  },
  {
    n: "03",
    title: "Pose + events run",
    body: "RTMPose tracks 17 body points across all eight GolfDB swing events, address to finish.",
  },
  {
    n: "04",
    title: "Read the receipts",
    body: "A phase-scored breakdown, TPI faults with the metric that triggered each one, and one thing to work on.",
  },
];

const TRUST_CARDS = [
  {
    title: "Attribution, not just a number",
    body: "Every phase score expands into the exact metrics behind it — value, target band, confidence. Disagree with a score and you can see why it landed there.",
  },
  {
    title: "TPI Big 12 fault language",
    body: "Faults are named the way certified coaches already talk about them — early extension, reverse spine angle, chicken wing — not a proprietary scoring gimmick.",
  },
  {
    title: "The LLM explains. It never measures.",
    body: "Coaching text is generated from structured findings only, then validated so it can't cite a number that wasn't actually measured.",
  },
  {
    title: "Honest about the camera",
    body: "Single-camera video has real limits. When confidence is low or the angle is off, we say so instead of showing a confident wrong answer.",
  },
];

export default function MarketingHomePage() {
  return (
    <main className="relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 -z-10 h-[70vh] bg-[radial-gradient(ellipse_at_top,_#cfe0d4_0%,_transparent_60%)]" />

      <section className="mx-auto grid w-full max-w-6xl gap-12 px-6 pt-20 pb-16 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:pt-28">
        <div>
          <p className="animate-fade-up text-sm font-medium tracking-[0.22em] text-[color:var(--sand)] uppercase">
            Slow-motion swing lab
          </p>
          <h1
            className="animate-fade-up mt-4 max-w-xl font-[family-name:var(--font-display)] text-5xl leading-[1.05] tracking-tight text-[color:var(--fairway)] sm:text-6xl"
            style={{ animationDelay: "80ms" }}
          >
            Read your swing like a coach would.
          </h1>
          <p
            className="animate-fade-up mt-5 max-w-lg text-lg text-[color:var(--ink-muted)]"
            style={{ animationDelay: "160ms" }}
          >
            Upload a phone slow-mo clip. Get a phase-scored swing, TPI faults
            with receipts, and coaching that can only cite measured numbers —
            never an invented one.
          </p>
          <div
            className="animate-fade-up mt-8 flex flex-wrap gap-3"
            style={{ animationDelay: "240ms" }}
          >
            <Button asChild className="h-11 px-6 text-[15px]">
              <Link href="/upload">Upload a swing</Link>
            </Button>
            <Button asChild variant="outline" className="h-11 px-6 text-[15px]">
              <Link href="/sign-in">Sign in</Link>
            </Button>
          </div>
          <p
            className="animate-fade-up mt-4 text-sm text-[color:var(--ink-muted)]"
            style={{ animationDelay: "300ms" }}
          >
            No card required. Two demo swings run the full pipeline in ~6 seconds.
          </p>
        </div>

        <div
          className="animate-fade-up relative mx-auto w-full max-w-sm lg:mx-0"
          style={{ animationDelay: "180ms" }}
        >
          <div className="absolute -inset-4 -z-10 rounded-[2rem] bg-[color:var(--fairway)]/[0.06] blur-2xl" />
          <div className="rounded-2xl border border-[color:var(--line)] bg-white/90 p-6 shadow-[0_24px_60px_-24px_rgba(15,61,46,0.35)] backdrop-blur">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--ink-muted)]">
                Swing score
              </p>
              <span className="rounded-full bg-[color:var(--mist)] px-2.5 py-1 text-[11px] font-medium text-[color:var(--fairway)]">
                7-iron · face-on
              </span>
            </div>
            <p className="mt-1 font-[family-name:var(--font-display)] text-6xl leading-none text-[color:var(--fairway)]">
              78
            </p>

            <div className="mt-5 space-y-2.5">
              {[
                ["Setup", 88],
                ["Downswing", 61],
                ["Impact", 74],
              ].map(([label, value]) => (
                <div key={label as string}>
                  <div className="mb-1 flex justify-between text-xs text-[color:var(--ink-muted)]">
                    <span>{label}</span>
                    <span className="tabular-nums">{value}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-[color:var(--mist)]">
                    <div
                      className="h-full rounded-full bg-[color:var(--fairway)]"
                      style={{ width: `${value}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-xl border border-[color:var(--sand)]/40 bg-[color:var(--sand-soft)]/50 px-3.5 py-3">
              <p className="text-xs font-medium tracking-wide text-[color:var(--fairway)] uppercase">
                Primary focus · early extension
              </p>
              <p className="mt-1 text-[13px] leading-relaxed text-[color:var(--ink)]">
                Hips move 0.18 toward the ball in the downswing — target under
                0.05. Detected from hip depth + spine angle change.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-[color:var(--line)] bg-white/50 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <p className="text-sm font-medium tracking-[0.22em] text-[color:var(--sand)] uppercase">
            How it works
          </p>
          <h2 className="mt-3 max-w-xl font-[family-name:var(--font-display)] text-3xl text-[color:var(--fairway)] sm:text-4xl">
            Four steps between your phone and a coaching note.
          </h2>

          <div className="mt-12 grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step) => (
              <div key={step.n} className="relative">
                <span className="font-[family-name:var(--font-display)] text-4xl text-[color:var(--fairway)]/15">
                  {step.n}
                </span>
                <h3 className="mt-2 text-lg font-medium text-[color:var(--fairway)]">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[color:var(--ink-muted)]">
                  {step.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <p className="text-sm font-medium tracking-[0.22em] text-[color:var(--sand)] uppercase">
          Why trust the number
        </p>
        <h2 className="mt-3 max-w-xl font-[family-name:var(--font-display)] text-3xl text-[color:var(--fairway)] sm:text-4xl">
          Most swing apps show you confidence. We show you our work.
        </h2>

        <div className="mt-12 grid gap-5 sm:grid-cols-2">
          {TRUST_CARDS.map((card) => (
            <div
              key={card.title}
              className="rounded-2xl border border-[color:var(--line)] bg-white/70 p-6 transition hover:border-[color:var(--fairway-soft)] hover:bg-white"
            >
              <h3 className="font-[family-name:var(--font-display)] text-xl text-[color:var(--fairway)]">
                {card.title}
              </h3>
              <p className="mt-2 text-[15px] leading-relaxed text-[color:var(--ink-muted)]">
                {card.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="relative overflow-hidden rounded-[2rem] bg-[color:var(--fairway)] px-8 py-14 text-center sm:px-16">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-70"
            style={{
              background:
                "radial-gradient(ellipse 60% 60% at 20% 0%, rgba(207,224,212,0.25) 0%, transparent 60%), radial-gradient(ellipse 50% 50% at 100% 100%, rgba(166,124,82,0.2) 0%, transparent 55%)",
            }}
          />
          <h2 className="relative font-[family-name:var(--font-display)] text-3xl text-[#f7fbf8] sm:text-4xl">
            Bring one swing. Leave with one thing to work on.
          </h2>
          <p className="relative mx-auto mt-4 max-w-lg text-[15px] text-[#cfe0d4]">
            Upload your own clip, or run a demo swing through the full pipeline
            right now — no account required to look around.
          </p>
          <div className="relative mt-8 flex flex-wrap justify-center gap-3">
            <Button
              asChild
              className="h-11 bg-white px-6 text-[15px] text-[color:var(--fairway)] hover:bg-[#f3f6f2]"
            >
              <Link href="/upload">Upload a swing</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="h-11 border-white/30 bg-transparent px-6 text-[15px] text-white hover:bg-white/10 hover:text-white"
            >
              <Link href="/sign-up">Create an account</Link>
            </Button>
          </div>
        </div>
      </section>

      <footer className="border-t border-[color:var(--line)] px-6 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 text-sm text-[color:var(--ink-muted)] sm:flex-row">
          <span className="font-[family-name:var(--font-display)] text-[color:var(--fairway)]">
            Golf AI
          </span>
          <p>Upload-only, single-camera analysis. Not a substitute for in-person coaching.</p>
        </div>
      </footer>
    </main>
  );
}
