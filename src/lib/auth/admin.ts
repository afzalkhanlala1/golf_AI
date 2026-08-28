import { isAuthDisabled } from "@/lib/auth-mode";
import { getAuthUserEmail, getAuthUserId } from "@/lib/auth/current-user";

/**
 * Parse the ADMIN_EMAILS env value into a case-insensitive allowlist.
 *
 * Empty / unset means nobody is an admin. That is deliberate: an unset list
 * must not open the ledger to every signed-in user.
 */
export function parseAdminEmails(raw: string | undefined | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

export function emailIsAdmin(
  email: string,
  allowlist: readonly string[],
): boolean {
  if (!email || allowlist.length === 0) return false;
  return allowlist.includes(email.trim().toLowerCase());
}

export function adminEmailsFromEnv(): string[] {
  return parseAdminEmails(process.env.ADMIN_EMAILS);
}

/**
 * Whether the current request may open the admin ledger.
 *
 * The AUTH_DISABLED bypass is treated as admin so the page can be previewed
 * locally without a Clerk allowlist. That bypass is already inert in
 * production builds — see `src/lib/auth-mode.ts`.
 */
export async function isCurrentUserAdmin(): Promise<boolean> {
  if (isAuthDisabled()) return true;
  const userId = await getAuthUserId();
  if (!userId) return false;
  const email = await getAuthUserEmail(userId);
  return emailIsAdmin(email, adminEmailsFromEnv());
}
