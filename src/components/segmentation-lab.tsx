"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PoseFrame } from "@/lib/metrics/geometry";
import {
  GROUP_COLORS,
  PART_META,
  computePartMotion,
  segmentBodyParts,
  type BodyPartGroup,
  type BodyPartId,
} from "@/lib/segmentation/body-parts";
import { Button } from "@/components/ui/button";
import { buildDemoSequence } from "@/lib/segmentation/demo-sequence";
import {
  extractPoseFromVideo,
  preloadPoseModel,
} from "@/lib/segmentation/browser-pose";

type SwingOption = {
  id: string;
  label: string;
  blobUrl: string;
};

type KeypointPayload = {
  fps: number;
  width: number;
  height: number;
  frameCount: number;
  frames: number[][][];
};

type Mode = "upload" | "swing" | "demo";

const GROUPS: BodyPartGroup[] = ["head", "torso", "arms", "legs"];
const GROUP_LABEL: Record<BodyPartGroup, string> = {
  head: "Head",
  torso: "Torso & hips",
  arms: "Arms",
  legs: "Legs",
};

function toPoseFrames(payload: KeypointPayload): PoseFrame[] {
  return payload.frames.map((frame) =>
    frame.map(([x, y, c]) => ({ x: x ?? 0, y: y ?? 0, c: c ?? 0 })),
  );
}

