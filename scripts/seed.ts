import { config } from "dotenv";
config({ path: ".env.local" });

import { eq } from "drizzle-orm";
import { getDb } from "../src/lib/db";
import { users } from "../src/lib/db/schema";
import { buildMockAnalysis } from "../src/lib/inference/mock";
import { persistAnalysisResult } from "../src/lib/swings/process";
import { swings } from "../src/lib/db/schema";

const DEMO_USER = "user_demo_seed_golf_ai";

async function main() {
  const db = getDb();

  await db
    .insert(users)
    .values({ id: DEMO_USER, email: "demo@golf-ai.local" })
    .onConflictDoNothing({ target: users.id });

  const variants = [
    { club: "good-demo", label: "good" as const },
    { club: "7i", label: "early_extension" as const },
    { club: "5i", label: "early_extension" as const },
  ];

  for (const v of variants) {
    const [swing] = await db
      .insert(swings)
      .values({
        userId: DEMO_USER,
        blobUrl: "https://example.com/demo-swing.mp4",
        view: "face_on",
        club: v.club,
        source: "demo",
        status: "PROCESSING",
      })
      .returning();

    if (!swing) continue;
    const analysis = buildMockAnalysis(swing.id, v.label);
    analysis.keypointsUrl = null;
    await persistAnalysisResult(analysis);
    console.log(`Seeded ${v.label} swing ${swing.id}`);
  }

  const count = await db.select().from(swings).where(eq(swings.userId, DEMO_USER));
  console.log(`Demo user ${DEMO_USER} now has ${count.length} swings`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
