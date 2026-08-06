"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PoseFrame } from "@/lib/metrics/geometry";
import {
  alignGhostFrame,
  handPath,
  smoothTrail,
  stableScale,
  type TrailPoint,
} from "@/lib/overlay/ghost2d";
import { extendLine, fitPlaneLine } from "@/lib/overlay/plane";
import { buildTimeWarp } from "@/lib/overlay/time-warp";
import { GROUP_COLORS } from "@/lib/segmentation/body-parts";
import {
  BONES,
  JOINTS,
  MAJOR_JOINTS,
  eventAtFrame,
  eventLabel,
  headOval,
  isVisible,
  trackingBox,
} from "@/lib/segmentation/skeleton";

type EventRow = { event: string; frame: number; timestampMs?: number };

const GHOST_COLOR = "#6aa8ff";
const PLANE_COLOR = "#ffd23f";
const HAND_PATH_COLD = [130, 210, 255] as const;
const HAND_PATH_HOT = [120, 255, 170] as const;

type TracerPoint = { f: number; x: number; y: number; c: number };

type KeypointPayload = {
  fps: number;
  width: number;
  height: number;
  frames: number[][][];
  /** Clubhead path in image pixels. Null when the clip could not support one. */
  tracer: TracerPoint[] | null;
  events?: EventRow[];
};

type GhostOption = { id: string; label: string };

type GhostData = {
  frames: PoseFrame[];
  events: EventRow[];
};

function toPoseFrames(raw: number[][][]): PoseFrame[] {
  return raw.map((f) => f.map(([x, y, c]) => ({ x: x ?? 0, y: y ?? 0, c: c ?? 0 })));
}

const SPEEDS = [0.25, 0.5, 1] as const;

/** Cool at the top of the swing, hot through impact. */
const TRACER_COLD = [90, 190, 255] as const;
const TRACER_HOT = [255, 170, 40] as const;

/** Regions carrying a detected fault are drawn in the fault colour. */
const FAULT_COLOR = "#e0503a";
const BONE_COLOR = "#ffffff";
const OUTLINE = "rgba(0,0,0,0.55)";
const BRACKET = "#f0a020";

