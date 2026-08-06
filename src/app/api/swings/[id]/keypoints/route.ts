import { gunzipSync } from "node:zlib";
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getAuthUserId } from "@/lib/auth/current-user";
import { getDb } from "@/lib/db";
import { swingEvents, swings } from "@/lib/db/schema";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

/**
 * Proxies the gzipped keypoint blob for a swing the caller owns.
 *
 * The blob is stored as `.json.gz` with an application/gzip content type, so
 * fetch will not transparently inflate it — we gunzip here and hand the
 * client plain JSON. Going through this route (rather than exposing the blob
 * URL directly) keeps the ownership check on the server.
 *
 * The swing's detected events ride along in the response. The 3D player
 * aligns a ghost swing to the primary one through their shared events, so
 * it needs both together; returning them here keeps loading a ghost to a
 * single request instead of a blob fetch plus an analysis fetch.
 */
export async function GET(_request: Request, { params }: Params) {
  const userId = await getAuthUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const db = getDb();

  const [swing] = await db
    .select({ keypointsUrl: swings.keypointsUrl })
    .from(swings)
    .where(and(eq(swings.id, id), eq(swings.userId, userId)))
    .limit(1);

  if (!swing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!swing.keypointsUrl) {
    return NextResponse.json(
      { error: "This swing has no stored keypoints." },
      { status: 404 },
    );
  }

  let res: Response;
  try {
    res = await fetch(swing.keypointsUrl, { cache: "no-store" });
  } catch {
    return NextResponse.json(
      { error: "Could not reach keypoint storage." },
      { status: 502 },
    );
  }
  if (!res.ok) {
    return NextResponse.json(
      { error: `Keypoint fetch failed (${res.status}).` },
      { status: 502 },
    );
  }

  const raw = Buffer.from(await res.arrayBuffer());
  let text: string;
  try {
    // Tolerate an already-inflated body in case the CDN decompressed it.
    text =
      raw[0] === 0x1f && raw[1] === 0x8b
        ? gunzipSync(raw).toString("utf-8")
        : raw.toString("utf-8");
  } catch {
    return NextResponse.json(
      { error: "Stored keypoints could not be decompressed." },
      { status: 502 },
    );
  }

  try {
    const payload = JSON.parse(text);
    const rows = await db
      .select({
        event: swingEvents.event,
        frame: swingEvents.frame,
        timestampMs: swingEvents.timestampMs,
      })
      .from(swingEvents)
      .where(eq(swingEvents.swingId, id));
    return NextResponse.json({ ...payload, events: rows });
  } catch {
    return NextResponse.json(
      { error: "Stored keypoints were not valid JSON." },
      { status: 502 },
    );
  }
}
