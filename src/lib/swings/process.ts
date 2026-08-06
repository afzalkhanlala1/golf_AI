import { eq } from "drizzle-orm";
import { AnalysisResult } from "../../../contract/analysis.schema";
import { getDb } from "@/lib/db";
import {
  feedback,
  swingEvents,
  swingFaults,
  swingMetrics,
  swingScores,
  swings,
  users,
} from "@/lib/db/schema";
import { normalizeLocale } from "@/lib/i18n/locales";
import { detectFaults } from "@/lib/scoring/faults";
import { scoreAnalysis } from "@/lib/scoring/score";
import { generateFeedback } from "@/lib/feedback/generate";
import type { FindingsPayload } from "@/lib/feedback/prompt";

export async function persistAnalysisResult(raw: AnalysisResult) {
  const parsed = AnalysisResult.parse(raw);
  const db = getDb();

  if (parsed.status === "REJECTED") {
    await db
      .update(swings)
      .set({
        status: "REJECTED",
        rejectionReason: parsed.rejectionReason,
        fps: parsed.capture.fps,
        durationMs: Math.round(parsed.capture.durationMs),
        frameCount: parsed.capture.frameCount,
        qualityWarnings: parsed.quality.warnings,
        keypointsUrl: parsed.keypointsUrl,
        analyzedAt: new Date(),
        view: parsed.capture.view,
      })
      .where(eq(swings.id, parsed.swingId));
    return { status: "REJECTED" as const };
  }

  const scores = scoreAnalysis(parsed);
  const faults = detectFaults(parsed);

  const findings: FindingsPayload = {
    faults,
    metrics: parsed.metrics.map((m) => ({
      key: m.key,
      value: m.value,
      unit: m.unit,
      target: m.target,
    })),
    phaseScores: scores.phases,
    overall: scores.overall,
    qualityWarnings: parsed.quality.warnings,
  };

  // Coaching is written in the golfer's language, so it has to be looked up
  // from the swing's owner — this runs in a callback from the inference
  // service, where there is no request session to read it from.
  const [owner] = await db
    .select({ locale: users.locale })
    .from(users)
    .innerJoin(swings, eq(swings.userId, users.id))
    .where(eq(swings.id, parsed.swingId))
    .limit(1);

  const { feedback: fb, model, promptVersion } = await generateFeedback(
    findings,
    normalizeLocale(owner?.locale),
  );

  await db
    .update(swings)
    .set({
      status: "COMPLETE",
      rejectionReason: null,
      fps: parsed.capture.fps,
      durationMs: Math.round(parsed.capture.durationMs),
      frameCount: parsed.capture.frameCount,
      qualityWarnings: parsed.quality.warnings,
      keypointsUrl: parsed.keypointsUrl,
      clubTracking: parsed.club,
      analyzedAt: new Date(),
      view: parsed.capture.view,
    })
    .where(eq(swings.id, parsed.swingId));

  await db.delete(swingEvents).where(eq(swingEvents.swingId, parsed.swingId));
  await db.delete(swingMetrics).where(eq(swingMetrics.swingId, parsed.swingId));
  await db.delete(swingFaults).where(eq(swingFaults.swingId, parsed.swingId));
  await db.delete(swingScores).where(eq(swingScores.swingId, parsed.swingId));
  await db.delete(feedback).where(eq(feedback.swingId, parsed.swingId));

  if (parsed.events.length) {
    await db.insert(swingEvents).values(
      parsed.events.map((e) => ({
        swingId: parsed.swingId,
        event: e.event,
        frame: e.frame,
        timestampMs: e.timestampMs,
        confidence: e.confidence,
      })),
    );
  }

  if (parsed.metrics.length) {
    await db.insert(swingMetrics).values(
      parsed.metrics.map((m) => ({
        swingId: parsed.swingId,
        key: m.key,
        value: m.value,
        unit: m.unit,
        phase: m.phase,
        confidence: m.confidence,
        targetMin: m.target?.min ?? null,
        targetMax: m.target?.max ?? null,
      })),
    );
  }

  if (faults.length) {
    await db.insert(swingFaults).values(
      faults.map((f) => ({
        swingId: parsed.swingId,
        code: f.code,
        severity: f.severity,
        phase: f.phase,
        detectedFrom: f.detectedFrom,
        confidence: f.confidence,
      })),
    );
  }

  await db.insert(swingScores).values({
    swingId: parsed.swingId,
    overall: scores.overall,
    setup: scores.phases.setup,
    backswing: scores.phases.backswing,
    top: scores.phases.top,
    downswing: scores.phases.downswing,
    impact: scores.phases.impact,
    finish: scores.phases.finish,
    rubricVersion: scores.rubricVersion,
  });

  await db.insert(feedback).values({
    swingId: parsed.swingId,
    headline: fb.headline,
    primaryFaultCode: fb.primaryFault === "none" ? null : fb.primaryFault,
    body: JSON.stringify({
      whatIsHappening: fb.whatIsHappening,
      whyItMatters: fb.whyItMatters,
      oneThingToFocusOn: fb.oneThingToFocusOn,
    }),
    drills: fb.drills,
    model,
    promptVersion,
  });

  return { status: "COMPLETE" as const, scores, faults };
}

export async function markProcessing(swingId: string) {
  const db = getDb();
  await db
    .update(swings)
    .set({ status: "PROCESSING" })
    .where(eq(swings.id, swingId));
}

export async function markFailed(swingId: string, reason: string) {
  const db = getDb();
  await db
    .update(swings)
    .set({ status: "FAILED", rejectionReason: reason })
    .where(eq(swings.id, swingId));
}
