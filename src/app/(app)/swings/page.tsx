import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/current-user";
import { getDb } from "@/lib/db";
import { swings } from "@/lib/db/schema";
import { SwingsList } from "@/components/swings-list";
import { PageBody, PageHeader } from "@/components/page-header";

export const metadata = {
  title: "Swings · Grip Intelligence",
};

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

  const graded = rows.filter((r) => r.status === "COMPLETE").length;

  return (
    <PageBody>
      <PageHeader
        kicker="The ledger"
        title={
          rows.length === 0
            ? "No swings on record yet."
            : `${rows.length} ${rows.length === 1 ? "swing" : "swings"} on record.`
        }
        accent={
          rows.length === 0
            ? "The first one starts the line."
            : `${graded} graded, newest first.`
        }
        lede="Every swing you have sent through the pipeline, whether it graded cleanly or not. Open any one for its phase scores, the faults it triggered, and the metric behind each."
      />
      <div className="mt-9">
        <SwingsList initialSwings={rows} />
      </div>
    </PageBody>
  );
}
