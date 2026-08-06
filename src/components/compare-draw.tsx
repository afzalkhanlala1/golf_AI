"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  angleAt,
  angleFromVertical,
  isComplete,
  simplifyStroke,
  toNormalized,
  toPixels,
  type Annotation,
  type Pt,
  type Tool,
} from "@/lib/overlay/annotations";

type SwingRow = {
  id: string;
  blobUrl: string;
  club: string | null;
  view: string;
  createdAt: string;
};

const COLORS = ["#ffd23f", "#4ade80", "#f87171", "#6aa8ff", "#ffffff"];
const TOOLS: Array<{ id: Tool; label: string; hint: string }> = [
  { id: "line", label: "Line", hint: "Two clicks — shaft, spine, plane" },
  { id: "angle", label: "Angle", hint: "Three clicks — vertex second" },
  { id: "free", label: "Freehand", hint: "Click and drag" },
];

export function CompareDraw() {
  const [swings, setSwings] = useState<SwingRow[]>([]);
  const [leftId, setLeftId] = useState("");
  const [rightId, setRightId] = useState("");

  const [tool, setTool] = useState<Tool>("line");
  const [color, setColor] = useState(COLORS[0]!);
  const [linked, setLinked] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(0.5);

  useEffect(() => {
    fetch("/api/swings", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { swings: [] }))
      .then((json: { swings?: SwingRow[] }) => {
        const rows = (json.swings ?? []).filter((s) => s.blobUrl);
        setSwings(rows);
        setLeftId((v) => v || rows[0]?.id || "");
        setRightId((v) => v || rows[1]?.id || rows[0]?.id || "");
      })
      .catch(() => {});
  }, []);

  const leftRef = useRef<HTMLVideoElement>(null);
  const rightRef = useRef<HTMLVideoElement>(null);

  const label = (s: SwingRow) =>
    [
      new Date(s.createdAt).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      }),
      s.club,
      s.view.replace(/_/g, "-"),
    ]
      .filter(Boolean)
      .join(" · ");

  /**
   * Both clips are driven as a fraction of their own duration, not by
   * absolute time. Two swings are never the same length, so scrubbing to
   * "40% through" lines up the phases far better than "1.2 seconds in",
   * which would have one golfer at the top while the other has finished.
   */
  const seekBoth = useCallback((fraction: number) => {
    for (const v of [leftRef.current, rightRef.current]) {
      if (v && Number.isFinite(v.duration)) v.currentTime = v.duration * fraction;
    }
  }, []);

  const setBothPlaying = useCallback((play: boolean) => {
    setPlaying(play);
    for (const v of [leftRef.current, rightRef.current]) {
      if (!v) continue;
      if (play) void v.play().catch(() => {});
      else v.pause();
    }
  }, []);

  useEffect(() => {
    for (const v of [leftRef.current, rightRef.current]) {
      if (v) v.playbackRate = speed;
    }
  }, [speed, leftId, rightId]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm uppercase tracking-[0.18em] text-[color:var(--ink-muted)]">
          Compare &amp; Draw
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-4xl">
          Two swings, side by side.
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-[color:var(--ink-muted)]">
          Scrub both together and draw straight on the frames. Lines and
          angles are anchored to the video, so they stay put when the window
          resizes.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTool(t.id)}
            title={t.hint}
            className={`rounded-md px-3 py-1.5 text-xs transition ${
              tool === t.id
                ? "bg-[color:var(--fairway)] text-[color:var(--primary-foreground)]"
                : "bg-[color:var(--mist)] text-[color:var(--ink-muted)] hover:text-[color:var(--ink)]"
            }`}
          >
            {t.label}
          </button>
        ))}

        <span className="mx-1 h-5 w-px bg-[color:var(--line)]" />

        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={`Colour ${c}`}
            onClick={() => setColor(c)}
            className={`h-6 w-6 rounded-full border-2 transition ${
              color === c ? "border-[color:var(--ink)]" : "border-transparent"
            }`}
            style={{ background: c }}
          />
        ))}

        <span className="mx-1 h-5 w-px bg-[color:var(--line)]" />

        <button
          type="button"
          onClick={() => setBothPlaying(!playing)}
          className="rounded-md bg-[color:var(--fairway)] px-3 py-1.5 text-xs text-[color:var(--primary-foreground)]"
        >
          {playing ? "Pause both" : "Play both"}
        </button>
        {[0.25, 0.5, 1].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSpeed(s)}
            className={`rounded-md px-2 py-1 text-xs transition ${
              speed === s
                ? "bg-[color:var(--fairway)] text-[color:var(--primary-foreground)]"
                : "bg-[color:var(--mist)] text-[color:var(--ink-muted)]"
            }`}
          >
            {s === 1 ? "1×" : `${s}×`}
          </button>
        ))}

        <label className="ml-auto flex items-center gap-2 text-xs text-[color:var(--ink-muted)]">
          <input
            type="checkbox"
            checked={linked}
            onChange={(e) => setLinked(e.target.checked)}
          />
          Link scrubbing
        </label>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ComparePane
          videoRef={leftRef}
          swings={swings}
          selectedId={leftId}
          onSelect={setLeftId}
          label={label}
          tool={tool}
          color={color}
          onScrub={(f) => linked && seekBoth(f)}
        />
        <ComparePane
          videoRef={rightRef}
          swings={swings}
          selectedId={rightId}
          onSelect={setRightId}
          label={label}
          tool={tool}
          color={color}
          onScrub={(f) => linked && seekBoth(f)}
        />
      </div>

      {swings.length === 0 && (
        <p className="text-sm text-[color:var(--ink-muted)]">
          Upload a swing first — this compares clips you have already analysed.
        </p>
      )}
    </div>
  );
}

