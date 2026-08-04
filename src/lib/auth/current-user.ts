import {
  DEV_USER_EMAIL,
  DEV_USER_ID,
  isAuthDisabled,
} from "@/lib/auth-mode";
import { ensureUser } from "@/lib/auth/ensure-user";

/**
 * Single entry point for "who is making this request".
 *
 * Every page and API route calls this instead of Clerk's `auth()` directly,
 * so the development bypass (see auth-mode.ts) has exactly one place to
 * apply — and exactly one place to remove.
 */
export async function getAuthUserId(): Promise<string | null> {
  if (isAuthDisabled()) return DEV_USER_ID;
  const { auth } = await import("@clerk/nextjs/server");
  const { userId } = await auth();
  return userId;
}

/** Email for the current user, used when mirroring them into our users table. */
export async function getAuthUserEmail(userId: string): Promise<string> {
  if (isAuthDisabled()) return DEV_USER_EMAIL;
  const { currentUser } = await import("@clerk/nextjs/server");
  const user = await currentUser();
  return (
    user?.emailAddresses[0]?.emailAddress ?? `${userId}@users.clerk.local`
  );
}

/**
 * Resolve the caller and guarantee a matching row in `users`, so foreign keys
 * from `swings` hold under the bypass just as they do under Clerk.
 */
export async function requireUser(): Promise<string | null> {
  const userId = await getAuthUserId();
  if (!userId) return null;
  if (isAuthDisabled()) {
    await ensureUser(userId, DEV_USER_EMAIL);
  }
  return userId;
}
