"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_LOCALE,
  LOCALE_NAMES,
  SUPPORTED_LOCALES,
  normalizeLocale,
  type Locale,
} from "@/lib/i18n/locales";

/**
 * Language for coaching.
 *
 * Labelled for what it actually changes today. The generated coaching on
 * every swing analysed from here on is written in this language; the
 * interface chrome is still English. Calling it "Language" flat would
 * promise more than it delivers, and a golfer who picks 日本語 and sees an
 * English nav bar would reasonably think it was broken.
 */
export function LocalePicker() {
  const [locale, setLocale] = useState<Locale>(DEFAULT_LOCALE);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/profile", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json?.profile?.locale) setLocale(normalizeLocale(json.profile.locale));
      })
      .catch(() => {
        // Falls back to English; not worth interrupting anyone over.
      });
  }, []);

  async function change(next: Locale) {
    setLocale(next);
    setSaving(true);
    setSaved(false);
    try {
      await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: next }),
      });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <label className="flex items-center gap-2 text-xs text-[color:var(--ink-muted)]">
      Coaching language
      <select
        value={locale}
        onChange={(e) => change(e.target.value as Locale)}
        disabled={saving}
        className="rounded-md border border-[color:var(--line)] bg-transparent px-2 py-1 text-xs"
      >
        {SUPPORTED_LOCALES.map((l) => (
          <option key={l} value={l}>
            {LOCALE_NAMES[l]}
          </option>
        ))}
      </select>
      {saved && <span className="text-[color:var(--fairway)]">saved</span>}
    </label>
  );
}
