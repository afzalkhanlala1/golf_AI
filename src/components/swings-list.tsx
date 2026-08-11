"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { formatDateTime } from "@/lib/format/date";

type SwingRow = {
  id: string;
  club: string | null;
  view: string;
  status: string;
  createdAt: Date;
};

const STATUS_TONE: Record<string, string> = {
  COMPLETE: "var(--green)",
  QUEUED: "var(--faint)",
  PROCESSING: "var(--faint)",
  FAILED: "var(--bad)",
  REJECTED: "var(--bad)",
};

export function SwingsList({ initialSwings }: { initialSwings: SwingRow[] }) {
  const [rows, setRows] = useState(initialSwings);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  /** Which row is asking for confirmation. Inline rather than window.confirm
   *  so the destructive step is styled and cancellable in place. */
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function handleDelete(id: string) {
    setConfirmId(null);
    setDeletingId(id);
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/swings/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Failed to delete swing");
        setRows((prev) => prev.filter((r) => r.id !== id));
      } catch {
        setError("Couldn't delete that swing. Try again.");
      } finally {
        setDeletingId(null);
      }
    });
  }

  if (rows.length === 0) {
    return (
      <div className="animate-rise border border-dashed border-[color:var(--rule-strong)] px-6 py-20 text-center">
        <p className="gi-display text-2xl">No swings yet</p>
        <p className="mx-auto mt-3 max-w-sm text-[13px] leading-[1.7] text-[color:var(--muted)]">
          Film one clip on your phone&apos;s slow-motion camera and send it through.
          The ledger starts with your first upload.
        </p>
        <Link
          href="/upload"
          className="mt-6 inline-block border border-[color:var(--green)] px-5 py-2.5 text-[13px] font-semibold tracking-[0.03em] text-[color:var(--green)] transition hover:bg-[color:var(--green-soft)]"
        >
          Upload your first clip
        </Link>
      </div>
    );
  }

  return (
    <div className="animate-rise">
      {error ? (
        <p
          className="mb-4 border-l-2 py-2 pl-3 text-[12.5px]"
          style={{ borderColor: "var(--bad)", color: "var(--bad)" }}
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {["No.", "Recorded", "Club · view", "Status", ""].map((h, i) => (
                <th
                  key={h + i}
                  className="border-b border-[color:var(--rule-strong)] py-3 pr-3 text-left text-[9.5px] font-medium tracking-[0.16em] text-[color:var(--faint)] uppercase"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((s, i) => (
              <tr key={s.id} className="gi-row">
                <td className="py-4 pr-3 text-[12px] tabular-nums text-[color:var(--faint)]">
                  {String(rows.length - i).padStart(2, "0")}
                </td>
                <td className="py-4 pr-3 text-[13.5px] whitespace-nowrap">
                  <Link
                    href={`/swings/${s.id}`}
                    className="transition hover:text-[color:var(--green)]"
                  >
                    {formatDateTime(s.createdAt)}
                  </Link>
                </td>
                <td className="py-4 pr-3 text-[12.5px] text-[color:var(--muted)] capitalize">
                  {(s.club ?? "swing").replace("-", " ")} ·{" "}
                  {s.view.replaceAll("_", " ")}
                </td>
                <td className="py-4 pr-3">
                  <span
                    className="text-[10px] tracking-[0.12em] uppercase"
                    style={{ color: STATUS_TONE[s.status] ?? "var(--faint)" }}
                  >
                    {s.status.toLowerCase()}
                  </span>
                </td>
                <td className="py-4 text-right whitespace-nowrap">
                  {confirmId === s.id ? (
                    <span className="inline-flex items-center gap-3">
                      <span className="text-[11.5px] text-[color:var(--muted)]">
                        Delete?
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDelete(s.id)}
                        className="cursor-pointer text-[11.5px] tracking-[0.08em] uppercase"
                        style={{ color: "var(--bad)" }}
                      >
                        Yes
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmId(null)}
                        className="cursor-pointer text-[11.5px] tracking-[0.08em] text-[color:var(--muted)] uppercase"
                      >
                        No
                      </button>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-4">
                      <Link
                        href={`/swings/${s.id}`}
                        className="text-[11.5px] tracking-[0.08em] text-[color:var(--muted)] uppercase transition hover:text-[color:var(--green)]"
                      >
                        Open
                      </Link>
                      <button
                        type="button"
                        aria-label={`Delete swing from ${formatDateTime(s.createdAt)}`}
                        disabled={deletingId === s.id}
                        onClick={() => setConfirmId(s.id)}
                        className="cursor-pointer text-[11.5px] tracking-[0.08em] text-[color:var(--faint)] uppercase transition hover:text-[color:var(--bad)] disabled:opacity-50"
                      >
                        {deletingId === s.id ? "…" : "Delete"}
                      </button>
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
