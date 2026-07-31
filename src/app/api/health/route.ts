import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const started = Date.now();
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    return NextResponse.json(
      {
        ok: false,
        service: "golf-ai",
        db: { connected: false, error: "DATABASE_URL is not set" },
        latencyMs: Date.now() - started,
      },
      { status: 503 },
    );
  }

  try {
    const sql = neon(databaseUrl);
    const rows = await sql`select 1 as ok`;
    const connected = Array.isArray(rows) && rows.length > 0;

    return NextResponse.json({
      ok: connected,
      service: "golf-ai",
      db: { connected },
      latencyMs: Date.now() - started,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown database error";

    return NextResponse.json(
      {
        ok: false,
        service: "golf-ai",
        db: { connected: false, error: message },
        latencyMs: Date.now() - started,
      },
      { status: 503 },
    );
  }
}
