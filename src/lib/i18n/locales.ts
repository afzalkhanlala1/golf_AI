/**
 * Languages the product speaks.
 *
 * Two separate things are localised, and they are worth keeping distinct:
 *
 * 1. **Interface copy** — buttons, labels, the explanations for why a
 *    measurement is missing. Translated in dictionaries.ts, falling back to
 *    English for any key not yet covered.
 * 2. **Coaching** — the generated feedback on a swing. That is written by
 *    the model at generation time, in the golfer's language, rather than
 *    run through a translation layer afterwards. Coaching is idiomatic
 *    ("you're coming over the top") and machine-translating it produces
 *    something that reads like a manual. See lib/feedback/prompt.ts.
 */

export const SUPPORTED_LOCALES = ["en", "es", "ja", "ko", "de"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

/** Endonyms — a language picker should be readable to the person who needs it. */
export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  es: "Español",
  ja: "日本語",
  ko: "한국어",
  de: "Deutsch",
};

/** What the model is told to write coaching in. */
export const LOCALE_LANGUAGE: Record<Locale, string> = {
  en: "English",
  es: "Spanish (Spain)",
  ja: "Japanese",
  ko: "Korean",
  de: "German",
};

export function isLocale(value: unknown): value is Locale {
  return (
    typeof value === "string" &&
    (SUPPORTED_LOCALES as readonly string[]).includes(value)
  );
}

export function normalizeLocale(value: unknown): Locale {
  if (isLocale(value)) return value;
  // Accept a full BCP-47 tag from the browser ("es-419", "ja-JP") by taking
  // the primary subtag, so Accept-Language headers are usable as-is.
  if (typeof value === "string") {
    const base = value.split("-")[0]?.toLowerCase();
    if (isLocale(base)) return base;
  }
  return DEFAULT_LOCALE;
}
