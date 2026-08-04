import Link from "next/link";
import { UserMenu } from "@/components/user-menu";

const links = [
  { href: "/upload", label: "Upload" },
  { href: "/swings", label: "Swings" },
  { href: "/progress", label: "Dashboard" },
  { href: "/lab/segmentation", label: "Lab" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-[color:var(--line)] bg-[color:var(--fog)]/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="font-[family-name:var(--font-display)] text-lg tracking-tight text-[color:var(--fairway)]">
            Golf AI
          </Link>
          <nav className="flex items-center gap-1 sm:gap-3">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="rounded-md px-2.5 py-1.5 text-sm text-[color:var(--ink-muted)] transition hover:bg-[color:var(--mist)] hover:text-[color:var(--ink)]"
              >
                {l.label}
              </Link>
            ))}
            <UserMenu />
          </nav>
        </div>
      </header>
      {children}
    </div>
  );
}
