import Link from "next/link";
import { LogoMark } from "@/components/logo-mark";
import { ThemeToggle } from "@/components/theme-toggle";
import { MarketingAuthLinks } from "@/components/marketing-auth-links";
import { isAuthDisabled } from "@/lib/auth-mode";

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
    body: "Pose tracks the body across all eight swing events, address through finish.",
  },
  {
    n: "04",
    title: "Read the receipts",
    body: "A phase-scored breakdown, TPI faults with the metric that triggered each one, and one thing to work on.",
  },
];

/**
 * Each of these says what it measures AND what it needs to do it. The
 * capture requirements are not fine print — a golfer who films 30fps
 * down-the-line and then finds half the product greyed out was misled, and
 * the honest fix is to say so before they film, not after.
 */
const FEATURES = [
  {
    title: "3D skeleton playback",
    body: "Orbit your swing in three dimensions from a metric body reconstruction. Face-on, down-the-line, overhead — angles no single camera filmed.",
    needs: "Any clip",
    href: "/swings",
  },
  {
    title: "Ghost comparison",
    body: "Overlay any two swings. Both are scaled to the same torso length and lined up on their shared events, so you compare shape and timing rather than height and clip length.",
    needs: "Two analysed swings",
    href: "/compare",
  },
  {
    title: "Clubhead & ball speed",
    body: "The clubhead is tracked through the strike and converted to real units using your own body as the ruler. Smash factor and attack angle come with it.",
    needs: "Face-on, 60fps+ (ball speed 120fps+)",
    href: "/upload",
  },
  {
    title: "Swing tracer & plane",
    body: "The clubhead path drawn on your video, cool at the top and hot through impact, with the downswing plane fitted over it — the shape of your swing readable in one frame.",
    needs: "60fps+",
    href: "/upload",
  },
  {
    title: "Compare & draw",
    body: "Two clips side by side, synced on their events, with lines, angles and freehand you can draw straight onto the frame and undo.",
    needs: "Two analysed swings",
    href: "/compare",
  },
  {
    title: "Live Coach",
    body: "Real-time setup coaching from your webcam — posture, knee flex, stance width, balance. Runs entirely in your browser; no video is uploaded or recorded.",
    needs: "A camera",
    href: "/coach",
  },
  {
    title: "Equipment fitting",
    body: "Shaft flex, driver loft, club length, iron head and ball, each built from your measured swing and your own measurements — and each labelled with what it was derived from.",
    needs: "Your height and handicap",
    href: "/fitting",
  },
  {
    title: "Body-part segmentation",
    body: "Splits the golfer into named regions — head, back, hips, arms, legs — so you can see which part is moving and when, from the same pose the metrics read.",
    needs: "Any analysed swing",
    href: "/lab/segmentation",
  },
  {
    title: "Clip conditioning",
    body: "Measures what your camera actually gave us, then sharpens soft footage and fills intermediate frames — labelling every synthetic frame as synthetic.",
    needs: "Any clip",
    href: "/lab/preprocess",
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
    body: "Coaching text is generated from structured findings only, then validated so it cannot cite a number that was not actually measured.",
  },
  {
    title: "Honest about the camera",
    body: "Single-camera video has real limits. When confidence is low or the angle is off, we say so instead of showing a confident wrong answer.",
  },
];

