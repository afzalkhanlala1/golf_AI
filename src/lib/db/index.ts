import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { getDatabaseUrl } from "@/lib/env";
import * as schema from "./schema";

export function getDb() {
  const sql = neon(getDatabaseUrl());
  return drizzle(sql, { schema });
}

export type Database = ReturnType<typeof getDb>;
export { schema };
