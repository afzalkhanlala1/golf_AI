"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FAULT_CODES,
  FAULT_LABELS,
  type CoachReviewLabels,
} from "@/lib/review/labels";

const FAULTS = FAULT_CODES;

export function ReviewLabelForm({
  coachName,
  initial,
}: {
  coachName: string;
  initial: CoachReviewLabels | null;
}) {
  const router = useRouter();
  const [overallScore, setOverallScore] = useState(initial?.overallScore ?? 70);
  const [faults, setFaults] = useState<string[]>(initial?.faults ?? []);
  const [primaryFault, setPrimaryFault] = useState(initial?.primaryFault ?? "none");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const primaryOptions = useMemo(() => {
    const selected = FAULTS.filter((code) => faults.includes(code));
    if (primaryFault !== "none" && !selected.includes(primaryFault as (typeof FAULTS)[number])) {
      return [primaryFault, ...selected];
    }
    return selected;
  }, [faults, primaryFault]);

  function toggleFault(code: string) {
    setFaults((prev) => {
      const next = prev.includes(code)
        ? prev.filter((c) => c !== code)
        : [...prev, code];
      if (primaryFault === code && !next.includes(code)) {
        setPrimaryFault("none");
      }
      return next;
    });
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/review/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          overallScore: Number(overallScore),
          primaryFault,
          faults,
          notes,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not save the review.");
        return;
      }
      router.push("/review/thanks");
      router.refresh();
    } catch {
      setError("Could not save the review. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-10">
      <p className="text-[13px] text-[color:var(--muted)]">
        Reviewing as <span className="text-[color:var(--ink)]">{coachName}</span>
      </p>

      <label className="mt-8 block">
        <span className="gi-kicker">Overall score</span>
        <span className="mt-2 flex items-baseline gap-3">
          <input
            type="number"
            min={0}
            max={100}
            value={overallScore}
            onChange={(e) => setOverallScore(Number(e.target.value))}
            className="w-24 border border-[color:var(--rule-strong)] bg-[color:var(--surface)] px-3 py-2.5 text-[16px] outline-none focus:border-[color:var(--green)]"
            required
          />
          <span className="text-[13px] text-[color:var(--muted)]">out of 100</span>
        </span>
      </label>

      <fieldset className="mt-8">
        <legend className="gi-kicker">Faults you see in this sample</legend>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {FAULTS.map((code) => (
            <label
              key={code}
              className="flex cursor-pointer items-center gap-2.5 border border-[color:var(--rule)] px-3 py-2.5 text-[13.5px]"
            >
              <input
                type="checkbox"
                checked={faults.includes(code)}
                onChange={() => toggleFault(code)}
              />
              {FAULT_LABELS[code]}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="mt-8 block">
        <span className="gi-kicker">Primary fault</span>
        <select
          value={primaryFault}
          onChange={(e) =>
            setPrimaryFault(e.target.value as CoachReviewLabels["primaryFault"])
          }
          className="mt-2 w-full max-w-md border border-[color:var(--rule-strong)] bg-[color:var(--surface)] px-3 py-2.5 text-[14px] outline-none focus:border-[color:var(--green)]"
        >
          <option value="none">None / clean swing</option>
          {primaryOptions.map((code) => (
            <option key={code} value={code}>
              {FAULT_LABELS[code as keyof typeof FAULT_LABELS] ?? code}
            </option>
          ))}
        </select>
      </label>

      <label className="mt-8 block">
        <span className="gi-kicker">Notes</span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={5}
          maxLength={2000}
          placeholder="What would you tell this golfer first?"
          className="mt-2 w-full border border-[color:var(--rule-strong)] bg-[color:var(--surface)] px-3.5 py-3 text-[14px] leading-[1.6] outline-none focus:border-[color:var(--green)]"
        />
      </label>

      {error ? (
        <p className="mt-4 text-[13px]" style={{ color: "var(--bad)" }} role="alert">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="mt-6 rounded-[3px] bg-[color:var(--green)] px-6 py-3 text-[14px] font-semibold tracking-[0.03em] text-[color:var(--primary-foreground)] transition hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Saving…" : initial ? "Update review" : "Submit review"}
      </button>
    </form>
  );
}
