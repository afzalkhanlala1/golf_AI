"use client";

import { usePathname } from "next/navigation";
import { crumbFor } from "@/components/nav-items";
import { ThemeToggle } from "@/components/theme-toggle";

/**
 * `analysed` is the real count of completed swings, not a decorative figure.
 * It is null when the count could not be read, and the counter is dropped
 * rather than shown as a zero or a placeholder — this product's whole claim
 * is that it does not display numbers it cannot stand behind.
 */
export function AppTopBar({ analysed }: { analysed: number | null }) {
  const pathname = usePathname();

  return (
    <div className="sticky top-0 z-30 flex items-center justify-between gap-5 border-b border-[color:var(--rule)] bg-[color:var(--surface)]/90 px-5 py-3.5 backdrop-blur-md lg:px-10 lg:py-[18px]">
      <p className="gi-kicker truncate">{crumbFor(pathname)}</p>
      <div className="flex items-center gap-4 lg:gap-[22px]">
        {analysed !== null ? (
          <span className="hidden items-center gap-2 text-[11.5px] tracking-[0.02em] text-[color:var(--muted)] sm:inline-flex">
            <span className="animate-live h-1.5 w-1.5 rounded-full bg-[color:var(--live)]" />
            <span className="tabular-nums">{analysed.toLocaleString("en-US")}</span>
            <span>{analysed === 1 ? "swing analysed" : "swings analysed"}</span>
          </span>
        ) : null}
        <ThemeToggle />
      </div>
    </div>
  );
}
