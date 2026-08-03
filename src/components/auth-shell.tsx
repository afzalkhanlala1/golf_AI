import Link from "next/link";

const TRUST_POINTS = [
  "Every score shows the metric that drove it — nothing hidden behind a modal.",
  "Faults are named against the TPI Big 12 — the vocabulary coaches already use.",
  "The feedback engine explains measured numbers. It never invents one.",
];

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
      <section className="relative hidden overflow-hidden bg-[color:var(--fairway)] px-14 py-16 lg:flex lg:flex-col lg:justify-between">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            background:
              "radial-gradient(ellipse 60% 50% at 15% 10%, rgba(207,224,212,0.28) 0%, transparent 60%), radial-gradient(ellipse 50% 40% at 100% 100%, rgba(166,124,82,0.22) 0%, transparent 55%)",
          }}
        />
        <svg
          aria-hidden
          viewBox="0 0 400 400"
          className="pointer-events-none absolute -right-24 -bottom-24 h-[520px] w-[520px] opacity-[0.14]"
          fill="none"
        >
          <path
            d="M40 340 C 120 340, 120 220, 200 200 C 300 175, 260 40, 360 40"
            stroke="#f3f6f2"
            strokeWidth="1.5"
            strokeDasharray="2 10"
            strokeLinecap="round"
          />
          <circle cx="360" cy="40" r="5" fill="#f3f6f2" />
        </svg>

        <Link
          href="/"
          className="relative font-[family-name:var(--font-display)] text-xl tracking-tight text-[#f3f6f2]"
        >
          Golf AI
        </Link>

        <div className="relative max-w-md">
          <p className="text-sm font-medium tracking-[0.22em] text-[#cfe0d4] uppercase">
            {eyebrow}
          </p>
          <h1 className="mt-4 font-[family-name:var(--font-display)] text-4xl leading-[1.08] text-[#f7fbf8] xl:text-[2.75rem]">
            {title}
          </h1>
          <p className="mt-5 text-[15px] leading-relaxed text-[#cfe0d4]">
            {subtitle}
          </p>

          <ul className="mt-10 space-y-4 border-t border-white/15 pt-8">
            {TRUST_POINTS.map((point) => (
              <li key={point} className="flex gap-3 text-sm text-[#dfe9e2]">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--sand)]" />
                <span className="leading-relaxed">{point}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-[#9fb6a8]">
          Upload-only — we never record inside the browser.
        </p>
      </section>

      <section className="flex flex-col items-center justify-center px-6 py-16 sm:px-10">
        <div className="w-full max-w-sm">
          <Link
            href="/"
            className="mb-8 inline-block font-[family-name:var(--font-display)] text-lg tracking-tight text-[color:var(--fairway)] lg:hidden"
          >
            Golf AI
          </Link>
          {children}
          {footer && (
            <p className="mt-6 text-center text-sm text-[color:var(--ink-muted)]">
              {footer}
            </p>
          )}
        </div>
      </section>
    </main>
  );
}

export const clerkAppearance = {
  variables: {
    colorPrimary: "#0f3d2e",
    colorText: "#14201a",
    colorTextSecondary: "#5b6b61",
    colorBackground: "#ffffff",
    colorInputBackground: "#ffffff",
    colorInputText: "#14201a",
    borderRadius: "0.75rem",
    fontFamily: "var(--font-sans-body)",
  },
  elements: {
    card: "shadow-none ring-1 ring-[color:var(--line)] rounded-2xl",
    headerTitle: "font-[family-name:var(--font-display)] text-2xl text-[color:var(--fairway)]",
    headerSubtitle: "text-[color:var(--ink-muted)]",
    formButtonPrimary:
      "bg-[color:var(--fairway)] hover:bg-[color:var(--fairway-soft)] text-sm normal-case",
    footerActionLink: "text-[color:var(--fairway)] hover:text-[color:var(--fairway-soft)]",
    socialButtonsBlockButton: "border-[color:var(--line)]",
  },
} as const;
