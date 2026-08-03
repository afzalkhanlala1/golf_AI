import { getEnv } from "@/lib/env";
import {
  buildMockAnalysis,
  pickMockVariant,
  sleep,
  type MockVariant,
} from "./mock";
import type { AnalysisResult } from "../../../contract/analysis.schema";

export type StartInferenceInput = {
  swingId: string;
  blobUrl: string;
  view: "face_on" | "down_the_line" | "unknown";
  club?: string | null;
  callbackUrl?: string;
};

export type InferenceKickoff =
  | { mode: "sync"; result: AnalysisResult }
  | { mode: "async"; accepted: true };

/**
 * Mock: runs locally and returns AnalysisResult after a delay.
 * Modal: fire-and-forget POST; the GPU service callbacks /api/swings/:id/callback.
 */
export async function startInference(
  input: StartInferenceInput,
): Promise<InferenceKickoff> {
  const env = getEnv();

  if (env.INFERENCE_MODE === "mock") {
    await sleep(6_000);
    const variant: MockVariant = pickMockVariant(input.club);
    return {
      mode: "sync",
      result: buildMockAnalysis(input.swingId, variant),
    };
  }

  if (!env.INFERENCE_URL) {
    throw new Error("INFERENCE_URL is required when INFERENCE_MODE=modal");
  }

  const callbackUrl =
    input.callbackUrl ??
    `${env.NEXT_PUBLIC_APP_URL}/api/swings/${input.swingId}/callback`;

  const res = await fetch(`${env.INFERENCE_URL.replace(/\/$/, "")}/analyze`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Inference-Secret": env.INFERENCE_SHARED_SECRET,
    },
    body: JSON.stringify({
      swingId: input.swingId,
      blobUrl: input.blobUrl,
      view: input.view,
      club: input.club ?? null,
      callbackUrl,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Inference service error: ${res.status} ${text}`);
  }

  return { mode: "async", accepted: true };
}

/** @deprecated use startInference */
export async function runInference(
  input: StartInferenceInput,
): Promise<AnalysisResult> {
  const kickoff = await startInference(input);
  if (kickoff.mode === "sync") return kickoff.result;
  throw new Error(
    "Modal inference is asynchronous; wait for the HMAC callback instead of awaiting a result",
  );
}
