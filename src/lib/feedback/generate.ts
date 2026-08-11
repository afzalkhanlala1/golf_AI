import OpenAI from "openai";
import { z } from "zod";
import { getEnv } from "@/lib/env";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/locales";
import {
  PROMPT_VERSION,
  buildSystemPrompt,
  type FindingsPayload,
} from "./prompt";
import { validateGrounding } from "./validate";

export const FeedbackSchema = z.object({
  headline: z.string().max(80),
  primaryFault: z.string(),
  whatIsHappening: z.string().max(400),
  whyItMatters: z.string().max(300),
  drills: z
    .array(
      z.object({
        title: z.string(),
        cue: z.string(),
        reps: z.string(),
      }),
    )
    .min(1)
    .max(2),
  oneThingToFocusOn: z.string().max(140),
});

export type FeedbackOutput = z.infer<typeof FeedbackSchema>;

function templateFeedback(findings: FindingsPayload): FeedbackOutput {
  const primary = findings.faults[0];
  const bestPhase = Object.entries(findings.phaseScores).sort(
    (a, b) => b[1] - a[1],
  )[0];

  if (!primary) {
    return {
      headline: "Solid foundation — keep building consistency",
      primaryFault: "none",
      whatIsHappening: `Your overall score is ${Math.round(findings.overall)}. ${bestPhase ? `Your strongest phase is ${bestPhase[0]} at ${Math.round(bestPhase[1])}.` : ""}`,
      whyItMatters:
        "Repeating this pattern under slight pressure will lock in the gains.",
      drills: [
        {
          title: "Mirror tempo swings",
          cue: "Count 1-2 to the top, 3 through the ball",
          reps: "10",
        },
      ],
      oneThingToFocusOn: "Repeat your current setup feel for ten slow swings.",
    };
  }

  return {
    headline: `Let's tame your ${primary.code.replaceAll("_", " ")}`,
    primaryFault: primary.code,
    whatIsHappening: `We measured ${primary.code.replaceAll("_", " ")} at severity ${primary.severity.toFixed(2)} in the ${primary.phase}. Your overall score is ${Math.round(findings.overall)}.`,
    whyItMatters:
      "Fixing this one pattern usually frees up contact and balance without stacking swing thoughts.",
    drills: [
      {
        title: "Wall posture check",
        cue: "Keep your belt buckle from drifting toward the ball",
        reps: "8",
      },
      {
        title: "Slow-motion half swings",
        cue: "Feel the hips rotate, not thrust",
        reps: "12",
      },
    ],
    oneThingToFocusOn: `On your next range session, only think about the ${primary.phase}: ${primary.code.replaceAll("_", " ")}.`,
  };
}

async function callOpenRouter(
  findings: FindingsPayload,
  locale: Locale,
  violationNote?: string,
): Promise<string> {
  const env = getEnv();
  const client = new OpenAI({
    apiKey: env.OPENROUTER_API_KEY,
    baseURL: "https://openrouter.ai/api/v1",
  });

  const completion = await client.chat.completions.create({
    model: "anthropic/claude-sonnet-4",
    temperature: 0.3,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: buildSystemPrompt(locale) },
      {
        role: "user",
        content: JSON.stringify({
          findings,
          violationNote: violationNote ?? null,
          schema: {
            headline: "string max 80",
            primaryFault: "must equal findings.faults[0].code or none",
            whatIsHappening: "string max 400",
            whyItMatters: "string max 300",
            drills: [{ title: "string", cue: "string", reps: "string 1-20" }],
            oneThingToFocusOn: "string max 140",
          },
        }),
      },
    ],
  });

  return completion.choices[0]?.message?.content ?? "{}";
}

export async function generateFeedback(
  findings: FindingsPayload,
  locale: Locale = DEFAULT_LOCALE,
): Promise<{
  feedback: FeedbackOutput;
  model: string;
  promptVersion: string;
  usedFallback: boolean;
}> {
  const model = "anthropic/claude-sonnet-4";
  let attempt = 0;
  let violationNote: string | undefined;

  while (attempt < 2) {
    attempt += 1;
    try {
      const raw = await callOpenRouter(findings, locale, violationNote);
      const parsed = FeedbackSchema.parse(JSON.parse(raw));

      if (
        findings.faults[0] &&
        parsed.primaryFault !== findings.faults[0].code
      ) {
        violationNote = `primaryFault must equal ${findings.faults[0].code}`;
        continue;
      }

      const corpus = [
        parsed.headline,
        parsed.whatIsHappening,
        parsed.whyItMatters,
        parsed.oneThingToFocusOn,
        ...parsed.drills.flatMap((d) => [d.title, d.cue, d.reps]),
      ].join("\n");

      const violations = validateGrounding(corpus, findings);
      if (violations.length > 0) {
        violationNote = violations.join("; ");
        continue;
      }

      return {
        feedback: parsed,
        model,
        promptVersion: PROMPT_VERSION,
        usedFallback: false,
      };
    } catch {
      violationNote = "Model output failed schema or JSON parse";
    }
  }

  return {
    feedback: templateFeedback(findings),
    model: "template-fallback",
    promptVersion: PROMPT_VERSION,
    usedFallback: true,
  };
}
