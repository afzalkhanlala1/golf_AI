"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import { Button } from "@/components/ui/button";
import { FramingCheck } from "@/components/framing-check";
import { DEMO_SWINGS, type DemoId } from "@/lib/demos";

type View = "face_on" | "down_the_line";

/**
 * `userId` arrives as a prop from the server page rather than from Clerk's
 * useAuth(): under the development auth bypass there is no ClerkProvider
 * mounted, so the hook would throw.
 */
export function UploadForm({ userId }: { userId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [view, setView] = useState<View>("face_on");
  const [club, setClub] = useState("7i");
  const [file, setFile] = useState<File | null>(null);
  const [fpsEstimate, setFpsEstimate] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [demoPending, setDemoPending] = useState<DemoId | null>(null);

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

  function runDemo(demo: DemoId) {
    setError(null);
    setDemoPending(demo);
    startTransition(async () => {
      try {
        const res = await fetch("/api/swings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ demo, view }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? "Failed to start demo");
        }
        const data = (await res.json()) as { swing: { id: string } };
        router.push(`/swings/${data.swing.id}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Demo failed");
        setDemoPending(null);
      }
    });
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("Choose a slow-motion video first.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        // Must match /api/blob/token path guard: swings/<userId>/...
        const pathname = `swings/${userId}/${crypto.randomUUID()}/${file.name.replace(/[^\w.-]+/g, "_")}`;
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
          Try a demo (no video needed)
        </h2>
        <p className="text-sm text-[color:var(--ink-muted)]">
          Runs the full mock analysis pipeline — score, faults, and coaching — in about six seconds.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          {DEMO_SWINGS.map((d) => (
            <button
              key={d.id}
              type="button"
              disabled={pending}
              onClick={() => runDemo(d.id)}
              className="rounded-[2px] border border-[color:var(--line)] bg-[color:var(--surface)] px-4 py-4 text-left transition hover:border-[color:var(--fairway)] hover:bg-[color:var(--mist)] disabled:opacity-60"
            >
              <div className="text-sm font-medium text-[color:var(--fairway)]">
                {demoPending === d.id ? "Starting…" : d.title}
              </div>
              <p className="mt-1 text-xs text-[color:var(--ink-muted)]">
                {d.description}
              </p>
            </button>
          ))}
        </div>
      </section>

      <div className="relative py-2 text-center text-xs uppercase tracking-[0.2em] text-[color:var(--ink-muted)]">
        <span className="bg-[color:var(--fog)] px-3 relative z-10">or upload your own</span>
        <span className="absolute inset-x-0 top-1/2 h-px bg-[color:var(--line)]" />
      </div>

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
              className={`rounded-[2px] border px-4 py-4 text-left transition ${
                view === value
                  ? "border-[color:var(--fairway)] bg-[color:var(--mist)]"
                  : "border-[color:var(--line)] bg-[color:var(--surface)] hover:border-[color:var(--fairway-soft)]"
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
          <li>Native slow-motion at 120fps+ for the most accurate impact read — 30fps minimum accepted</li>
          <li>Clip length about 5–10 seconds, one swing</li>
        </ul>
        {/* Placed here rather than after the file picker: the point is to
            catch a bad frame before the golfer goes out and hits one. */}
        <FramingCheck />
      </section>

      <section className="space-y-3">
        <label className="block text-sm font-medium text-[color:var(--ink)]">
          Club
          <select
            value={club}
            onChange={(e) => setClub(e.target.value)}
            className="mt-1.5 w-full rounded-[2px] border border-[color:var(--line)] bg-[color:var(--surface)] px-3 py-2 text-sm"
          >
            <option value="dr">Driver</option>
            <option value="3w">3-wood</option>
            <option value="5i">5-iron</option>
            <option value="7i">7-iron</option>
            <option value="pw">Pitching wedge</option>
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
          className="flex w-full flex-col items-center justify-center rounded-[2px] border border-dashed border-[color:var(--fairway-soft)] bg-[color:var(--surface)] px-4 py-10 text-center"
        >
          <span className="font-medium text-[color:var(--fairway)]">
            {file ? file.name : "Choose slow-motion video"}
          </span>
          <span className="mt-1 text-sm text-[color:var(--ink-muted)]">
            MP4 / MOV · upload goes straight to blob storage
          </span>
        </button>

        {fpsEstimate !== null && fpsEstimate < 24 && (
          <p className="border-l-2 border-[color:var(--bad)] bg-[color:var(--sunk)] px-3 py-2 text-sm text-[color:var(--bad)]">
            This file looks like ~{fpsEstimate}fps — too low to track a swing at all. Re-film at 30fps or higher.
          </p>
        )}
        {fpsEstimate !== null && fpsEstimate >= 24 && fpsEstimate < 120 && (
          <p className="rounded-[2px] bg-[color:var(--sand-soft)] px-3 py-2 text-sm text-[color:var(--ink)]">
            This file looks like ~{fpsEstimate}fps. It will be analyzed, but confidence around impact will be reduced — prefer native 120/240fps slow-mo when you can.
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

      {error && <p className="text-sm text-[color:var(--bad)]">{error}</p>}

      <Button type="submit" disabled={pending || !file} className="h-10 px-5">
        {pending ? "Uploading…" : "Analyze swing"}
      </Button>
    </form>
  );
}
