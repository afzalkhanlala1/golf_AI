import Link from "next/link";
import { count, eq } from "drizzle-orm";
import { UserMenu } from "@/components/user-menu";
import { LogoMark, LogoWord } from "@/components/logo-mark";
import { SidebarNav } from "@/components/sidebar-nav";
import { MobileNav } from "@/components/mobile-nav";
import { AppTopBar } from "@/components/app-topbar";
import { isAuthDisabled } from "@/lib/auth-mode";
import { getDb } from "@/lib/db";
import { swings } from "@/lib/db/schema";

/**
 * Total swings that made it all the way through the pipeline.
 *
 * The shell renders on every page, so a database hiccup here would take down
 * routes that do not otherwise need the database. It returns null instead and
 * the counter is simply dropped from the bar.
 */
async function analysedCount(): Promise<number | null> {
  try {
    const [row] = await getDb()
      .select({ n: count() })
      .from(swings)
      .where(eq(swings.status, "COMPLETE"));
    return row?.n ?? null;
  } catch {
    return null;
  }
}

export async function AppShell({ children }: { children: React.ReactNode }) {
  const analysed = await analysedCount();
  const authDisabled = isAuthDisabled();

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[264px_minmax(0,1fr)]">
      {/* ── Desktop sidebar ──────────────────────────────────────────── */}
      <aside className="sticky top-0 hidden h-screen flex-col self-start border-r border-[color:var(--rule)] bg-[color:var(--surface)] lg:flex">
        <div className="border-b border-[color:var(--rule)] px-[22px] pt-[26px] pb-5">
          <Link href="/" className="flex items-center gap-[11px]">
            <LogoMark size={38} />
            <LogoWord />
          </Link>
        </div>

        <SidebarNav />

        <div className="px-[22px] pb-[18px]">
          <Link
            href="/upload"
            className="block w-full rounded-[3px] border border-[color:var(--green)] px-3.5 py-2.5 text-center text-[13px] font-semibold tracking-[0.03em] text-[color:var(--green)] transition hover:bg-[color:var(--green-soft)] active:translate-y-px"
          >
            Upload a swing
          </Link>
        </div>

        <div className="flex items-center gap-[11px] border-t border-[color:var(--rule)] px-[22px] py-4">
          <UserMenu authDisabled={authDisabled} />
        </div>
      </aside>

      {/* ── Content ──────────────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-col">
        {/* Phone header — the sidebar's identity block, compressed. */}
        <div className="flex items-center gap-3 border-b border-[color:var(--rule)] bg-[color:var(--surface)] px-5 py-3.5 lg:hidden">
          <Link href="/" className="flex min-w-0 items-center gap-2.5">
            <LogoMark size={32} />
            <span className="gi-display truncate text-[18px] font-semibold">
              Grip Intelligence
            </span>
          </Link>
          <div className="ml-auto shrink-0">
            <UserMenu authDisabled={authDisabled} compact />
          </div>
        </div>

        <AppTopBar analysed={analysed} />

        {/* Bottom padding clears the fixed tab bar on phones. */}
        <div className="min-w-0 flex-1 pb-28 lg:pb-0">{children}</div>
      </div>

      <MobileNav />
    </div>
  );
}