export default function MarketingHomePage() {
  return (
    <div className="min-h-screen bg-[color:var(--paper)]">
      <header className="sticky top-0 z-30 border-b border-[color:var(--rule)] bg-[color:var(--surface)]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1120px] items-center justify-between gap-4 px-5 py-3.5 sm:px-8">
          <Link href="/" className="flex min-w-0 items-center gap-2.5">
            <LogoMark size={34} />
            <span className="gi-display truncate text-[19px] font-semibold">
              Grip Intelligence
            </span>
          </Link>
          <nav className="flex items-center gap-3 sm:gap-5">
            <ThemeToggle />
            <MarketingAuthLinks authDisabled={isAuthDisabled()} />
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-[1120px] px-5 sm:px-8">
        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <section className="grid gap-12 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-24">
          <div className="animate-rise">
            <p className="gi-kicker">Slow-motion swing lab</p>
            <h1 className="gi-title text-[clamp(2.4rem,6vw,3.6rem)]">
              Read your swing like a coach would.
            </h1>
            <p className="gi-lede max-w-[44ch] text-[15px]">
              Upload a phone slow-mo clip. Get a phase-scored swing, TPI faults
              with receipts, and coaching that can only cite measured numbers —
              never an invented one.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/upload"
                className="rounded-[3px] bg-[color:var(--green)] px-6 py-3 text-[14px] font-semibold tracking-[0.03em] text-[color:var(--primary-foreground)] transition hover:opacity-90"
              >
                Upload a swing
              </Link>
              <Link
                href="/sign-in"
                className="rounded-[3px] border border-[color:var(--rule-strong)] px-6 py-3 text-[14px] tracking-[0.03em] transition hover:border-[color:var(--green)] hover:text-[color:var(--green)]"
              >
                Sign in
              </Link>
            </div>
            <p className="mt-4 text-[12px] text-[color:var(--faint)]">
              No card required. Two demo swings run the full pipeline in ~6
              seconds.
            </p>
          </div>

          {/* The crest, swinging. */}
          <div
            className="animate-rise flex flex-col items-center justify-center"
            style={{ animationDelay: "140ms" }}
          >
            <LogoMark size={280} animate />
            <p className="gi-display mt-8 text-[28px] font-medium">
              Grip Intelligence
            </p>
            <p className="mt-2 text-[9.5px] tracking-[0.28em] text-[color:var(--faint)] uppercase">
              AI Golfing Coach · Est. MMXXIV
            </p>
          </div>
        </section>

        {/* ── Sample reading ───────────────────────────────────────────── */}
        <section
          className="animate-rise grid gap-8 border-t border-b border-[color:var(--rule)] py-8 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-center sm:gap-[34px]"
          style={{ animationDelay: "80ms", borderTopColor: "var(--rule-strong)" }}
        >
          <div>
            <p className="gi-kicker">Swing score · sample</p>
            <p className="gi-figure mt-2 text-[76px]">78</p>
            <p className="mt-3 text-[12px] text-[color:var(--muted)]">
              7-iron · face-on · 8 of 10 checks
            </p>
          </div>
          <div>
            {[
              ["Setup", 88],
              ["Downswing", 61],
              ["Impact", 74],
            ].map(([label, value]) => (
              <div
                key={label as string}
                className="flex items-center gap-4 border-b border-[color:var(--rule)] py-3 last:border-0"
              >
                <span className="flex-1 text-[13px]">{label}</span>
                <span className="relative block h-[3px] w-[90px] bg-[color:var(--rule)] sm:w-[160px]">
                  <span
                    className="absolute inset-y-0 left-0"
                    style={{
                      width: `${value}%`,
                      background:
                        (value as number) >= 75 ? "var(--green)" : "var(--warn)",
                    }}
                  />
                </span>
                <span className="w-8 text-right text-[12px] tabular-nums text-[color:var(--muted)]">
                  {value}
                </span>
              </div>
            ))}
            <div className="mt-5 border-l border-[color:var(--green-line)] pl-4">
              <p className="gi-kicker" style={{ color: "var(--green)" }}>
                Primary focus · early extension
              </p>
              <p className="mt-2 text-[12.5px] leading-[1.7] text-[color:var(--muted)]">
                Hips move 0.18 toward the ball in the downswing — target under
                0.05. Detected from hip depth + spine angle change.
              </p>
            </div>
          </div>
        </section>

        {/* ── How it works ─────────────────────────────────────────────── */}
        <section className="py-16 lg:py-20">
          <p className="gi-kicker">How it works</p>
          <h2 className="gi-title max-w-[20ch] text-[clamp(1.7rem,3.4vw,2.4rem)]">
            Four steps between your phone and a coaching note.
          </h2>
          <div className="mt-12 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step) => (
              <div key={step.n} className="border-t border-[color:var(--rule)] pt-5">
                <span className="gi-figure text-[34px] text-[color:var(--rule-strong)]">
                  {step.n}
                </span>
                <h3 className="gi-display mt-2 text-[19px] font-medium">
                  {step.title}
                </h3>
                <p className="mt-2 text-[12.5px] leading-[1.7] text-[color:var(--muted)]">
                  {step.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Features ─────────────────────────────────────────────────── */}
        <section className="py-16 lg:py-20">
          <p className="gi-kicker">What you get</p>
          <h2 className="gi-title max-w-[24ch] text-[clamp(1.7rem,3.4vw,2.4rem)]">
            Nine rooms, and what each one needs from your camera.
          </h2>
          <div className="mt-12 grid gap-px bg-[color:var(--rule)] sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <Link
                key={f.title}
                href={f.href}
                className="group flex flex-col bg-[color:var(--paper)] p-6 transition hover:bg-[color:var(--surface)]"
              >
                <h3 className="gi-display text-[20px] font-medium transition group-hover:text-[color:var(--green)]">
                  {f.title}
                </h3>
                <p className="mt-2.5 flex-1 text-[12.5px] leading-[1.7] text-[color:var(--muted)]">
                  {f.body}
                </p>
                <p className="mt-5 text-[9.5px] tracking-[0.16em] text-[color:var(--faint)] uppercase">
                  Needs: {f.needs}
                </p>
              </Link>
            ))}
          </div>
        </section>

        {/* ── Trust ────────────────────────────────────────────────────── */}
        <section className="py-16 lg:py-20">
          <p className="gi-kicker">Why trust the number</p>
          <h2 className="gi-title max-w-[24ch] text-[clamp(1.7rem,3.4vw,2.4rem)]">
            Most swing apps show you confidence.
            <br />
            <span className="text-[color:var(--muted)]">We show you our work.</span>
          </h2>
          <div className="mt-12 grid gap-x-10 gap-y-9 sm:grid-cols-2">
            {TRUST_CARDS.map((card) => (
              <div
                key={card.title}
                className="border-t border-[color:var(--rule)] pt-5"
              >
                <h3 className="gi-display text-[20px] font-medium">{card.title}</h3>
                <p className="mt-2.5 text-[12.5px] leading-[1.7] text-[color:var(--muted)]">
                  {card.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Close ────────────────────────────────────────────────────── */}
        <section className="border-t border-[color:var(--rule-strong)] py-16 text-center lg:py-24">
          <h2 className="gi-title mx-auto max-w-[22ch] text-[clamp(1.8rem,4vw,2.6rem)]">
            Bring one swing.
            <br />
            <span className="text-[color:var(--muted)]">
              Leave with one thing to work on.
            </span>
          </h2>
          <p className="mx-auto mt-5 max-w-[52ch] text-[13.5px] leading-[1.7] text-[color:var(--muted)]">
            Upload your own clip, or run a demo swing through the full pipeline
            right now — no account required to look around.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Link
              href="/upload"
              className="rounded-[3px] bg-[color:var(--green)] px-6 py-3 text-[14px] font-semibold tracking-[0.03em] text-[color:var(--primary-foreground)] transition hover:opacity-90"
            >
              Upload a swing
            </Link>
            <Link
              href="/sign-up"
              className="rounded-[3px] border border-[color:var(--rule-strong)] px-6 py-3 text-[14px] tracking-[0.03em] transition hover:border-[color:var(--green)] hover:text-[color:var(--green)]"
            >
              Create an account
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-[color:var(--rule)]">
        <div className="mx-auto flex max-w-[1120px] flex-col items-center justify-between gap-3 px-5 py-8 text-[12px] text-[color:var(--faint)] sm:flex-row sm:px-8">
          <span className="flex items-center gap-2.5">
            <LogoMark size={22} />
            <span className="gi-display text-[15px] text-[color:var(--ink)]">
              Grip Intelligence
            </span>
          </span>
          <p className="text-center sm:text-right">
            Upload-only, single-camera analysis. Not a substitute for in-person
            coaching.
          </p>
        </div>
      </footer>
    </div>
  );
}