function rgba(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

export function SegmentationLab({ swings }: { swings: SwingOption[] }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<Mode>("upload");
  const [selectedId, setSelectedId] = useState<string>(swings[0]?.id ?? "");
  const [frames, setFrames] = useState<PoseFrame[] | null>(null);
  const [meta, setMeta] = useState<{ fps: number; width: number; height: number } | null>(
    null,
  );
  const [frameIndex, setFrameIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Upload-mode state
  const [uploadUrl, setUploadUrl] = useState<string | null>(null);
  const [uploadName, setUploadName] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [missed, setMissed] = useState<number | null>(null);
  const [lowRes, setLowRes] = useState<{ w: number; h: number } | null>(null);

  const [enabled, setEnabled] = useState<Record<BodyPartGroup, boolean>>({
    head: true,
    torso: true,
    arms: true,
    legs: true,
  });
  const [showLabels, setShowLabels] = useState(true);

  const demo = useMemo(() => buildDemoSequence(), []);

  // Start fetching the pose model as soon as the lab opens so the first
  // upload isn't paying for a cold model download.
  useEffect(() => {
    preloadPoseModel();
  }, []);

  // Release the object URL when the clip is replaced or the lab unmounts.
  useEffect(() => {
    return () => {
      if (uploadUrl) URL.revokeObjectURL(uploadUrl);
    };
  }, [uploadUrl]);

  async function handleFile(file: File) {
    setError(null);
    setMissed(null);
    setLowRes(null);
    setProgress(0);
    setFrames(null);
    setFrameIndex(0);
    setLoading(true);

    if (uploadUrl) URL.revokeObjectURL(uploadUrl);
    const url = URL.createObjectURL(file);
    setUploadUrl(url);
    setUploadName(file.name);
    setMode("upload");

    try {
      const result = await extractPoseFromVideo(file, setProgress);
      setFrames(result.frames);
      setMeta({ fps: result.fps, width: result.width, height: result.height });
      setMissed(result.missedFrames);
      setLowRes(
        result.lowResolution ? { w: result.width, h: result.height } : null,
      );
      if (result.missedFrames === result.frames.length) {
        setError(
          "No person was detected in any frame. Check the golfer is fully in frame and reasonably lit.",
        );
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not run pose on that video.",
      );
    } finally {
      setLoading(false);
    }
  }

  // Load keypoints for demo / saved-swing modes.
  useEffect(() => {
    let cancelled = false;

    if (mode === "demo") {
      setFrames(demo.frames);
      setMeta({ fps: demo.fps, width: demo.width, height: demo.height });
      setFrameIndex(0);
      setError(null);
      setMissed(null);
      return;
    }

    if (mode !== "swing" || !selectedId) return;

    setLoading(true);
    setError(null);
    setMissed(null);
    fetch(`/api/swings/${selectedId}/keypoints`, { cache: "no-store" })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Failed to load keypoints");
        return json as KeypointPayload;
      })
      .then((payload) => {
        if (cancelled) return;
        setFrames(toPoseFrames(payload));
        setMeta({ fps: payload.fps, width: payload.width, height: payload.height });
        setFrameIndex(0);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setFrames(null);
        setError(err instanceof Error ? err.message : "Failed to load keypoints");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [mode, selectedId, demo]);

  const draw = useCallback(
    (index: number) => {
      const canvas = canvasRef.current;
      if (!canvas || !frames || !meta) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      if (canvas.width !== meta.width || canvas.height !== meta.height) {
        canvas.width = meta.width;
        canvas.height = meta.height;
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const frame = frames[Math.max(0, Math.min(index, frames.length - 1))];
      if (!frame) return;

      for (const region of segmentBodyParts(frame)) {
        if (!enabled[region.group]) continue;
        const color = GROUP_COLORS[region.group];
        // Confidence drives opacity, so a shakily-tracked limb visibly reads
        // as less certain rather than looking as solid as a confident one.
        const alpha = 0.22 + 0.3 * region.confidence;

        ctx.beginPath();
        region.polygon.forEach((p, i) => {
          if (i === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        });
        ctx.closePath();
        ctx.fillStyle = rgba(color, alpha);
        ctx.fill();
        ctx.strokeStyle = rgba(color, 0.95);
        ctx.lineWidth = Math.max(1.5, meta.width / 500);
        ctx.stroke();

        if (showLabels) {
          const size = Math.max(11, meta.width / 48);
          ctx.font = `600 ${size}px ui-sans-serif, system-ui, sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.lineWidth = Math.max(2.5, size / 5);
          ctx.strokeStyle = "rgba(0,0,0,0.72)";
          ctx.strokeText(region.label, region.centroid.x, region.centroid.y);
          ctx.fillStyle = "#ffffff";
          ctx.fillText(region.label, region.centroid.x, region.centroid.y);
        }
      }
    },
    [frames, meta, enabled, showLabels],
  );

  // Follow video playback whenever there's a real video element driving it.
  const videoDriven = mode === "swing" || mode === "upload";
  useEffect(() => {
    if (!videoDriven || !frames || !meta) return;
    const video = videoRef.current;
    if (!video) return;

    const tick = () => {
      setFrameIndex(Math.round(video.currentTime * meta.fps));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [videoDriven, frames, meta]);

  // Auto-advance the demo (no video element to drive it).
  useEffect(() => {
    if (mode !== "demo" || !frames) return;
    const id = setInterval(() => {
      setFrameIndex((i) => (i + 1) % frames.length);
    }, 1000 / 30);
    return () => clearInterval(id);
  }, [mode, frames]);

  useEffect(() => {
    draw(frameIndex);
  }, [draw, frameIndex]);

  const motion = useMemo(
    () => (frames && meta ? computePartMotion(frames, meta.fps) : []),
    [frames, meta],
  );
  const maxSpeed = motion[0]?.peakSpeed ?? 0;
  const currentSwing = swings.find((s) => s.id === selectedId);
  const videoSrc =
    mode === "upload" ? uploadUrl : mode === "swing" ? currentSwing?.blobUrl : null;

  return (
    <div className="mt-8 space-y-8">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant={mode === "upload" ? "default" : "outline"}
          onClick={() => setMode("upload")}
          className="h-9"
        >
          Upload a video
        </Button>
        <Button
          type="button"
          variant={mode === "swing" ? "default" : "outline"}
          onClick={() => setMode("swing")}
          disabled={swings.length === 0}
          className="h-9"
        >
          Analyzed swings
        </Button>
        <Button
          type="button"
          variant={mode === "demo" ? "default" : "outline"}
          onClick={() => setMode("demo")}
          className="h-9"
        >
          Synthetic demo
        </Button>
        {mode === "swing" && swings.length > 0 && (
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="h-9 rounded-lg border border-[color:var(--line)] bg-white px-3 text-sm"
          >
            {swings.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        )}
      </div>

      {mode === "upload" && (
        <div className="space-y-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            className="flex w-full flex-col items-center justify-center rounded-xl border border-dashed border-[color:var(--fairway-soft)] bg-white/60 px-4 py-8 text-center transition hover:bg-white disabled:opacity-60"
          >
            <span className="font-medium text-[color:var(--fairway)]">
              {uploadName ?? "Choose a video to segment"}
            </span>
            <span className="mt-1 text-sm text-[color:var(--ink-muted)]">
              Runs entirely in your browser — nothing is uploaded, any framerate works
            </span>
          </button>

          {loading && (
            <div className="space-y-1">
              <div className="h-2 overflow-hidden rounded-full bg-[color:var(--mist)]">
                <div
                  className="h-full bg-[color:var(--fairway)] transition-all"
                  style={{ width: `${Math.round(progress * 100)}%` }}
                />
              </div>
              <p className="text-xs text-[color:var(--ink-muted)]">
                Running pose · {Math.round(progress * 100)}%
              </p>
            </div>
          )}

          {lowRes && (
            <p className="rounded-lg bg-[color:var(--sand-soft)] px-3 py-2 text-sm text-[color:var(--ink)]">
              This clip is {lowRes.w}×{lowRes.h}. Pose at that size is coarse,
              so regions will look rough — fine for checking the plumbing, not
              for judging accuracy. (The GolfDB Kaggle mirror is 160×160 for
              exactly this reason; source higher-resolution clips for real
              pose work.)
            </p>
          )}

          {missed != null && missed > 0 && frames && missed < frames.length && (
            <p className="rounded-lg bg-[color:var(--sand-soft)] px-3 py-2 text-sm text-[color:var(--ink)]">
              No person found in {missed} of {frames.length} frames — those gaps
              render empty.
            </p>
          )}
        </div>
      )}

      {swings.length === 0 && mode === "swing" && (
        <p className="rounded-xl border border-[color:var(--line)] bg-white/70 px-4 py-3 text-sm text-[color:var(--ink-muted)]">
          No analyzed swings with stored keypoints yet.
        </p>
      )}

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {error}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
        <div className="space-y-3">
          <div className="relative overflow-hidden rounded-2xl border border-[color:var(--line)] bg-black">
            {videoSrc ? (
              <video
                ref={videoRef}
                src={videoSrc}
                controls
                playsInline
                className="block max-h-[520px] w-full object-contain"
              />
            ) : (
              <div
                className="w-full"
                style={{ aspectRatio: `${demo.width} / ${demo.height}`, maxHeight: 520 }}
              />
            )}
            <canvas
              ref={canvasRef}
              className="pointer-events-none absolute inset-0 h-full w-full object-contain"
            />
          </div>

          {loading && mode !== "upload" && (
            <p className="text-sm text-[color:var(--ink-muted)]">Loading keypoints…</p>
          )}

          {frames && (
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={Math.max(0, frames.length - 1)}
                value={Math.min(frameIndex, frames.length - 1)}
                onChange={(e) => {
                  const idx = Number(e.target.value);
                  setFrameIndex(idx);
                  if (videoDriven && videoRef.current && meta) {
                    videoRef.current.currentTime = idx / meta.fps;
                  }
                }}
                className="flex-1 accent-[color:var(--fairway)]"
              />
              <span className="w-24 shrink-0 text-right text-xs tabular-nums text-[color:var(--ink-muted)]">
                frame {Math.min(frameIndex, frames.length - 1)} / {frames.length - 1}
              </span>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            {GROUPS.map((g) => (
              <label key={g} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={enabled[g]}
                  onChange={(e) =>
                    setEnabled((prev) => ({ ...prev, [g]: e.target.checked }))
                  }
                />
                <span
                  className="inline-block h-3 w-3 rounded-sm"
                  style={{ background: GROUP_COLORS[g] }}
                />
                {GROUP_LABEL[g]}
              </label>
            ))}
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={showLabels}
                onChange={(e) => setShowLabels(e.target.checked)}
              />
              Labels
            </label>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-xl text-[color:var(--fairway)]">
              Which part moved most
            </h2>
            <p className="mt-1 text-sm text-[color:var(--ink-muted)]">
              Peak centroid speed per region, normalised by shoulder width so it
              is comparable across camera distances.
            </p>
          </div>

          {motion.length === 0 ? (
            <p className="text-sm text-[color:var(--ink-muted)]">
              No motion data yet — segment a clip to populate this.
            </p>
          ) : (
            <ul className="space-y-2">
              {motion.map((m) => (
                <li key={m.id}>
                  <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                    <span className="flex items-center gap-2 text-[color:var(--ink)]">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-sm"
                        style={{ background: GROUP_COLORS[m.group] }}
                      />
                      {m.label}
                    </span>
                    <span className="shrink-0 tabular-nums text-xs text-[color:var(--ink-muted)]">
                      {m.peakSpeed.toFixed(1)} sw/s · f{m.peakFrame}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-[color:var(--mist)]">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${maxSpeed ? (m.peakSpeed / maxSpeed) * 100 : 0}%`,
                        background: GROUP_COLORS[m.group],
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="rounded-xl border border-[color:var(--line)] bg-white/70 px-4 py-3 text-xs leading-relaxed text-[color:var(--ink-muted)]">
            <p className="font-medium text-[color:var(--ink)]">How this works</p>
            <p className="mt-1">
              Regions are derived geometrically from pose keypoints — no separate
              segmentation model runs. The pixel-accurate alternatives (Meta&apos;s
              Sapiens, DensePose) are licensed <strong>CC BY-NC</strong> and cannot
              ship commercially.
            </p>
            <p className="mt-2">
              <strong>Uploaded clips</strong> are posed in-browser with MediaPipe
              (Apache-2.0) for instant feedback. <strong>Analyzed swings</strong>{" "}
              use the stored RTMPose keypoints — the same ones your scores and
              faults are computed from. Expect the RTMPose path to be the more
              accurate of the two; this lab is for eyeballing regions, not for
              scoring.
            </p>
          </div>
        </div>
      </div>

      <p className="text-xs text-[color:var(--ink-muted)]">
        {(Object.keys(PART_META) as BodyPartId[]).length} regions tracked ·
        confidence drives region opacity, so poorly-tracked limbs read as
        uncertain rather than solid.
      </p>
    </div>
  );
}
