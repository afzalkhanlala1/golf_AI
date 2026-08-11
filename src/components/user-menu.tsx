"use client";

import { SignOutButton, useUser } from "@clerk/nextjs";

/**
 * `authDisabled` is passed down from the server rather than read from
 * process.env here: AUTH_DISABLED is not NEXT_PUBLIC_, so it is undefined in
 * the client bundle, and reading it here would render Clerk's hooks with no
 * ClerkProvider mounted — which throws.
 */
export function UserMenu({
  authDisabled,
  compact = false,
}: {
  authDisabled: boolean;
  compact?: boolean;
}) {
  if (authDisabled) return <DevBadge compact={compact} />;
  return <ClerkIdentity compact={compact} />;
}

function Avatar({ initials, src }: { initials: string; src?: string | null }) {
  if (src) {
    // Clerk serves avatars from its own CDN at an arbitrary host; next/image
    // would need every such host allow-listed for no benefit at 34px.
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        width={34}
        height={34}
        className="h-[34px] w-[34px] shrink-0 rounded-full border border-[color:var(--green-line)] object-cover"
      />
    );
  }
  return (
    <span className="gi-display flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full border border-[color:var(--green-line)] bg-[color:var(--green-soft)] text-[15px] font-semibold tracking-[0.04em] text-[color:var(--green)]">
      {initials}
    </span>
  );
}

function initialsOf(name: string, email: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (email.slice(0, 2) || "??").toUpperCase();
}

function ClerkIdentity({ compact }: { compact: boolean }) {
  const { isLoaded, user } = useUser();

  // Reserve the row before Clerk resolves so the sidebar footer does not
  // jump once the user loads.
  if (!isLoaded || !user) {
    return compact ? (
      <span className="block h-[34px] w-[34px] rounded-full bg-[color:var(--sunk)]" />
    ) : (
      <span className="flex items-center gap-[11px]">
        <span className="h-[34px] w-[34px] rounded-full bg-[color:var(--sunk)]" />
        <span className="h-3 w-24 rounded bg-[color:var(--sunk)]" />
      </span>
    );
  }

  const email = user.primaryEmailAddress?.emailAddress ?? "";
  const name = user.fullName ?? user.username ?? email.split("@")[0] ?? "Member";
  const avatar = <Avatar initials={initialsOf(name, email)} src={user.imageUrl} />;

  if (compact) return avatar;

  return (
    <>
      {avatar}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] leading-tight">{name}</p>
        <p className="mt-0.5 text-[10.5px] tracking-[0.03em] text-[color:var(--faint)]">
          Member
        </p>
      </div>
      <SignOutButton>
        <button
          type="button"
          className="cursor-pointer px-0.5 py-1 text-[11.5px] tracking-[0.03em] text-[color:var(--faint)] transition hover:text-[color:var(--ink)]"
        >
          Sign out
        </button>
      </SignOutButton>
    </>
  );
}

function DevBadge({ compact }: { compact: boolean }) {
  const avatar = <Avatar initials="DV" />;
  if (compact) return avatar;
  return (
    <>
      {avatar}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] leading-tight">Local user</p>
        <p
          className="mt-0.5 text-[10.5px] tracking-[0.03em] text-[color:var(--warn)]"
          title="Auth bypass active (development only)"
        >
          Auth bypassed
        </p>
      </div>
    </>
  );
}
