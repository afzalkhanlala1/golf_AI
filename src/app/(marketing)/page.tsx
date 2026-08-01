import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function MarketingHomePage() {
  return (
    <main className="relative mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center px-6 py-16">
      <div className="absolute inset-x-0 top-0 -z-10 h-[70vh] bg-[radial-gradient(ellipse_at_top,_#cfe0d4_0%,_transparent_60%)]" />
      <p className="text-sm font-medium tracking-[0.22em] text-[color:var(--sand)] uppercase">
        Slow-motion swing lab
      </p>
      <h1 className="mt-4 max-w-2xl font-[family-name:var(--font-display)] text-5xl leading-[1.05] tracking-tight text-[color:var(--fairway)] sm:text-7xl">
        Golf AI
      </h1>
      <p className="mt-5 max-w-xl text-lg text-[color:var(--ink-muted)]">
        Upload a phone slow-mo clip. Get a phase-scored swing, TPI faults with
        receipts, and coaching that can only cite measured numbers.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Button asChild className="h-10 px-5">
          <Link href="/upload">Upload a swing</Link>
        </Button>
        <Button asChild variant="outline" className="h-10 px-5">
          <Link href="/sign-in">Sign in</Link>
        </Button>
      </div>
    </main>
  );
}
