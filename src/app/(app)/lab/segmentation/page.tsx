import { and, desc, eq, isNotNull } from "drizzle-orm";
import { redirect } from "next/navigation";
import { SegmentationLab } from "@/components/segmentation-lab";
import { PageBody, PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth/current-user";
import { getDb } from "@/lib/db";
import { swings } from "@/lib/db/schema";
import { formatShortDate } from "@/lib/format/date";

export const metadata = {
  title: "Segmentation lab · Grip Intelligence",
};

export default async function SegmentationLabPage() {
  const userId = await requireUser();
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
    <PageBody wide>
      <PageHeader
        kicker="The lab · experimental"
        title="Body-part segmentation."
        accent="Which part moved, and when."
        lede="Splits the golfer into named regions — head, back, hips, arms, legs. The regions come from the same pose the swing analysis reads, so what you see here is what the metrics saw."
      />
      <div className="mt-9">
        <SegmentationLab
          swings={rows.map((r) => ({
            id: r.id,
            blobUrl: r.blobUrl,
            label: `${(r.club ?? "swing").replace("-", " ")} · ${r.view.replaceAll("_", " ")} · ${formatShortDate(r.createdAt)}`,
          }))}
        />
      </div>
    </PageBody>
  );
}
