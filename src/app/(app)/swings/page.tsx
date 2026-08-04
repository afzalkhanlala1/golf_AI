import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/current-user";
import { getDb } from "@/lib/db";
import { swings } from "@/lib/db/schema";
import { SwingsList } from "@/components/swings-list";

export default async function SwingsPage() {
  const userId = await requireUser();
  if (!userId) redirect("/sign-in");

  const db = getDb();
  const rows = await db
    .select()
    .from(swings)
    .where(eq(swings.userId, userId))
    .orderBy(desc(swings.createdAt))
    .limit(50);

  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="font-[family-name:var(--font-display)] text-4xl text-[color:var(--fairway)]">
        Your swings
      </h1>
      <p className="mt-2 text-[color:var(--ink-muted)]">
        Newest first. Open any session for score, faults, and drills.
      </p>

      <SwingsList initialSwings={rows} />
    </main>
  );
}
