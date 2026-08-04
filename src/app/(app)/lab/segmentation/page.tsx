import { auth } from "@clerk/nextjs/server";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import { redirect } from "next/navigation";
import { SegmentationLab } from "@/components/segmentation-lab";
import { getDb } from "@/lib/db";
import { swings } from "@/lib/db/schema";

export const metadata = {
  title: "Segmentation lab · Golf AI",
};

export default async function SegmentationLabPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const db = getDb();
  const rows = await db
    .select({
      id: swings.id,
      blobUrl: swings.blobUrl,
      club: swings.club,
      view: swings.view,
      createdAt: swings.createdAt,
    })
    .from(swings)
    .where(and(eq(swings.userId, userId), isNotNull(swings.keypointsUrl)))
    .orderBy(desc(swings.createdAt))
    .limit(25);

  return (
    <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <p className="text-sm uppercase tracking-[0.18em] text-[color:var(--ink-muted)]">
        Lab · experimental
      </p>
      <h1 className="mt-2 font-[family-name:var(--font-display)] text-4xl text-[color:var(--fairway)]">
        Body-part segmentation
      </h1>
      <p className="mt-3 max-w-2xl text-[color:var(--ink-muted)]">
        Splits the golfer into named regions — head, back, hips, arms, legs —
        so you can see which part is moving, and when. Regions come from the
        same pose the swing analysis uses, so what you see here is what the
        metrics are reading.
      </p>

      <SegmentationLab
        swings={rows.map((r) => ({
          id: r.id,
          blobUrl: r.blobUrl,
          label: `${(r.club ?? "swing").replace("-", " ")} · ${r.view.replaceAll("_", " ")} · ${r.createdAt.toLocaleDateString()}`,
        }))}
      />
    </main>
  );
}
