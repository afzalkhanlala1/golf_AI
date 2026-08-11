"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BONES, JOINTS, MAJOR_JOINTS, eventLabel } from "@/lib/segmentation/skeleton";
import {
  buildTimeWarp,
  isVisible3,
  prepareSequence,
  project,
  type Camera,
  type EventRow,
  type Pose3,
} from "@/lib/three-d/skeleton3d";

type KeypointResponse = {
  fps: number;
  frameCount: number;
  world: number[][][] | null;
  events?: EventRow[];
};

type GhostOption = { id: string; label: string };

type Loaded = {
  poses: Array<Pose3 | null>;
  fps: number;
  events: EventRow[];
};

const PRIMARY_COLOR = "#7ee0a0";
const GHOST_COLOR = "#6aa8ff";
const SPEEDS = [0.25, 0.5, 1] as const;

/**
 * Camera presets named for what a golfer would call them, not for their
 * angles. "Face-on" and "Down-the-line" match the two views they already
 * film from, so the 3D view is anchored to something familiar before they
 * start dragging it around.
 */
const VIEWS: Array<{ label: string; azimuth: number; elevation: number }> = [
  { label: "Face-on", azimuth: 0, elevation: 0.12 },
  { label: "Down-the-line", azimuth: Math.PI / 2, elevation: 0.12 },
  { label: "Above", azimuth: 0, elevation: 1.15 },
  { label: "Rear", azimuth: Math.PI, elevation: 0.12 },
];

async function loadSwing(id: string): Promise<Loaded | { error: string }> {
  const res = await fetch(`/api/swings/${id}/keypoints`, { cache: "no-store" });
  const json = (await res.json()) as KeypointResponse & { error?: string };
  if (!res.ok) return { error: json.error ?? "Could not load keypoints." };

  const address = json.events?.find((e) => e.event === "address")?.frame ?? 0;
  const poses = prepareSequence(json.world, address);
  if (!poses) {
    return {
      error:
        "This swing was analysed before 3D tracking existed, or on a backend " +
        "with no 3D model. Re-analyse it to enable 3D playback.",
    };
  }
  return { poses, fps: json.fps || 30, events: json.events ?? [] };
}

