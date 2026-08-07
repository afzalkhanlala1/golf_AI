/**
 * Dates that render identically on the server and in the browser.
 *
 * ## The bug this exists to prevent
 *
 * `date.toLocaleString()` and `toLocaleDateString(undefined, …)` resolve
 * the locale and time zone from whatever environment they run in. On the
 * server that is Node — UTC on Vercel — and in the browser it is the user's
 * machine. Next.js renders the same component in both places and compares
 * the output, so any such call is a guaranteed hydration mismatch for every
 * user outside UTC. It surfaced as "Hydration failed because the server
 * rendered text..." on the dashboard and the swing list.
 *
 * The trap is that it looks fine in development, because the dev server and
 * the browser are the same machine in the same time zone.
 *
 * ## The trade-off taken
 *
 * Locale and time zone are pinned rather than deferred to the client. The
 * alternative — rendering nothing until after mount — avoids the mismatch
 * but leaves a visible gap that reflows the list on every load.
 *
 * The cost is that a swing uploaded at 11pm in a western time zone is dated
 * the following day. For "when did I record this", one day of skew at the
 * boundary is a fair price for text that is stable, sortable and identical
 * everywhere. Anything needing true local time should render client-side
 * and say so.
 */

/** Fixed so output never depends on where the code happens to run. */
const LOCALE = "en-GB";
const TIME_ZONE = "UTC";

/** "4 Aug" — for dense lists where the year is obvious from context. */
export function formatShortDate(date: Date | string | number): string {
  const d = toDate(date);
  if (!d) return "";
  return d.toLocaleDateString(LOCALE, {
    day: "numeric",
    month: "short",
    timeZone: TIME_ZONE,
  });
}

/** "4 Aug 2026" — for anything that may be more than a year old. */
export function formatDate(date: Date | string | number): string {
  const d = toDate(date);
  if (!d) return "";
  return d.toLocaleDateString(LOCALE, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: TIME_ZONE,
  });
}

/** "4 Aug 2026, 18:20" — when the time of day actually matters. */
export function formatDateTime(date: Date | string | number): string {
  const d = toDate(date);
  if (!d) return "";
  return d.toLocaleString(LOCALE, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TIME_ZONE,
  });
}

/**
 * Accepts what the API actually hands over.
 *
 * Dates arrive as `Date` from Drizzle on the server and as ISO strings once
 * they have been through JSON, and the same component often renders both.
 * Returns null rather than "Invalid Date" so a bad value shows as empty
 * instead of leaking a parser error into the page.
 */
function toDate(value: Date | string | number): Date | null {
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}
