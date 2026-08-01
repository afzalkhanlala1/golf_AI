import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { swings } from "@/lib/db/schema";
import { Badge } from "@/components/ui/badge";

export default async function SwingsPage() {
  const { userId } = await auth();
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

      {rows.length === 0 ? (
        <div className="mt-10 rounded-xl border border-dashed border-[color:var(--line)] px-6 py-12 text-center">
          <p className="text-[color:var(--ink-muted)]">No swings yet.</p>
          <Link
            href="/upload"
            className="mt-3 inline-block text-sm font-medium text-[color:var(--fairway)] underline"
          >
            Upload your first clip
          </Link>
        </div>
      ) : (
        <ul className="mt-8 space-y-3">
          {rows.map((s) => (
            <li key={s.id}>
              <Link
                href={`/swings/${s.id}`}
                className="flex items-center justify-between rounded-xl border border-[color:var(--line)] bg-white/70 px-4 py-4 transition hover:border-[color:var(--fairway-soft)]"
              >
                <div>
                  <div className="font-medium capitalize">
                    {(s.club ?? "swing").replace("-", " ")} · {s.view.replaceAll("_", " ")}
                  </div>
                  <div className="text-sm text-[color:var(--ink-muted)]">
                    {s.createdAt.toLocaleString()}
                  </div>
                </div>
                <Badge variant="secondary">{s.status}</Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
