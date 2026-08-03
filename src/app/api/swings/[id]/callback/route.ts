import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { AnalysisResult } from "../../../../../../contract/analysis.schema";
import { getEnv } from "@/lib/env";
import { persistAnalysisResult } from "@/lib/swings/process";

export const runtime = "nodejs";
export const maxDuration = 60;

type Params = { params: Promise<{ id: string }> };

function verifySignature(rawBody: string, signature: string | null): boolean {
  if (!signature) return false;
  const env = getEnv();
  const expected = createHmac("sha256", env.INFERENCE_SHARED_SECRET)
    .update(rawBody)
    .digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  try {
    const rawBody = await request.text();
    const signature = request.headers.get("x-signature");

    if (!verifySignature(rawBody, signature)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const parsed = AnalysisResult.safeParse(payload);
    if (!parsed.success) {
      console.error("[callback] schema", parsed.error.flatten());
      return NextResponse.json(
        { error: "Invalid AnalysisResult", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    if (parsed.data.swingId !== id) {
      return NextResponse.json({ error: "swingId mismatch" }, { status: 400 });
    }

    const result = await persistAnalysisResult(parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Callback failed";
    console.error("[callback]", id, message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
