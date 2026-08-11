"use client";

import Link from "next/link";
import { useUser } from "@clerk/nextjs";

/**
 * The header's right-hand pair, which changes with the session.
 *
 * Resolved on the client rather than with `auth()` on the server so the
 * marketing page stays statically rendered — calling `auth()` here would opt
 * the whole landing page into per-request rendering just to pick one word.
 *
 * `authDisabled` comes from the server because AUTH_DISABLED is not a
 * NEXT_PUBLIC_ var: reading it here would be undefined, and calling Clerk's
 * hook with no ClerkProvider mounted throws.
 */
export function MarketingAuthLinks({ authDisabled }: { authDisabled: boolean }) {
  if (authDisabled) return <Links signedIn />;
  return <ClerkLinks />;
}

function ClerkLinks() {
  const { isLoaded, isSignedIn } = useUser();
  // Treat "still loading" as signed out: showing "Sign in" and swapping it to
  // "Dashboard" a moment later is a smaller lie than the reverse.
  return <Links signedIn={isLoaded && !!isSignedIn} />;
}

function Links({ signedIn }: { signedIn: boolean }) {
  return (
    <>
      {signedIn ? (
        <Link
          href="/progress"
          className="text-[13px] text-[color:var(--muted)] transition hover:text-[color:var(--ink)]"
        >
          Dashboard
        </Link>
      ) : (
        <Link
          href="/sign-in"
          className="text-[13px] text-[color:var(--muted)] transition hover:text-[color:var(--ink)]"
        >
          Sign in
        </Link>
      )}
      <Link
        href="/upload"
        className="rounded-[3px] border border-[color:var(--green)] px-3.5 py-2 text-[13px] font-semibold tracking-[0.03em] text-[color:var(--green)] transition hover:bg-[color:var(--green-soft)]"
      >
        Upload a swing
      </Link>
    </>
  );
}
