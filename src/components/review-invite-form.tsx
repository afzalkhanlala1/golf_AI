"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ReviewInviteForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [issued, setIssued] = useState<{ name: string; code: string } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/review/invites", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = (await res.json()) as {
        error?: string;
        name?: string;
        code?: string;
      };
      if (!res.ok || !data.code || !data.name) {
        setError(data.error ?? "Could not issue a code.");
        return;
      }
      setIssued({ name: data.name, code: data.code });
      setName("");
      router.refresh();
    } catch {
      setError("Could not issue a code. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-10 border border-[color:var(--rule)] px-5 py-5">
      <p className="gi-kicker">Issue an access code</p>
      <form onSubmit={onSubmit} className="mt-3 flex flex-wrap items-end gap-3">
        <label className="min-w-[16rem] flex-1 text-[13px]">
          <span className="text-[color:var(--muted)]">Coach name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Jane PGA"
            className="mt-1.5 w-full border border-[color:var(--rule-strong)] bg-[color:var(--surface)] px-3 py-2.5 outline-none focus:border-[color:var(--green)]"
            required
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded-[3px] border border-[color:var(--green)] px-4 py-2.5 text-[13px] font-semibold tracking-[0.03em] text-[color:var(--green)] transition hover:bg-[color:var(--green-soft)] disabled:opacity-50"
        >
          {pending ? "Issuing…" : "Issue code"}
        </button>
      </form>
      {error ? (
        <p className="mt-3 text-[13px]" style={{ color: "var(--bad)" }} role="alert">
          {error}
        </p>
      ) : null}
      {issued ? (
        <div className="mt-4 border border-[color:var(--green-line)] bg-[color:var(--green-soft)] px-4 py-3">
          <p className="text-[13px] text-[color:var(--ink)]">
            Send this to {issued.name}. It is shown once — we store a hash,
            not the code.
          </p>
          <p className="mt-2 font-mono text-[18px] tracking-[0.12em]">
            {issued.code}
          </p>
          <p className="mt-2 text-[12px] text-[color:var(--muted)]">
            They open /review and enter that code, then label the sample clip.
          </p>
        </div>
      ) : null}
    </div>
  );
}
