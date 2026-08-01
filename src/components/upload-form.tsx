"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import { Button } from "@/components/ui/button";

type View = "face_on" | "down_the_line";

export function UploadForm() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [view, setView] = useState<View>("face_on");
  const [club, setClub] = useState("7i");
  const [file, setFile] = useState<File | null>(null);
  const [fpsEstimate, setFpsEstimate] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!file) {
      setFpsEstimate(null);
      return;
    }
    let cancelled = false;
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.src = url;

    video
      .play()
      .then(async () => {
        if (!("requestVideoFrameCallback" in video)) {
          setFpsEstimate(null);
          return;
        }
        let frames = 0;
        const start = performance.now();
        await new Promise<void>((resolve) => {
          const tick = () => {
            frames += 1;
            if (performance.now() - start >= 1000) {
              resolve();
              return;
            }
            (
              video as HTMLVideoElement & {
                requestVideoFrameCallback: (cb: () => void) => void;
              }
            ).requestVideoFrameCallback(tick);
          };
          (
            video as HTMLVideoElement & {
              requestVideoFrameCallback: (cb: () => void) => void;
            }
          ).requestVideoFrameCallback(tick);
        });
        video.pause();
        if (!cancelled) setFpsEstimate(frames);
      })
      .catch(() => {
        if (!cancelled) setFpsEstimate(null);
      })
      .finally(() => URL.revokeObjectURL(url));

    return () => {
      cancelled = true;
    };
  }, [file]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("Choose a slow-motion video first.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const pathname = `swings/${crypto.randomUUID()}/${file.name.replace(/[^\w.-]+/g, "_")}`;
        const blob = await upload(pathname, file, {
          access: "public",
          handleUploadUrl: "/api/blob/token",
          multipart: true,
          onUploadProgress: ({ percentage }) => setProgress(Math.round(percentage)),
        });

        const res = await fetch("/api/swings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            blobUrl: blob.url,
            view,
            club,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? "Failed to create swing");
        }
        const data = (await res.json()) as { swing: { id: string } };
        router.push(`/swings/${data.swing.id}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-8">
      <section className="space-y-3">
        <h2 className="font-[family-name:var(--font-display)] text-xl text-[color:var(--fairway)]">
          Camera angle
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              ["face_on", "Face-on", "Camera points at your chest. Best for sway, slide, early extension."],
              ["down_the_line", "Down-the-line", "Camera behind the ball line. Best for path and shoulder plane."],
            ] as const
          ).map(([value, title, blurb]) => (
            <button
              key={value}
              type="button"
              onClick={() => setView(value)}
              className={`rounded-xl border px-4 py-4 text-left transition ${
                view === value
                  ? "border-[color:var(--fairway)] bg-[color:var(--mist)]"
                  : "border-[color:var(--line)] bg-white/70 hover:border-[color:var(--fairway-soft)]"
              }`}
            >
              <div className="text-sm font-medium text-[color:var(--ink)]">{title}</div>
              <p className="mt-1 text-sm text-[color:var(--ink-muted)]">{blurb}</p>
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-[family-name:var(--font-display)] text-xl text-[color:var(--fairway)]">
          Before you upload
        </h2>
        <ul className="space-y-2 text-sm text-[color:var(--ink-muted)]">
          <li>Full body in frame from address through finish</li>
          <li>Phone locked on a tripod or lean — camera steady</li>
          <li>Native slow-motion at 120fps or higher (not the in-browser camera)</li>
          <li>Clip length about 5–10 seconds, one swing</li>
        </ul>
      </section>

      <section className="space-y-3">
        <label className="block text-sm font-medium text-[color:var(--ink)]">
          Club
          <select
            value={club}
            onChange={(e) => setClub(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-[color:var(--line)] bg-white px-3 py-2 text-sm"
          >
            <option value="dr">Driver</option>
            <option value="3w">3-wood</option>
            <option value="5i">5-iron</option>
            <option value="7i">7-iron</option>
            <option value="pw">Pitching wedge</option>
            <option value="good-demo">Demo: good swing (mock)</option>
            <option value="reject-demo">Demo: low fps reject (mock)</option>
          </select>
        </label>

        <input
          ref={inputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full flex-col items-center justify-center rounded-xl border border-dashed border-[color:var(--fairway-soft)] bg-white/60 px-4 py-10 text-center"
        >
          <span className="font-medium text-[color:var(--fairway)]">
            {file ? file.name : "Choose slow-motion video"}
          </span>
          <span className="mt-1 text-sm text-[color:var(--ink-muted)]">
            MP4 / MOV · upload goes straight to blob storage
          </span>
        </button>

        {fpsEstimate !== null && fpsEstimate < 120 && (
          <p className="rounded-lg bg-[color:var(--sand-soft)] px-3 py-2 text-sm text-[color:var(--ink)]">
            This file looks like ~{fpsEstimate}fps. You can still upload, but analysis quality will drop — prefer native 120/240fps slow-mo.
          </p>
        )}
        {fpsEstimate !== null && fpsEstimate >= 120 && (
          <p className="text-sm text-[color:var(--fairway)]">
            Approximate probe: ~{fpsEstimate}fps — looks good.
          </p>
        )}
      </section>

      {progress > 0 && progress < 100 && (
        <div className="space-y-1">
          <div className="h-2 overflow-hidden rounded-full bg-[color:var(--mist)]">
            <div
              className="h-full bg-[color:var(--fairway)] transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-[color:var(--ink-muted)]">Uploading {progress}%</p>
        </div>
      )}

      {error && <p className="text-sm text-red-700">{error}</p>}

      <Button type="submit" disabled={pending || !file} className="h-10 px-5">
        {pending ? "Uploading…" : "Analyze swing"}
      </Button>
    </form>
  );
}
