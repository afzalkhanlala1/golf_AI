import Link from "next/link";
import { LogoMark } from "@/components/logo-mark";

const TRUST_POINTS = [
  "Every score shows the metric that drove it — nothing hidden behind a modal.",
  "Faults are named against the TPI Big 12 — the vocabulary coaches already use.",
  "The feedback engine explains measured numbers. It never invents one.",
];

/**
 * The left panel stays dark in both themes, the way the phone splash does.
 * Re-tinting it per theme would mean two sets of contrast to keep honest for
 * no gain — it reads as the cover of the product either way.
 */
const PANEL = "#0f1a14";
const PANEL_INK = "#f2f5f2";
const PANEL_MUTED = "#9fb3a6";

export function AuthShell({
  eyebrow,
  title,
  subtitle,
  children,
  footer,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <main className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <section
        className="relative hidden overflow-hidden px-14 py-16 lg:flex lg:flex-col lg:justify-between"
        style={{ background: PANEL }}
      >
        <Link href="/" className="relative flex items-center gap-3">
          {/* The crest reads its colours from CSS vars; inside this always-dark
              panel they are pinned so it does not follow the page theme. */}
          <span
            style={
              {
                "--green": "#3fbf7a",
                "--ink": PANEL_INK,
                "--surface": PANEL,
                "--none": "#5c6f63",
              } as React.CSSProperties
            }
            className="inline-flex"
          >
            <LogoMark size={40} animate />
          </span>
          <span
            className="gi-display text-[20px] font-semibold"
            style={{ color: PANEL_INK }}
          >
            Grip Intelligence
          </span>
        </Link>

        <div className="relative max-w-md">
          <p
            className="text-[10px] tracking-[0.2em] uppercase"
            style={{ color: PANEL_MUTED }}
          >
            {eyebrow}
          </p>
          <h1
            className="gi-display mt-4 text-[2.5rem] leading-[1.06] xl:text-[2.75rem]"
            style={{ color: PANEL_INK }}
          >
            {title}
          </h1>
          <p
            className="mt-5 text-[13.5px] leading-[1.7]"
            style={{ color: PANEL_MUTED }}
          >
            {subtitle}
          </p>

          <ul
            className="mt-10 space-y-4 border-t pt-8"
            style={{ borderColor: "rgba(255,255,255,0.12)" }}
          >
            {TRUST_POINTS.map((point) => (
              <li
                key={point}
                className="flex gap-3 text-[12.5px] leading-[1.7]"
                style={{ color: PANEL_MUTED }}
              >
                <span
                  className="mt-1.5 h-1 w-1 shrink-0 rounded-full"
                  style={{ background: "#3fbf7a" }}
                />
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-[11px]" style={{ color: PANEL_MUTED }}>
          Upload-only — we never record inside the browser.
        </p>
      </section>

      <section className="flex flex-col items-center justify-center bg-[color:var(--paper)] px-6 py-16 sm:px-10">
        <div className="w-full max-w-sm">
          <Link href="/" className="mb-8 flex items-center gap-2.5 lg:hidden">
            <LogoMark size={30} />
            <span className="gi-display text-[18px] font-semibold">
              Grip Intelligence
            </span>
          </Link>
          {children}
          {footer && (
            <p className="mt-6 text-center text-[12.5px] text-[color:var(--muted)]">
              {footer}
            </p>
          )}
        </div>
      </section>
    </main>
  );
}

/**
 * Clerk's widget is themed through CSS variables rather than fixed hex, so it
 * follows the light/dark toggle with the rest of the app instead of staying
 * on a white card when everything around it goes dark.
 */
export const clerkAppearance = {
  variables: {
    colorPrimary: "var(--green)",
    colorText: "var(--ink)",
    colorTextSecondary: "var(--muted)",
    colorBackground: "var(--surface)",
    colorInputBackground: "var(--surface)",
    colorInputText: "var(--ink)",
    colorNeutral: "var(--ink)",
    borderRadius: "3px",
    fontFamily: "var(--font-sans-body)",
  },
  elements: {
    card: "shadow-none ring-1 ring-[color:var(--rule)] rounded-[3px] bg-[color:var(--surface)]",
    headerTitle: "font-[family-name:var(--font-display)] text-2xl text-[color:var(--ink)]",
    headerSubtitle: "text-[color:var(--muted)]",
    formButtonPrimary:
      "bg-[color:var(--green)] text-[color:var(--primary-foreground)] hover:opacity-90 text-sm normal-case rounded-[3px]",
    footerActionLink: "text-[color:var(--green)] hover:opacity-80",
    socialButtonsBlockButton:
      "border-[color:var(--rule-strong)] text-[color:var(--ink)] rounded-[3px]",
  },
} as const;
