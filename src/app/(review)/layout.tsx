import Link from "next/link";
import { LogoMark } from "@/components/logo-mark";
import { ThemeToggle } from "@/components/theme-toggle";

export default function ReviewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[color:var(--paper)]">
      <header className="sticky top-0 z-30 border-b border-[color:var(--rule)] bg-[color:var(--surface)]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1080px] items-center justify-between gap-4 px-5 py-3.5 sm:px-8">
          <Link href="/review" className="flex min-w-0 items-center gap-2.5">
            <LogoMark size={34} />
            <span className="gi-display truncate text-[19px] font-semibold">
              Grip Intelligence
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <span className="gi-kicker hidden sm:block">Coach review</span>
            <ThemeToggle />
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
