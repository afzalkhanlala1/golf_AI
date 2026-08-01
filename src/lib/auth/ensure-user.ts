import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";

export async function ensureUser(id: string, email: string) {
  const db = getDb();
  const existing = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (existing[0]) return existing[0];

  const [created] = await db
    .insert(users)
    .values({ id, email })
    .returning();
  return created;
}