/** Overlay toggle with an optional colour swatch matching what it draws. */
function Toggle({
  on,
  onClick,
  children,
  swatch,
  disabled,
  title,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
  swatch?: string;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition ${
        disabled
          ? "cursor-not-allowed bg-[color:var(--mist)] text-[color:var(--ink-muted)] opacity-45"
          : on
            ? "bg-[color:var(--fairway)] text-[color:var(--primary-foreground)]"
            : "bg-[color:var(--mist)] text-[color:var(--ink-muted)] hover:text-[color:var(--ink)]"
      }`}
    >
      {swatch && (
        <span
          className="inline-block h-2 w-2 rounded-full"
          style={{ background: swatch, opacity: on && !disabled ? 1 : 0.4 }}
        />
      )}
      {children}
    </button>
  );
}

/**
 * Draw a motion trail.
 *
 * The whole arc is laid down faintly so the shape is readable in a paused
 * frame, then the part already played is drawn hot on top — so scrubbing
 * shows *where in the arc* you are, which a single static polyline cannot.
 */
function drawTrail(
  ctx: CanvasRenderingContext2D,
  points: TrailPoint[],
  index: number,
  unit: number,
  cold: readonly [number, number, number],
  hot: readonly [number, number, number],
  weight: number,
) {
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.beginPath();
  ctx.moveTo(points[0]!.x, points[0]!.y);
  for (const p of points) ctx.lineTo(p.x, p.y);
  ctx.strokeStyle = "rgba(255,255,255,0.14)";
  ctx.lineWidth = 2 * unit * weight;
  ctx.stroke();

  const played = points.filter((p) => p.f <= index);
  if (played.length < 2) return;

  for (let i = 1; i < played.length; i++) {
    const a = played[i - 1]!;
    const b = played[i]!;
    const t = i / (played.length - 1);
    const col = cold.map((c, k) => Math.round(c + (hot[k]! - c) * t));
    ctx.globalAlpha = 0.35 + 0.65 * Math.min(1, b.c * 1.4);
    ctx.strokeStyle = `rgb(${col[0]},${col[1]},${col[2]})`;
    ctx.lineWidth = (1.5 + 2 * t) * unit * weight;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  const head = played[played.length - 1]!;
  ctx.beginPath();
  ctx.arc(head.x, head.y, 3.5 * unit * weight, 0, Math.PI * 2);
  ctx.fillStyle = `rgb(${hot[0]},${hot[1]},${hot[2]})`;
  ctx.fill();
}

/**
 * The reference swing, drawn translucent behind the live one.
 *
 * No outline and no joint dots — the ghost has to stay clearly secondary to
 * the golfer's own skeleton, and outlining it would give it the same visual
 * weight and turn the overlay into a tangle.
 */
function drawGhostSkeleton(
  ctx: CanvasRenderingContext2D,
  frame: PoseFrame,
  unit: number,
) {
  ctx.globalAlpha = 0.55;
  ctx.strokeStyle = GHOST_COLOR;
  ctx.lineWidth = 4 * unit;
  ctx.lineCap = "round";
  for (const bone of BONES) {
    if (!isVisible(frame, bone.a) || !isVisible(frame, bone.b)) continue;
    ctx.beginPath();
    ctx.moveTo(frame[bone.a]!.x, frame[bone.a]!.y);
    ctx.lineTo(frame[bone.b]!.x, frame[bone.b]!.y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

/**
 * Draw the clubhead path.
 *
 * The whole arc is laid down faintly so the shape of the swing plane is
 * readable in a paused frame, then the part already played is drawn hot on
 * top. That way scrubbing shows *where in the arc* the club is, which a
 * single static polyline cannot.
 */
function drawTracer(
  ctx: CanvasRenderingContext2D,
  tracer: TracerPoint[],
  index: number,
  unit: number,
) {
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.beginPath();
  ctx.moveTo(tracer[0]!.x, tracer[0]!.y);
  for (const p of tracer) ctx.lineTo(p.x, p.y);
  ctx.strokeStyle = "rgba(255,255,255,0.16)";
  ctx.lineWidth = 2 * unit;
  ctx.stroke();

  const played = tracer.filter((p) => p.f <= index);
  if (played.length > 1) {
    for (let i = 1; i < played.length; i++) {
      const a = played[i - 1]!;
      const b = played[i]!;
      const t = i / (played.length - 1);
      const col = TRACER_COLD.map((c, k) =>
        Math.round(c + (TRACER_HOT[k]! - c) * t),
      );
      // Interpolated points carry a reduced confidence from the tracker;
      // letting that through as opacity keeps a guessed segment from
      // looking as certain as a measured one.
      ctx.globalAlpha = 0.35 + 0.65 * Math.min(1, b.c * 1.4);
      ctx.strokeStyle = `rgb(${col[0]},${col[1]},${col[2]})`;
      ctx.lineWidth = (1.5 + 2.5 * t) * unit;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    const head = played[played.length - 1]!;
    ctx.beginPath();
    ctx.arc(head.x, head.y, 4 * unit, 0, Math.PI * 2);
    ctx.fillStyle = `rgb(${TRACER_HOT[0]},${TRACER_HOT[1]},${TRACER_HOT[2]})`;
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.5)";
    ctx.lineWidth = 1.5 * unit;
    ctx.stroke();
  }
}

export function SwingPlayer({
  swingId,
  blobUrl,
  events,
  faultRegions,
  ghostOptions = [],
}: {
  swingId: string;
  blobUrl: string;
  events: EventRow[];
  /** Body regions with an active fault, e.g. ["torso"]. */
  faultRegions: string[];
  /** Other swings offered as an on-video ghost comparison. */
  ghostOptions?: GhostOption[];
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | undefined>(undefined);

  const [frames, setFrames] = useState<PoseFrame[] | null>(null);
  const [meta, setMeta] = useState<{ fps: number; width: number; height: number } | null>(null);
  const [frameIndex, setFrameIndex] = useState(0);
  const [speed, setSpeed] = useState<number>(0.5);
  const [showSkeleton, setShowSkeleton] = useState(true);
  const [tracer, setTracer] = useState<TracerPoint[] | null>(null);
  const [showTracer, setShowTracer] = useState(true);
  const [showHandPath, setShowHandPath] = useState(true);
  const [showPlane, setShowPlane] = useState(false);
  const [unavailable, setUnavailable] = useState<string | null>(null);

  const [ghostId, setGhostId] = useState("");
  const [ghost, setGhost] = useState<GhostData | null>(null);
  const [ghostError, setGhostError] = useState<string | null>(null);

  const faults = useMemo(() => new Set(faultRegions), [faultRegions]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/swings/${swingId}/keypoints`, { cache: "no-store" })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "No keypoints stored");
        return json as KeypointPayload;
      })
      .then((p) => {
        if (cancelled) return;
        setFrames(toPoseFrames(p.frames));
        setMeta({ fps: p.fps, width: p.width, height: p.height });
        setTracer(p.tracer ?? null);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setUnavailable(e instanceof Error ? e.message : "No keypoints stored");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [swingId]);

  useEffect(() => {
    if (!ghostId) {
      setGhost(null);
      setGhostError(null);
      return;
    }
    let cancelled = false;
    setGhostError(null);
    fetch(`/api/swings/${ghostId}/keypoints`, { cache: "no-store" })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Could not load that swing");
        return json as KeypointPayload;
      })
      .then((p) => {
        if (cancelled) return;
        setGhost({ frames: toPoseFrames(p.frames), events: p.events ?? [] });
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setGhost(null);
        setGhostError(e instanceof Error ? e.message : "Could not load that swing");
      });
    return () => {
      cancelled = true;
    };
  }, [ghostId]);

  // Ghost frames are looked up through the two swings' shared events, so the
  // overlay stays together at address, top and impact even at different
  // tempos and clip lengths.
  const ghostWarp = useMemo(() => {
    if (!frames || !ghost) return null;
    return buildTimeWarp(events, ghost.events, frames.length, ghost.frames.length);
  }, [frames, ghost, events]);

  // One scale for the whole clip — see stableScale for why per-frame makes
  // the ghost pulse as it plays.
  const ghostScale = useMemo(() => {
    if (!frames || !ghost) return null;
    return stableScale(frames, ghost.frames);
  }, [frames, ghost]);

  // Computed once for the whole clip rather than per draw — the path does
  // not change as the video plays, only how much of it is revealed.
  const trail = useMemo(() => {
    if (!frames) return [];
    return smoothTrail(handPath(frames, 0, frames.length - 1));
  }, [frames]);

  /**
   * Fitted over top → impact only. A plane line is a statement about the
   * downswing; including the backswing and follow-through would average
   * three different paths into a line that describes none of them.
   *
   * Prefers the clubhead when it was tracked — that is the real swing
   * plane. Falls back to the hand path, which is a genuinely different and
   * steeper line, so the label says which one is on screen.
   */
  const plane = useMemo(() => {
    const frameOf = (name: string) => events.find((e) => e.event === name)?.frame;
    const top = frameOf("top");
    const impact = frameOf("impact");
    if (top === undefined || impact === undefined || impact <= top) return null;

    const fromClub = tracer && tracer.length > 3 ? fitPlaneLine(tracer, top, impact) : null;
    if (fromClub) return { fit: fromClub, source: "club" as const };

    const fromHands = fitPlaneLine(trail, top, impact);
    return fromHands ? { fit: fromHands, source: "hands" as const } : null;
  }, [events, tracer, trail]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = speed;
  }, [speed, frames]);

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

      // Scale line weights off the clip's own size so the overlay looks the
      // same on a 480px portrait clip and a 1080p one.
      const unit = Math.max(meta.width, meta.height) / 480;

      // Plane line first — it is a background reference to read everything
      // else against, so it sits behind even the trails.
      if (showPlane && plane) {
        const { a, b } = extendLine(plane.fit, meta.width, meta.height);
        ctx.save();
        ctx.setLineDash([10 * unit, 7 * unit]);
        ctx.strokeStyle = PLANE_COLOR;
        ctx.lineWidth = 2 * unit;
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        ctx.restore();
      }

      // Trails under the skeleton: both the club and the hands pass behind
      // the body through much of the downswing, and drawing them on top
      // would read as if they were in front.
      if (showHandPath && trail.length > 1) {
        drawTrail(ctx, trail, index, unit, HAND_PATH_COLD, HAND_PATH_HOT, 1);
      }
      if (showTracer && tracer && tracer.length > 1) {
        drawTracer(ctx, tracer, index, unit);
      }

      const frame = frames[Math.max(0, Math.min(index, frames.length - 1))];
      if (!frame) return;

      // Ghost beneath the live skeleton, so where they diverge the golfer's
      // own body stays the readable one.
      if (ghost && ghostWarp) {
        const gf = ghost.frames[ghostWarp(index)];
        if (gf) {
          const aligned = alignGhostFrame(gf, frame, ghostScale ?? undefined);
          if (aligned) drawGhostSkeleton(ctx, aligned, unit);
        }
      }

      if (!showSkeleton) return;

      const box = trackingBox(frame, meta.width, meta.height);
      if (box) {
        const len = Math.min(box.x2 - box.x1, box.y2 - box.y1) * 0.22;
        ctx.strokeStyle = BRACKET;
        ctx.lineWidth = 3 * unit;
        ctx.lineCap = "round";
        const corners: Array<[number, number, number, number]> = [
          [box.x1, box.y1, 1, 1],
          [box.x2, box.y1, -1, 1],
          [box.x1, box.y2, 1, -1],
          [box.x2, box.y2, -1, -1],
        ];
        for (const [cx, cy, sx, sy] of corners) {
          ctx.beginPath();
          ctx.moveTo(cx + sx * len, cy);
          ctx.lineTo(cx, cy);
          ctx.lineTo(cx, cy + sy * len);
          ctx.stroke();
        }
      }

      // Bones, outlined so they stay legible over both grass and sky.
      for (const bone of BONES) {
        if (!isVisible(frame, bone.a) || !isVisible(frame, bone.b)) continue;
        const a = frame[bone.a]!;
        const b = frame[bone.b]!;
        const colour = faults.has(bone.group) ? FAULT_COLOR : BONE_COLOR;

        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = 7 * unit;
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = colour;
        ctx.lineWidth = 4 * unit;
        ctx.stroke();
      }

      for (const j of JOINTS) {
        if (!isVisible(frame, j)) continue;
        const k = frame[j]!;
        const r = (MAJOR_JOINTS.has(j) ? 6 : 4) * unit;
        ctx.beginPath();
        ctx.arc(k.x, k.y, r + 2 * unit, 0, Math.PI * 2);
        ctx.fillStyle = OUTLINE;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(k.x, k.y, r, 0, Math.PI * 2);
        ctx.fillStyle = BONE_COLOR;
        ctx.fill();
      }

      const head = headOval(frame);
      if (head) {
        ctx.beginPath();
        ctx.ellipse(head.cx, head.cy, head.rx, head.ry, 0, 0, Math.PI * 2);
        ctx.fillStyle = faults.has("head") ? FAULT_COLOR : BONE_COLOR;
        ctx.fill();
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = 2 * unit;
        ctx.stroke();
      }

      // Event pill.
      const ev = eventAtFrame(events, index);
      if (ev) {
        const label = eventLabel(ev);
        const size = 15 * unit;
        ctx.font = `700 ${size}px ui-sans-serif, system-ui, sans-serif`;
        const w = ctx.measureText(label).width;
        const padX = 12 * unit;
        const padY = 8 * unit;
        const bx = meta.width / 2 - (w + padX * 2) / 2;
        const by = 16 * unit;
        const bw = w + padX * 2;
        const bh = size + padY * 2;
        const r = bh / 2;

        ctx.beginPath();
        ctx.moveTo(bx + r, by);
        ctx.arcTo(bx + bw, by, bx + bw, by + bh, r);
        ctx.arcTo(bx + bw, by + bh, bx, by + bh, r);
        ctx.arcTo(bx, by + bh, bx, by, r);
        ctx.arcTo(bx, by, bx + bw, by, r);
        ctx.closePath();
        ctx.fillStyle = "rgba(18,23,20,0.82)";
        ctx.fill();

        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(label, meta.width / 2, by + bh / 2);
      }
    },
    [
      frames,
      meta,
      events,
      faults,
      showSkeleton,
      showTracer,
      tracer,
      showHandPath,
      trail,
      ghost,
      ghostWarp,
      ghostScale,
      showPlane,
      plane,
    ],
  );

  useEffect(() => {
    if (!frames || !meta) return;
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
  }, [frames, meta]);

  useEffect(() => {
    draw(frameIndex);
  }, [draw, frameIndex]);

  const totalFrames = frames?.length ?? 0;

  function seekToFrame(f: number) {
    setFrameIndex(f);
    if (videoRef.current && meta) videoRef.current.currentTime = f / meta.fps;
  }

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-xl bg-black">
        <video
          ref={videoRef}
          src={blobUrl}
          controls
          playsInline
          className="block max-h-[520px] w-full object-contain"
        />
        <canvas
          ref={canvasRef}
          className="pointer-events-none absolute inset-0 h-full w-full object-contain"
        />
      </div>

      {unavailable && (
        <p className="text-xs text-[color:var(--ink-muted)]">
          Skeleton overlay unavailable — {unavailable}.
        </p>
      )}

      {frames && meta && (
        <>
          {/* Scrub bar with the eight events marked. */}
          <div className="relative pt-1">
            <input
              type="range"
              min={0}
              max={Math.max(0, totalFrames - 1)}
              value={Math.min(frameIndex, totalFrames - 1)}
              onChange={(e) => seekToFrame(Number(e.target.value))}
              className="w-full accent-[color:var(--fairway)]"
              aria-label="Scrub swing"
            />
            <div className="relative mt-1 h-5">
              {events.map((e) => {
                const pct = totalFrames > 1 ? (e.frame / (totalFrames - 1)) * 100 : 0;
                return (
                  <button
                    key={e.event}
                    type="button"
                    onClick={() => seekToFrame(e.frame)}
                    title={eventLabel(e.event)}
                    style={{ left: `${Math.min(100, Math.max(0, pct))}%` }}
                    className="absolute -translate-x-1/2 text-[9px] uppercase tracking-wide text-[color:var(--ink-muted)] hover:text-[color:var(--fairway)]"
                  >
                    <span className="mx-auto block h-2 w-px bg-[color:var(--line)]" />
                    {e.event.replace("mid_", "").slice(0, 4)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* One panel rather than a wrapped row of loose buttons: playback
              and overlays are different kinds of control and were reading as
              one undifferentiated strip once the overlay count grew. */}
          <div className="rounded-xl border border-[color:var(--line)] bg-[color:var(--mist)]/30 p-3">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              <div className="flex items-center gap-2">
                <span className="text-[11px] uppercase tracking-[0.14em] text-[color:var(--ink-muted)]">
                  Speed
                </span>
                <div className="flex gap-0.5 rounded-md bg-[color:var(--mist)] p-0.5">
                  {SPEEDS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSpeed(s)}
                      className={`rounded px-2 py-1 text-xs transition ${
                        speed === s
                          ? "bg-[color:var(--fairway)] text-[color:var(--primary-foreground)]"
                          : "text-[color:var(--ink-muted)] hover:text-[color:var(--ink)]"
                      }`}
                    >
                      {s === 1 ? "1×" : `${s}×`}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] uppercase tracking-[0.14em] text-[color:var(--ink-muted)]">
                  Overlays
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
              <Toggle on={showSkeleton} onClick={() => setShowSkeleton((v) => !v)}>
                Skeleton
              </Toggle>
              <Toggle
                on={showHandPath}
                onClick={() => setShowHandPath((v) => !v)}
                swatch={`rgb(${HAND_PATH_HOT.join(",")})`}
                disabled={trail.length < 2}
              >
                Hand path
              </Toggle>
              <Toggle
                on={showTracer}
                onClick={() => setShowTracer((v) => !v)}
                swatch={`rgb(${TRACER_HOT.join(",")})`}
                disabled={!tracer || tracer.length < 2}
                title={
                  !tracer || tracer.length < 2
                    ? "Club tracer needs a clip at 60fps or higher"
                    : undefined
                }
              >
                Club tracer
              </Toggle>
              <Toggle
                on={showPlane}
                onClick={() => setShowPlane((v) => !v)}
                swatch={PLANE_COLOR}
                disabled={!plane}
                title={
                  !plane ? "Needs a detected top and impact to fit a plane" : undefined
                }
              >
                Plane
              </Toggle>
                </div>
              </div>

              {ghostOptions.length > 0 && (
                <label className="ml-auto flex items-center gap-2">
                  <span className="text-[11px] uppercase tracking-[0.14em] text-[color:var(--ink-muted)]">
                    Ghost
                  </span>
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ background: GHOST_COLOR, opacity: ghostId ? 1 : 0.35 }}
                  />
                  <select
                    value={ghostId}
                    onChange={(e) => setGhostId(e.target.value)}
                    className="rounded-md border border-[color:var(--line)] bg-transparent px-2 py-1 text-xs"
                  >
                    <option value="">None</option>
                    {ghostOptions.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          </div>

          {showPlane && plane && (
            <p className="flex flex-wrap items-center gap-2 text-xs text-[color:var(--ink-muted)]">
              <span
                className="inline-block h-2.5 w-2.5 rounded-sm"
                style={{ background: PLANE_COLOR }}
              />
              {plane.source === "club"
                ? "Club plane — fitted to the tracked clubhead from top to impact"
                : "Hand plane — fitted to your hand path from top to impact. The clubhead travels on a flatter plane than the hands, so this is not the club's plane; tracking the club needs 60fps."}
              {" · "}
              <strong>{plane.fit.angleFromVertical.toFixed(0)}° from vertical</strong>
            </p>
          )}

          {ghost && (
            <p className="flex items-center gap-2 text-xs text-[color:var(--ink-muted)]">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ background: GHOST_COLOR }}
              />
              Scaled to your leg span and lined up on shared events. Orientation
              is left alone — that difference is the point.
            </p>
          )}
          {ghostError && (
            <p className="text-xs text-[color:var(--ink-muted)]">{ghostError}</p>
          )}

          {faultRegions.length > 0 && (
            <p className="flex items-center gap-2 text-xs text-[color:var(--ink-muted)]">
              <span
                className="inline-block h-2.5 w-2.5 rounded-sm"
                style={{ background: FAULT_COLOR }}
              />
              Regions with a detected fault are drawn in red
              <span className="ml-1">
                ({faultRegions.map((r) => r).join(", ")})
              </span>
            </p>
          )}
          <p className="text-xs text-[color:var(--ink-muted)]">
            Frame {Math.min(frameIndex, totalFrames - 1)} / {totalFrames - 1}
            {" · "}
            <span style={{ color: GROUP_COLORS.torso }}>overlay drawn from the same
            keypoints the metrics are computed from</span>
          </p>
        </>
      )}
    </div>
  );
}
