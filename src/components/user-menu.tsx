"use client";

import { UserButton } from "@clerk/nextjs";

/**
 * `authDisabled` is passed down from the server rather than read from
 * process.env here: AUTH_DISABLED is not NEXT_PUBLIC_, so it is undefined in
 * the client bundle, and reading it here would render <UserButton /> with no
 * ClerkProvider mounted — which throws.
 */
export function UserMenu({ authDisabled }: { authDisabled: boolean }) {
  if (authDisabled) {
    return (
      <span
        title="Auth bypass active (development only)"
        className="rounded-md bg-[color:var(--sand-soft)] px-2 py-1 text-xs font-medium text-[color:var(--ink)]"
      >
        dev
      </span>
    );
  }
  return <UserButton />;
}
