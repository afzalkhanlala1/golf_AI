/**
 * DEVELOPMENT AUTH BYPASS — TEMPORARY.
 *
 * When AUTH_DISABLED=true, Clerk is skipped entirely and every request is
 * treated as the fixed local user below. This exists so the app can be run
 * and tested without working Clerk credentials.
 *
 * ── REMOVE BEFORE LAUNCH ────────────────────────────────────────────────
 * Delete this file, drop AUTH_DISABLED from .env.example, and inline the
 * Clerk calls in src/lib/auth/current-user.ts. Grep for AUTH_DISABLED to
 * find every touchpoint.
 * ────────────────────────────────────────────────────────────────────────
 *
 * Two independent guards make this non-exploitable in production:
 *   1. NODE_ENV must not be "production" — Vercel builds always set it, so
 *      the flag is inert there even if the env var is set by mistake.
 *   2. The flag must be explicitly "true"; anything else is off.
 */

/** The synthetic user every request runs as while the bypass is on. */
export const DEV_USER_ID = "dev_local_user";
export const DEV_USER_EMAIL = "dev@localhost.test";

export function isAuthDisabled(): boolean {
  const requested = process.env.AUTH_DISABLED === "true";
  if (!requested) return false;

  if (process.env.NODE_ENV === "production") {
    // Loud, because silently authenticating everyone would be catastrophic.
    console.error(
      "[auth] AUTH_DISABLED=true was ignored: refusing to bypass auth in a production build.",
    );
    return false;
  }
  return true;
}
