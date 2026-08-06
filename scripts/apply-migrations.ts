/**
 * Apply pending SQL migrations over Neon's HTTP driver.
 *
 * `drizzle-kit migrate` opens a websocket, which this environment does not
 * give it, and it swallows the resulting error into a bare exit code. The
 * app itself talks to Neon over plain HTTP (see src/lib/db/index.ts), so
 * this runs the same files through the same transport that production uses.
 *
 *   pnpm db:apply
 *
 * Idempotent: it records what it has run in the same `drizzle.__drizzle_migrations`
 * table drizzle-kit uses, and skips anything already there — so switching
 * back to drizzle-kit later stays consistent.
 */
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

const MIGRATIONS_DIR = join(process.cwd(), "src", "lib", "db", "migrations");

/** duplicate_object / _table / _column / _schema — the "it's already there" family. */
const DUPLICATE_CODES = new Set(["42710", "42P07", "42701", "42P06"]);

function isDuplicateObject(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    DUPLICATE_CODES.has(String((err as { code: unknown }).code))
  );
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const sql = neon(url);

  await sql`CREATE SCHEMA IF NOT EXISTS drizzle`;
  await sql`
    CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )
  `;

  const applied = new Set(
    (
      (await sql`SELECT hash FROM drizzle.__drizzle_migrations`) as Array<{
        hash: string;
      }>
    ).map((r) => r.hash),
  );

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  let ran = 0;
  for (const file of files) {
    const body = readFileSync(join(MIGRATIONS_DIR, file), "utf-8");
    // drizzle hashes the file contents, so an already-applied migration is
    // recognised whichever tool applied it.
    const hash = createHash("sha256").update(body).digest("hex");
    if (applied.has(hash)) {
      console.log(`  skip  ${file}`);
      continue;
    }

    // Statements are separated by drizzle's own breakpoint marker. The HTTP
    // driver runs one statement per round trip, so they cannot be sent as a
    // single blob.
    const statements = body
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);

    console.log(`  apply ${file} (${statements.length} statement(s))`);
    let alreadyPresent = 0;
    for (const statement of statements) {
      try {
        await sql.query(statement);
      } catch (err) {
        // This project's schema was first created with `db:push`, which
        // builds the objects without writing drizzle's ledger. So the very
        // first run sees an empty ledger against a database that already
        // has everything, and would otherwise refuse to move forward.
        //
        // Only "this object already exists" is tolerated, and only because
        // every migration here is additive DDL — the end state is identical
        // whether the statement ran now or was pushed earlier. Any other
        // error still stops the run.
        if (!isDuplicateObject(err)) throw err;
        alreadyPresent++;
      }
    }
    if (alreadyPresent > 0) {
      console.log(
        `        ${alreadyPresent} object(s) already existed — recording as applied`,
      );
    }
    await sql`
      INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
      VALUES (${hash}, ${Date.now()})
    `;
    ran++;
  }

  console.log(ran === 0 ? "Already up to date." : `Applied ${ran} migration(s).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
