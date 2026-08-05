"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DEFAULT_OPTIONS,
  LOW_RESOLUTION_EDGE,
  PREFERRED_FPS,
  describeOutcome,
  interpolateFrame,
  probeClip,
  sharpen,
  type ClipProbe,
  type EnhanceOptions,
} from "@/lib/preprocess/enhance";

type Built = {
  frames: string[];
  outFps: number;
  realCount: number;
  syntheticCount: number;
  width: number;
  height: number;
};

/** Cap so a long clip can't lock the tab up. */
const MAX_SOURCE_FRAMES = 90;

export function PreprocessLab() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [probe, setProbe] = useState<ClipProbe | null>(null);
  const [opts, setOpts] = useState<EnhanceOptions>(DEFAULT_OPTIONS);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [built, setBuilt] = useState<Built | null>(null);
  const [playIndex, setPlayIndex] = useState(0);

  async function onPick(f: File) {
    setFile(f);
    setProbe(null);
    setBuilt(null);
    setError(null);
    setBusy(true);
    try {
      const p = await probeClip(f);
      setProbe(p);
      // Pre-set sensible options from what we found.
      const longEdge = Math.max(p.width, p.height);
      setOpts((o) => ({
        ...o,
        upscale: longEdge < LOW_RESOLUTION_EDGE ? 2 : 1,
        interpolateFactor:
          p.estimatedFps && p.estimatedFps < PREFERRED_FPS ? 1 : 0,
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read that video.");
    } finally {
      setBusy(false);
    }
  }

  async function run() {
    if (!file || !probe) return;
    setBusy(true);
    setError(null);
    setProgress(0);
    setBuilt(null);

    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.src = url;

    try {
      await new Promise<void>((res, rej) => {
        video.addEventListener("loadedmetadata", () => res(), { once: true });
        video.addEventListener("error", () => rej(new Error("Decode failed")), {
          once: true,
        });
      });

      const srcFps = probe.estimatedFps ?? 30;
      const total = Math.min(
        MAX_SOURCE_FRAMES,
        Math.max(2, Math.round(probe.durationSec * srcFps)),
      );
      const step = probe.durationSec / total;

      const outW = Math.round(probe.width * opts.upscale);
      const outH = Math.round(probe.height * opts.upscale);

      const canvas = document.createElement("canvas");
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
      ctx.imageSmoothingQuality = "high";

      // Pass 1: grab and sharpen every real frame.
      const real: ImageData[] = [];
      for (let i = 0; i < total; i++) {
        const t = Math.min(i * step, Math.max(0, probe.durationSec - 1e-3));
        await new Promise<void>((res) => {
          const done = () => res();
          video.addEventListener("seeked", done, { once: true });
          video.currentTime = t;
          setTimeout(done, 1500);
        });
        ctx.drawImage(video, 0, 0, outW, outH);
        const img = ctx.getImageData(0, 0, outW, outH);
        real.push(opts.sharpenAmount > 0 ? sharpen(img, opts.sharpenAmount) : img);
        setProgress(((i + 1) / total) * 0.6);
      }

      // Pass 2: weave in the synthetic frames.
      const seq: ImageData[] = [];
      let synthetic = 0;
      for (let i = 0; i < real.length; i++) {
        seq.push(real[i]!);
        if (opts.interpolateFactor > 0 && i < real.length - 1) {
          for (let k = 1; k <= opts.interpolateFactor; k++) {
            const t = k / (opts.interpolateFactor + 1);
            seq.push(
              interpolateFrame(real[i]!, real[i + 1]!, t, opts.motionCompensated),
            );
            synthetic += 1;
          }
        }
        setProgress(0.6 + ((i + 1) / real.length) * 0.35);
      }

      // Encode to data URLs for playback.
      const urls: string[] = [];
      for (const img of seq) {
        ctx.putImageData(img, 0, 0);
        urls.push(canvas.toDataURL("image/jpeg", 0.85));
      }

      setBuilt({
        frames: urls,
        outFps: srcFps * (opts.interpolateFactor + 1),
        realCount: real.length,
        syntheticCount: synthetic,
        width: outW,
        height: outH,
      });
      setPlayIndex(0);
      setProgress(1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Processing failed.");
    } finally {
      URL.revokeObjectURL(url);
      video.src = "";
      setBusy(false);
    }
  }

  const outcome = probe ? describeOutcome(probe, opts) : null;
  const longEdge = probe ? Math.max(probe.width, probe.height) : 0;

  return (
    <div className="mt-8 space-y-8">
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onPick(f);
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="flex w-full flex-col items-center justify-center rounded-xl border border-dashed border-[color:var(--fairway-soft)] bg-white/60 px-4 py-8 text-center transition hover:bg-white disabled:opacity-60"
      >
        <span className="font-medium text-[color:var(--fairway)]">
          {file?.name ?? "Choose a video to inspect"}
        </span>
        <span className="mt-1 text-sm text-[color:var(--ink-muted)]">
          Runs entirely in your browser — nothing is uploaded
        </span>
      </button>

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {error}
        </p>
      )}

      {probe && (
        <>
          <section>
            <h2 className="font-[family-name:var(--font-display)] text-xl text-[color:var(--fairway)]">
              What we found
            </h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-4">
              {[
                {
                  label: "Resolution",
                  value: `${probe.width}×${probe.height}`,
                  bad: longEdge < LOW_RESOLUTION_EDGE,
                },
                {
                  label: "Frame rate",
                  value: probe.estimatedFps ? `~${probe.estimatedFps}fps` : "unknown",
                  bad: !!probe.estimatedFps && probe.estimatedFps < PREFERRED_FPS,
                },
                {
                  label: "Duration",
                  value: `${probe.durationSec.toFixed(1)}s`,
                  bad: false,
                },
                {
                  label: "Frames",
                  value: probe.frameCountEstimate?.toString() ?? "—",
                  bad: false,
                },
              ].map((s) => (
                <div
                  key={s.label}
                  className={`rounded-xl border px-4 py-3 ${
                    s.bad
                      ? "border-amber-300 bg-amber-50"
                      : "border-[color:var(--line)] bg-white/80"
                  }`}
                >
                  <p className="text-xs uppercase tracking-[0.14em] text-[color:var(--ink-muted)]">
                    {s.label}
                  </p>
                  <p className="mt-1 font-[family-name:var(--font-display)] text-2xl text-[color:var(--fairway)]">
                    {s.value}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-4 rounded-xl border border-[color:var(--line)] bg-white/70 p-5">
            <h2 className="font-[family-name:var(--font-display)] text-xl text-[color:var(--fairway)]">
              Conditioning
            </h2>

            <label className="block text-sm">
              Sharpen: <strong>{opts.sharpenAmount.toFixed(1)}</strong>
              <input
                type="range" min={0} max={2} step={0.1}
                value={opts.sharpenAmount}
                onChange={(e) =>
                  setOpts((o) => ({ ...o, sharpenAmount: Number(e.target.value) }))
                }
                className="mt-1 w-full accent-[color:var(--fairway)]"
              />
            </label>

            <label className="block text-sm">
              Upscale: <strong>{opts.upscale}×</strong>
              <input
                type="range" min={1} max={4} step={1}
                value={opts.upscale}
                onChange={(e) =>
                  setOpts((o) => ({ ...o, upscale: Number(e.target.value) }))
                }
                className="mt-1 w-full accent-[color:var(--fairway)]"
              />
            </label>

            <label className="block text-sm">
              Synthetic frames between each real pair:{" "}
              <strong>{opts.interpolateFactor}</strong>
              {probe.estimatedFps && (
                <span className="text-[color:var(--ink-muted)]">
                  {" "}→ ~{Math.round(probe.estimatedFps * (opts.interpolateFactor + 1))}fps
                </span>
              )}
              <input
                type="range" min={0} max={3} step={1}
                value={opts.interpolateFactor}
                onChange={(e) =>
                  setOpts((o) => ({
                    ...o,
                    interpolateFactor: Number(e.target.value),
                  }))
                }
                className="mt-1 w-full accent-[color:var(--fairway)]"
              />
            </label>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={opts.motionCompensated}
                onChange={(e) =>
                  setOpts((o) => ({ ...o, motionCompensated: e.target.checked }))
                }
              />
              Motion-compensated (track where each block moved, instead of cross-fading)
            </label>

            {outcome && (
              <div className="space-y-2 text-sm">
                {outcome.improvements.map((s) => (
                  <p key={s} className="text-[color:var(--fairway)]">+ {s}</p>
                ))}
                {outcome.caveats.map((s) => (
                  <p
                    key={s}
                    className="rounded-lg bg-[color:var(--sand-soft)] px-3 py-2 text-[color:var(--ink)]"
                  >
                    {s}
                  </p>
                ))}
              </div>
            )}

            <Button type="button" onClick={run} disabled={busy} className="h-10">
              {busy ? `Processing ${Math.round(progress * 100)}%` : "Process clip"}
            </Button>
          </section>
        </>
      )}

      {built && (
        <section className="space-y-3">
          <h2 className="font-[family-name:var(--font-display)] text-xl text-[color:var(--fairway)]">
            Result
          </h2>
          <p className="text-sm text-[color:var(--ink-muted)]">
            {built.width}×{built.height} · {built.realCount} real +{" "}
            {built.syntheticCount} synthetic frames · ~{Math.round(built.outFps)}fps
          </p>
          <div className="overflow-hidden rounded-2xl border border-[color:var(--line)] bg-black">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={built.frames[Math.min(playIndex, built.frames.length - 1)]}
              alt={`Processed frame ${playIndex}`}
              className="mx-auto block max-h-[520px] w-auto"
            />
          </div>
          <input
            type="range"
            min={0}
            max={built.frames.length - 1}
            value={playIndex}
            onChange={(e) => setPlayIndex(Number(e.target.value))}
            className="w-full accent-[color:var(--fairway)]"
          />
          <p className="text-xs text-[color:var(--ink-muted)]">
            Frame {playIndex} / {built.frames.length - 1}
            {opts.interpolateFactor > 0 &&
              playIndex % (opts.interpolateFactor + 1) !== 0 && (
                <span className="ml-2 rounded bg-[color:var(--sand-soft)] px-1.5 py-0.5 font-medium text-[color:var(--ink)]">
                  synthetic — estimated, not captured
                </span>
              )}
          </p>
        </section>
      )}
    </div>
  );
}
