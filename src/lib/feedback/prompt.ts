import { LOCALE_LANGUAGE, type Locale } from "@/lib/i18n/locales";

/**
 * 1.1.0 — clubhead and ball speed became measured quantities, so the blanket
 * ban on mentioning them was replaced with the same rule everything else
 * follows: use it if it is in the Findings JSON, never otherwise. Also added
 * the output-language instruction.
 */
export const PROMPT_VERSION = "1.1.0";

export const SYSTEM_PROMPT = `You are a golf coach writing brief, specific feedback.

Rules:
- The LLM explains. It never measures. Only use numbers present in the Findings JSON.
- One focus at a time. Name a single primary fault matching findings.faults[0].code.
- Open with something genuinely working, drawn from the highest-scoring phase.
- Plain language. No jargon without a one-clause explanation.
- Never diagnose pain, injury, or physical limitation.
- Never invent a measurement. Clubhead speed, ball speed, smash factor and
  attack angle may be referenced ONLY if they appear in findings.metrics —
  they are absent unless the clip was filmed face-on at 60fps or higher.
- Never mention spin, carry distance, wrist flexion, ground force, or make
  medical claims. Those are not measured at all.
- If quality.warnings is non-empty, say so plainly and reduce confidence of the advice.
- Return ONLY valid JSON matching the schema.`;

/**
 * Coaching is written in the golfer's language at generation time rather
 * than translated afterwards.
 *
 * Swing instruction is idiomatic — "coming over the top", "casting", "staying
 * behind it" — and each language has its own established coaching phrases.
 * Machine-translating English coaching produces something literal that no
 * coach in that language would say. Asking the model to write natively gets
 * the register right; only the JSON keys are pinned to English.
 */
export function buildSystemPrompt(locale: Locale): string {
  if (locale === "en") return SYSTEM_PROMPT;
  return `${SYSTEM_PROMPT}
- Write every string value in ${LOCALE_LANGUAGE[locale]}, using the swing
  terminology a coach in that language would actually use rather than a
  literal translation of English terms.
- JSON keys and the primaryFault code stay exactly as specified in English.`;
}

export type FindingsPayload = {
  faults: Array<{
    code: string;
    severity: number;
    phase: string;
    detectedFrom: string[];
    confidence: number;
  }>;
  metrics: Array<{
    key: string;
    value: number;
    unit: string;
    target: { min: number; max: number } | null;
  }>;
  phaseScores: Record<string, number>;
  overall: number;
  qualityWarnings: string[];
  trend?: string | null;
};
