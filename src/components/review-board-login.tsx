"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ReviewBoardLogin() {
  const router = useRouter();
  const [secret, setSecret] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/review/board/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ secret }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not unlock the board.");
        return;
      }
      router.refresh();
    } catch {
      setError("Could not unlock the board. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-9 max-w-md">
      <label className="block text-[13px]">
        <span className="gi-kicker">Board password</span>
        <input
          type="password"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          className="mt-2 w-full border border-[color:var(--rule-strong)] bg-[color:var(--surface)] px-3.5 py-3 text-[15px] outline-none focus:border-[color:var(--green)]"
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
        disabled={pending}
        className="mt-6 rounded-[3px] bg-[color:var(--green)] px-6 py-3 text-[14px] font-semibold tracking-[0.03em] text-[color:var(--primary-foreground)] transition hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Checking…" : "Open the board"}
      </button>
    </form>
  );
}