function ComparePane({
  videoRef,
  swings,
  selectedId,
  onSelect,
  label,
  tool,
  color,
  onScrub,
}: {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  swings: SwingRow[];
  selectedId: string;
  onSelect: (id: string) => void;
  label: (s: SwingRow) => string;
  tool: Tool;
  color: string;
  onScrub: (fraction: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [pending, setPending] = useState<Pt[]>([]);
  const [drawingFree, setDrawingFree] = useState(false);
  const [fraction, setFraction] = useState(0);

  /**
   * The in-progress shape lives in a ref, with state only mirroring it for
   * rendering.
   *
   * Two clicks landing in the same task — a double-click, or just a fast
   * hand — both read the same pre-render value of `pending` from their
   * closure, so the second point overwrites the first instead of completing
   * the shape and nothing is ever committed. A ref is read at the moment of
   * the event, which is what a gesture in progress actually needs.
   */
  const pendingRef = useRef<Pt[]>([]);

  const setPendingPoints = useCallback((pts: Pt[]) => {
    pendingRef.current = pts;
    setPending(pts);
  }, []);

  const swing = swings.find((s) => s.id === selectedId);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const w = wrap.clientWidth;
    const h = wrap.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const all: Array<{ a: Annotation; live: boolean }> = annotations.map((a) => ({
      a,
      live: false,
    }));
    if (pending.length > 0) {
      all.push({ a: { id: "pending", kind: tool, color, points: pending }, live: true });
    }

    for (const { a, live } of all) {
      const pts = a.points.map((p) => toPixels(p, w, h));
      ctx.strokeStyle = a.color;
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.setLineDash(live ? [6, 5] : []);

      if (pts.length > 1) {
        ctx.beginPath();
        ctx.moveTo(pts[0]!.x, pts[0]!.y);
        for (const p of pts.slice(1)) ctx.lineTo(p.x, p.y);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      // Handles, so a placed point is visibly placed.
      if (a.kind !== "free") {
        for (const p of pts) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
          ctx.fillStyle = a.color;
          ctx.fill();
        }
      }

      // Readouts: the number is the reason for drawing the shape.
      let text: string | null = null;
      let at: Pt | null = null;
      if (a.kind === "angle" && a.points.length === 3) {
        const deg = angleAt(a.points[0]!, a.points[1]!, a.points[2]!, w, h);
        if (deg !== null) {
          text = `${deg.toFixed(0)}°`;
          at = pts[1]!;
        }
      } else if (a.kind === "line" && a.points.length === 2) {
        text = `${angleFromVertical(a.points[0]!, a.points[1]!, w, h).toFixed(0)}° from vertical`;
        at = { x: (pts[0]!.x + pts[1]!.x) / 2, y: (pts[0]!.y + pts[1]!.y) / 2 };
      }
      if (text && at) {
        ctx.font = "600 13px ui-sans-serif, system-ui, sans-serif";
        ctx.textAlign = "left";
        ctx.textBaseline = "bottom";
        ctx.lineWidth = 3;
        ctx.strokeStyle = "rgba(0,0,0,0.7)";
        ctx.strokeText(text, at.x + 8, at.y - 8);
        ctx.fillStyle = a.color;
        ctx.fillText(text, at.x + 8, at.y - 8);
      }
    }
  }, [annotations, pending, tool, color]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  useEffect(() => {
    const onResize = () => redraw();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [redraw]);

  function rect() {
    return wrapRef.current!.getBoundingClientRect();
  }

  function onPointerDown(e: React.PointerEvent) {
    const p = toNormalized(e.clientX, e.clientY, rect());
    if (tool === "free") {
      setDrawingFree(true);
      setPendingPoints([p]);
      (e.target as Element).setPointerCapture?.(e.pointerId);
      return;
    }
    const next = [...pendingRef.current, p];
    if (isComplete(tool, next)) {
      setAnnotations((a) => [
        ...a,
        { id: crypto.randomUUID(), kind: tool, color, points: next },
      ]);
      setPendingPoints([]);
    } else {
      setPendingPoints(next);
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!drawingFree) return;
    setPendingPoints([
      ...pendingRef.current,
      toNormalized(e.clientX, e.clientY, rect()),
    ]);
  }

  function onPointerUp() {
    if (!drawingFree) return;
    setDrawingFree(false);
    const stroke = pendingRef.current;
    if (stroke.length > 1) {
      setAnnotations((a) => [
        ...a,
        {
          id: crypto.randomUUID(),
          kind: "free",
          color,
          points: simplifyStroke(stroke),
        },
      ]);
    }
    setPendingPoints([]);
  }

  return (
    <div className="space-y-2">
      <select
        value={selectedId}
        onChange={(e) => onSelect(e.target.value)}
        className="w-full rounded-md border border-[color:var(--line)] bg-transparent px-2 py-1.5 text-sm"
      >
        {swings.map((s) => (
          <option key={s.id} value={s.id}>
            {label(s)}
          </option>
        ))}
      </select>

      <div ref={wrapRef} className="relative overflow-hidden rounded-xl bg-black">
        {swing && (
          <video
            ref={videoRef}
            src={swing.blobUrl}
            playsInline
            muted
            className="block max-h-[460px] w-full object-contain"
            onTimeUpdate={(e) => {
              const v = e.currentTarget;
              if (Number.isFinite(v.duration) && v.duration > 0) {
                setFraction(v.currentTime / v.duration);
              }
            }}
          />
        )}
        <canvas
          ref={canvasRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          className="absolute inset-0 h-full w-full cursor-crosshair touch-none"
        />
      </div>

      <input
        type="range"
        min={0}
        max={1000}
        value={Math.round(fraction * 1000)}
        onChange={(e) => {
          const f = Number(e.target.value) / 1000;
          setFraction(f);
          const v = videoRef.current;
          if (v && Number.isFinite(v.duration)) v.currentTime = v.duration * f;
          onScrub(f);
        }}
        className="w-full accent-[color:var(--fairway)]"
        aria-label="Scrub"
      />

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setPendingPoints([]);
            setAnnotations((a) => a.slice(0, -1));
          }}
          disabled={annotations.length === 0 && pending.length === 0}
          className="rounded-md bg-[color:var(--mist)] px-2.5 py-1 text-xs text-[color:var(--ink-muted)] disabled:opacity-40"
        >
          Undo
        </button>
        <button
          type="button"
          onClick={() => {
            setAnnotations([]);
            setPendingPoints([]);
          }}
          disabled={annotations.length === 0 && pending.length === 0}
          className="rounded-md bg-[color:var(--mist)] px-2.5 py-1 text-xs text-[color:var(--ink-muted)] disabled:opacity-40"
        >
          Clear
        </button>
        <span className="text-[11px] text-[color:var(--ink-muted)]">
          {annotations.length} mark{annotations.length === 1 ? "" : "s"}
        </span>
      </div>
    </div>
  );
}
