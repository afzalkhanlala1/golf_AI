/**
 * The page-opening block: small-caps kicker, a two-tone display heading, and
 * a lede. Every room opens the same way, which is most of what makes them
 * feel like one product rather than eight screens.
 *
 * `accent` is the second line of the heading, set in the muted ink — the
 * pairing is meant to read as a statement and its qualifier.
 */
export function PageHeader({
  kicker,
  title,
  accent,
  lede,
  aside,
}: {
  kicker: string;
  title: string;
  accent?: string;
  lede?: string;
  aside?: React.ReactNode;
}) {
  return (
    <section className="animate-rise">
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0">
          <p className="gi-kicker">{kicker}</p>
          <h1 className="gi-title">
            {title}
            {accent ? (
              <>
                <br />
                <span className="text-[color:var(--muted)]">{accent}</span>
              </>
            ) : null}
          </h1>
        </div>
        {aside ? <div className="shrink-0 pt-1">{aside}</div> : null}
      </div>
      {lede ? <p className="gi-lede">{lede}</p> : null}
    </section>
  );
}

/** Section title sitting on a strong rule, with an optional right-hand note. */
export function SectionHead({
  title,
  note,
  className = "",
}: {
  title: string;
  note?: string;
  className?: string;
}) {
  return (
    <div className={`gi-section-head ${className}`}>
      <h2 className="gi-h2">{title}</h2>
      {note ? (
        <span className="gi-kicker shrink-0 text-right">{note}</span>
      ) : null}
    </div>
  );
}

/**
 * A single figure with its label and a line of context. `suffix` is set
 * smaller and muted so "/ 10" reads as a denominator rather than part of the
 * number itself.
 */
export function Stat({
  label,
  value,
  suffix,
  note,
  tone = "ink",
}: {
  label: string;
  value: React.ReactNode;
  suffix?: string;
  note?: React.ReactNode;
  tone?: "ink" | "green" | "muted";
}) {
  const color =
    tone === "green" ? "var(--green)" : tone === "muted" ? "var(--muted)" : "var(--ink)";
  return (
    <div>
      <p className="gi-kicker">{label}</p>
      <p className="gi-figure mt-2.5 text-[38px]" style={{ color }}>
        {value}
        {suffix ? (
          <span className="text-[20px] text-[color:var(--muted)]">{suffix}</span>
        ) : null}
      </p>
      {note ? (
        <p className="mt-3.5 text-[12px] leading-[1.65] text-[color:var(--muted)]">
          {note}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Standard page frame. Matching padding and max width everywhere is what
 * keeps the eye from resetting when moving between rooms.
 */
export function PageBody({
  children,
  wide = false,
}: {
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      className={`w-full px-5 pt-8 pb-16 sm:px-8 lg:px-10 lg:pt-11 lg:pb-16 ${
        wide ? "max-w-[1240px]" : "max-w-[1080px]"
      }`}
    >
      {children}
    </div>
  );
}
