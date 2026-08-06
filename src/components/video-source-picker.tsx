"use client";

import { useEffect, useState } from "react";

type SwingRow = {
  id: string;
  blobUrl: string;
  club: string | null;
  view: string;
  status: string;
  createdAt: string;
};

/**
 * Pick a video: a new file, or one already uploaded.
 *
 * Every tool in the app used to demand its own file upload, so analysing a
 * swing and then inspecting it in the lab meant sending the same clip twice
 * and waiting for it twice. The clip is already in blob storage after the
 * first upload; there is no reason to ask for it again.
 *
 * Both labs are built around a `File`, so a stored swing is fetched back
 * and handed over as one. That keeps this a drop-in replacement for the
 * file input rather than a rewrite of every consumer.
 */
export function VideoSourcePicker({
  onSelect,
  busy,
  hint,
}: {
  onSelect: (file: File, label: string) => void;
  busy?: boolean;
  hint?: string;
}) {
  const [swings, setSwings] = useState<SwingRow[]>([]);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/swings", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { swings: [] }))
      .then((json: { swings?: SwingRow[] }) => {
        setSwings((json.swings ?? []).filter((s) => s.blobUrl).slice(0, 12));
      })
      .catch(() => {
        // No library is not an error worth showing — the file input still works.
      });
  }, []);

  async function pickStoredSwing(s: SwingRow) {
    setError(null);
    setLoadingId(s.id);
    try {
      const res = await fetch(s.blobUrl);
      if (!res.ok) throw new Error(`Could not fetch that clip (${res.status})`);
      const blob = await res.blob();
      const name = `swing-${s.id.slice(0, 8)}.mp4`;
      onSelect(new File([blob], name, { type: blob.type || "video/mp4" }), name);
    } catch (e) {
      setError(
        e instanceof Error
          ? `${e.message}. You can still choose the file from your device.`
          : "Could not load that clip.",
      );
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <label
          className={`inline-flex cursor-pointer items-center rounded-md bg-[color:var(--fairway)] px-4 py-2 text-sm text-[color:var(--primary-foreground)] ${
            busy ? "pointer-events-none opacity-60" : ""
          }`}
        >
          Choose a video
          <input
            type="file"
            accept="video/*"
            className="hidden"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onSelect(f, f.name);
              e.currentTarget.value = "";
            }}
          />
        </label>
        {hint && (
          <span className="text-xs text-[color:var(--ink-muted)]">{hint}</span>
        )}
      </div>

      {swings.length > 0 && (
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--ink-muted)]">
            Or reuse a swing you already uploaded
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {swings.map((s) => {
              const when = new Date(s.createdAt).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              });
              const label = [when, s.club, s.view.replace(/_/g, "-")]
                .filter(Boolean)
                .join(" · ");
              return (
                <button
                  key={s.id}
                  type="button"
                  disabled={busy || loadingId !== null}
                  onClick={() => pickStoredSwing(s)}
                  className="rounded-md border border-[color:var(--line)] px-3 py-1.5 text-xs text-[color:var(--ink-muted)] transition hover:border-[color:var(--fairway)] hover:text-[color:var(--ink)] disabled:opacity-50"
                >
                  {loadingId === s.id ? "Loading…" : label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {error && (
        <p className="text-xs text-[color:var(--ink-muted)]">{error}</p>
      )}
    </div>
  );
}
