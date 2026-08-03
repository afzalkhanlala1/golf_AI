"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type SwingRow = {
  id: string;
  club: string | null;
  view: string;
  status: string;
  createdAt: Date;
};

export function SwingsList({ initialSwings }: { initialSwings: SwingRow[] }) {
  const [rows, setRows] = useState(initialSwings);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function handleDelete(id: string) {
    if (!confirm("Delete this swing? This can't be undone.")) return;
    setDeletingId(id);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/swings/${id}`, { method: "DELETE" });
        if (!res.ok) {
          throw new Error("Failed to delete swing");
        }
        setRows((prev) => prev.filter((r) => r.id !== id));
      } catch {
        alert("Couldn't delete this swing. Try again.");
      } finally {
        setDeletingId(null);
      }
    });
  }

  if (rows.length === 0) {
    return (
      <div className="mt-10 rounded-xl border border-dashed border-[color:var(--line)] px-6 py-12 text-center">
        <p className="text-[color:var(--ink-muted)]">No swings yet.</p>
        <Link
          href="/upload"
          className="mt-3 inline-block text-sm font-medium text-[color:var(--fairway)] underline"
        >
          Upload your first clip
        </Link>
      </div>
    );
  }

  return (
    <ul className="mt-8 space-y-3">
      {rows.map((s) => (
        <li
          key={s.id}
          className="flex items-center justify-between gap-3 rounded-xl border border-[color:var(--line)] bg-white/70 px-4 py-4 transition hover:border-[color:var(--fairway-soft)]"
        >
          <Link href={`/swings/${s.id}`} className="min-w-0 flex-1">
            <div className="font-medium capitalize">
              {(s.club ?? "swing").replace("-", " ")} · {s.view.replaceAll("_", " ")}
            </div>
            <div className="text-sm text-[color:var(--ink-muted)]">
              {s.createdAt.toLocaleString()}
            </div>
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            <Badge variant="secondary">{s.status}</Badge>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Delete swing"
              disabled={deletingId === s.id}
              onClick={(e) => {
                e.preventDefault();
                handleDelete(s.id);
              }}
              className="text-[color:var(--ink-muted)] hover:bg-destructive/10 hover:text-destructive"
            >
              {deletingId === s.id ? "…" : "✕"}
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
