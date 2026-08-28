"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ReviewUnlockForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/review/unlock", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "That access code is not on the list.");
        return;
      }
      router.push("/review/sample");
      router.refresh();
    } catch {
      setError("Could not reach the review. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-9 max-w-md">
      <label className="block text-[13px]">
        <span className="gi-kicker">Access code</span>
        <input
          name="code"
          autoComplete="off"
          spellCheck={false}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="GRIP-XXXX-XXXX"
          className="mt-2 w-full border border-[color:var(--rule-strong)] bg-[color:var(--surface)] px-3.5 py-3 font-mono text-[15px] tracking-[0.08em] uppercase outline-none focus:border-[color:var(--green)]"
          required
        />
      </label>
      {error ? (
        <p className="mt-3 text-[13px]" style={{ color: "var(--bad)" }} role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending || code.trim().length < 4}
        className="mt-6 rounded-[3px] bg-[color:var(--green)] px-6 py-3 text-[14px] font-semibold tracking-[0.03em] text-[color:var(--primary-foreground)] transition hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Checking…" : "Open the sample"}
      </button>
    </form>
  );
}
