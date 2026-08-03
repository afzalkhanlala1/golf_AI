/**
 * Phase D smoke: POST /analyze/sync and validate against AnalysisResult.
 *
 * Env (from .env.local or process):
 *   INFERENCE_URL
 *   INFERENCE_SHARED_SECRET
 *   SMOKE_VIDEO_URL (optional) — public clip URL; prefer ≥120fps
 */
import { config } from "dotenv";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { AnalysisResult } from "../contract/analysis.schema";

config({ path: resolve(process.cwd(), ".env.local") });
config();

const INFERENCE_URL = (process.env.INFERENCE_URL ?? "").replace(/\/$/, "");
const SECRET = process.env.INFERENCE_SHARED_SECRET ?? "";
const SMOKE_VIDEO_URL =
  process.env.SMOKE_VIDEO_URL ??
  // Public sample; may be REJECTED for low fps — still validates schema.
  "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";

async function main() {
  if (!INFERENCE_URL) {
    console.error("INFERENCE_URL is required");
    process.exit(1);
  }
  if (!SECRET) {
    console.error("INFERENCE_SHARED_SECRET is required");
    process.exit(1);
  }

  const swingId = randomUUID();
  console.log(`POST ${INFERENCE_URL}/analyze/sync`);
  console.log(`swingId=${swingId}`);
  console.log(`video=${SMOKE_VIDEO_URL}`);

  const res = await fetch(`${INFERENCE_URL}/analyze/sync`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Inference-Secret": SECRET,
    },
    body: JSON.stringify({
      swingId,
      blobUrl: SMOKE_VIDEO_URL,
      view: "face_on",
      club: null,
    }),
  });

  const text = await res.text();
  if (!res.ok) {
    console.error(`HTTP ${res.status}: ${text.slice(0, 800)}`);
    process.exit(1);
  }

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    console.error("Response is not JSON");
    process.exit(1);
  }

  const parsed = AnalysisResult.safeParse(json);
  if (!parsed.success) {
    console.error("Schema validation failed:");
    console.error(JSON.stringify(parsed.error.flatten(), null, 2));
    process.exit(1);
  }

  const r = parsed.data;
  console.log("OK — AnalysisResult validates");
  console.log(`  status: ${r.status}`);
  console.log(`  fps: ${r.capture.fps}`);
  console.log(`  events: ${r.events.length}`);
  console.log(`  metrics: ${r.metrics.length}`);
  console.log(`  keypointsUrl: ${r.keypointsUrl ?? "null"}`);
  if (r.status === "REJECTED") {
    console.log(`  rejectionReason: ${r.rejectionReason}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
