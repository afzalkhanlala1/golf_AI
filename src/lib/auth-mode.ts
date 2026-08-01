/**
 * Local preview helper. When AUTH_DISABLED=true, Clerk is skipped so the
 * Phase A shell UI can be browsed without real auth credentials.
 *
 * Never enable in production.
 */
export function isAuthDisabled(): boolean {
  return process.env.AUTH_DISABLED === "true";
}
