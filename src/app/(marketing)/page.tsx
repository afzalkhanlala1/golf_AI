import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function MarketingHomePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center gap-8 px-6 py-16">
      <div className="space-y-3">
        <p className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
          Phase A foundation
        </p>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Golf AI
        </h1>
        <p className="max-w-xl text-lg text-muted-foreground">
          Upload a slow-motion swing. Get a phase-scored analysis, TPI faults,
          and grounded coaching feedback.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/upload">Go to upload</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/api/health">Health check</Link>
        </Button>
      </div>
    </main>
  );
}
