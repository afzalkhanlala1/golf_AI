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
};

/**
 * Fire-and-forget inference kickoff.
 * Mock mode returns a delayed AnalysisResult locally (no GPU).
 * Modal mode POSTs to the external service (Phase D).
 */
export async function runInference(
  input: StartInferenceInput,
): Promise<AnalysisResult> {
  const env = getEnv();

  if (env.INFERENCE_MODE === "mock") {
    await sleep(6_000);
    const variant: MockVariant = pickMockVariant(input.club);
    return buildMockAnalysis(input.swingId, variant);
  }

  if (!env.INFERENCE_URL) {
    throw new Error("INFERENCE_URL is required when INFERENCE_MODE=modal");
  }

  const res = await fetch(`${env.INFERENCE_URL}/analyze`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Inference-Secret": env.INFERENCE_SHARED_SECRET,
    },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    throw new Error(`Inference service error: ${res.status}`);
  }

  return (await res.json()) as AnalysisResult;
}