export function SwingPlayer3D({
  swingId,
  ghostOptions,
}: {
  swingId: string;
  /** Other swings this golfer owns, offered as ghost comparisons. */
  ghostOptions: GhostOption[];
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | undefined>(undefined);
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const lastTickRef = useRef<number>(0);

  const [primary, setPrimary] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ghostId, setGhostId] = useState<string>("");
  const [ghost, setGhost] = useState<Loaded | null>(null);
  const [ghostError, setGhostError] = useState<string | null>(null);

  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<number>(0.5);
  const [cam, setCam] = useState<Camera>({
    azimuth: 0,
    elevation: 0.12,
    distance: 4.2,
  });
  const [zoom, setZoom] = useState(0.62);

  useEffect(() => {
    let cancelled = false;
    loadSwing(swingId).then((r) => {
      if (cancelled) return;
      if ("error" in r) setError(r.error);
      else setPrimary(r);
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
    loadSwing(ghostId).then((r) => {
      if (cancelled) return;
      if ("error" in r) {
        setGhost(null);
        setGhostError(r.error);
      } else {
        setGhost(r);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [ghostId]);

  const total = primary?.poses.length ?? 0;

  // Ghost frames are looked up through the shared events, so the two swings
  // stay together at address, top and impact even at different tempos.
  const warp = useMemo(() => {
    if (!primary || !ghost) return null;
    return buildTimeWarp(
      primary.events,
      ghost.events,
      primary.poses.length,
      ghost.poses.length,
    );
  }, [primary, ghost]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !primary) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    drawGround(ctx, cam, w, h, zoom);

    const idx = Math.max(0, Math.min(frame, primary.poses.length - 1));
    if (ghost && warp) {
      const gp = ghost.poses[warp(idx)];
      if (gp) drawSkeleton(ctx, gp, cam, w, h, zoom, GHOST_COLOR, 0.5, 0.75);
    }
    const p = primary.poses[idx];
    if (p) drawSkeleton(ctx, p, cam, w, h, zoom, PRIMARY_COLOR, 1, 1);
  }, [primary, ghost, warp, frame, cam, zoom]);

  useEffect(() => {
    draw();
  }, [draw]);

  // Playback advances by wall-clock time, not one frame per animation frame,
  // so a 240fps clip and a 30fps clip both play at real speed.
  useEffect(() => {
    if (!playing || !primary) return;
    lastTickRef.current = performance.now();
    const tick = (now: number) => {
      const dt = (now - lastTickRef.current) / 1000;
      lastTickRef.current = now;
      setFrame((f) => {
        const next = f + dt * primary.fps * speed;
        return next >= primary.poses.length - 1 ? 0 : next;
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [playing, primary, speed]);

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    dragRef.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    dragRef.current = { x: e.clientX, y: e.clientY };
    setCam((c) => ({
      ...c,
      azimuth: c.azimuth + dx * 0.01,
      // Clamped short of straight up: at the pole the scene spins about the
      // view axis and the golfer appears to tumble.
      elevation: Math.max(-1.4, Math.min(1.4, c.elevation + dy * 0.01)),
    }));
  }
  function onPointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    dragRef.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
  }

  if (error) {
    return (
      <div className="rounded-[2px] border border-[color:var(--line)] p-6 text-sm text-[color:var(--ink-muted)]">
        3D playback unavailable — {error}
      </div>
    );
  }

  if (!primary) {
    return (
      <div className="flex h-[420px] items-center justify-center rounded-[2px] bg-[color:var(--mist)] text-sm text-[color:var(--ink-muted)]">
        Loading 3D skeleton…
      </div>
    );
  }

  const idx = Math.round(frame);
  const currentEvent = primary.events.find((e) => Math.abs(e.frame - idx) < 2);

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-[2px] bg-[#0b0f0d]">
        <canvas
          ref={canvasRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onWheel={(e) => {
            setZoom((z) => Math.max(0.25, Math.min(1.6, z - e.deltaY * 0.0008)));
          }}
          className="block h-[420px] w-full cursor-grab touch-none active:cursor-grabbing"
        />

        {currentEvent && (
          <span className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded-full bg-black/70 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
            {eventLabel(currentEvent.event)}
          </span>
        )}

        <div className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-3 text-[11px] text-white/70">
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: PRIMARY_COLOR }}
            />
            This swing
          </span>
          {ghost && (
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: GHOST_COLOR }}
              />
              Ghost
            </span>
          )}
        </div>

        <span className="pointer-events-none absolute bottom-3 right-3 text-[11px] text-white/40">
          drag to orbit · scroll to zoom
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {VIEWS.map((v) => (
          <button
            key={v.label}
            type="button"
            onClick={() =>
              setCam((c) => ({ ...c, azimuth: v.azimuth, elevation: v.elevation }))
            }
            className="rounded-md bg-[color:var(--mist)] px-2.5 py-1 text-xs text-[color:var(--ink-muted)] transition hover:text-[color:var(--ink)]"
          >
            {v.label}
          </button>
        ))}
      </div>

      <input
        type="range"
        min={0}
        max={Math.max(0, total - 1)}
        value={Math.min(idx, total - 1)}
        onChange={(e) => {
          setPlaying(false);
          setFrame(Number(e.target.value));
        }}
        className="w-full accent-[color:var(--fairway)]"
        aria-label="Scrub 3D swing"
      />

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <button
          type="button"
          onClick={() => setPlaying((p) => !p)}
          className="rounded-md bg-[color:var(--fairway)] px-3 py-1 text-xs text-[color:var(--primary-foreground)]"
        >
          {playing ? "Pause" : "Play"}
        </button>
        {SPEEDS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSpeed(s)}
            className={`rounded-md px-2 py-1 text-xs transition ${
              speed === s
                ? "bg-[color:var(--fairway)] text-[color:var(--primary-foreground)]"
                : "bg-[color:var(--mist)] text-[color:var(--ink-muted)] hover:text-[color:var(--ink)]"
            }`}
          >
            {s === 1 ? "1×" : `${s}×`}
          </button>
        ))}

        {ghostOptions.length > 0 && (
          <label className="ml-auto flex items-center gap-2 text-xs text-[color:var(--ink-muted)]">
            Ghost
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

      {ghostError && (
        <p className="text-xs text-[color:var(--ink-muted)]">Ghost unavailable — {ghostError}</p>
      )}

      <p className="text-xs text-[color:var(--ink-muted)]">
        {ghost
          ? "Both swings are scaled to the same torso length and lined up on their shared events, so you are comparing shape and timing rather than height or clip length."
          : "Reconstructed from the metric 3D pose — the same landmarks the metrics are computed from."}
      </p>
    </div>
  );
}

/** Faint ground ring, so orbiting has a horizon to read against. */
function drawGround(
  ctx: CanvasRenderingContext2D,
  cam: Camera,
  w: number,
  h: number,
  zoom: number,
) {
  // Feet sit roughly two torso lengths below the hip origin.
  const y = -2.05;
  ctx.strokeStyle = "rgba(255,255,255,0.07)";
  ctx.lineWidth = 1;

  for (let r = 0.5; r <= 2.5; r += 0.5) {
    ctx.beginPath();
    for (let a = 0; a <= Math.PI * 2 + 0.01; a += Math.PI / 32) {
      const p = project(
        { x: Math.cos(a) * r, y, z: Math.sin(a) * r, v: 1 },
        cam,
        w,
        h,
        zoom,
      );
      if (a === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
  }
}

function drawSkeleton(
  ctx: CanvasRenderingContext2D,
  pose: Pose3,
  cam: Camera,
  w: number,
  h: number,
  zoom: number,
  colour: string,
  alpha: number,
  weight: number,
) {
  const pts = pose.map((p) => project(p, cam, w, h, zoom));

  // Painter's algorithm. Without sorting, the far arm draws over the near
  // one and the pose reads inside-out — which is exactly the depth cue the
  // golfer came to 3D for.
  const bones = BONES.filter(
    (b) => isVisible3(pose[b.a]) && isVisible3(pose[b.b]),
  )
    .map((b) => ({
      b,
      depth: (pts[b.a]!.depth + pts[b.b]!.depth) / 2,
    }))
    .sort((x, y) => y.depth - x.depth);

  ctx.lineCap = "round";
  for (const { b, depth } of bones) {
    const a = pts[b.a]!;
    const c = pts[b.b]!;
    // Nearer bones brighter. Cheap, and it does most of the work of making
    // a flat stick figure read as solid.
    const shade = Math.max(0.35, Math.min(1, 5.2 / depth - 0.15));
    ctx.globalAlpha = alpha * shade;
    ctx.strokeStyle = colour;
    ctx.lineWidth = 5 * weight * shade;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(c.x, c.y);
    ctx.stroke();
  }

  const joints = JOINTS.filter((j) => isVisible3(pose[j]))
    .map((j) => ({ j, depth: pts[j]!.depth }))
    .sort((x, y) => y.depth - x.depth);

  for (const { j, depth } of joints) {
    const p = pts[j]!;
    const shade = Math.max(0.35, Math.min(1, 5.2 / depth - 0.15));
    ctx.globalAlpha = alpha * shade;
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.arc(p.x, p.y, (MAJOR_JOINTS.has(j) ? 4.5 : 3) * weight * shade, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = 1;
}
