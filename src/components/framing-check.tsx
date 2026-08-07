"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  framingCue,
  isReadyToFilm,
  runFramingChecks,
  type FramingCheck,
} from "@/lib/coach/framing";
import {
  getLandmarker,
  mediapipeToKeypoints,
  type Landmark,
} from "@/lib/segmentation/browser-pose";

const STATUS_COLOR: Record<FramingCheck["status"], string> = {
  good: "#4ade80",
  close: "#fbbf24",
  off: "#f87171",
  unknown: "#94a3b8",
};

const COUNTDOWN_FROM = 5;

/**
 * Check the shot before filming it.
 *
 * Deliberately not a recorder. Swings need 120fps for the speed features
 * and browsers do not give a web page the phone's slow-motion camera, so
 * the golfer still films with their own camera app. What this fixes is the
 * other half of the problem: almost every unusable clip is unusable because
 * of framing, and framing is free to fix beforehand and impossible to fix
 * afterwards.
 *
 * The countdown exists because the person setting the phone down is the
 * person swinging. They need time to walk into position, and the framing
 * verdict has to be legible from where they are standing — hence the very
 * large text rather than the small check list.
 */
export function FramingCheck() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | undefined>(undefined);
  const streamRef = useRef<MediaStream | null>(null);
  const lastTsRef = useRef(-1);
  const countdownRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checks, setChecks] = useState<FramingCheck[]>([]);
  const [cue, setCue] = useState("Step into frame");
  const [ready, setReady] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = undefined;
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = undefined;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setRunning(false);
    setCountdown(null);
    setStatus("");
  }, []);

  // Release the camera when this closes or the page changes, or the
  // browser leaves the recording indicator lit.
  useEffect(() => stop, [stop]);
  useEffect(() => {
    if (!open) stop();
  }, [open, stop]);

  const start = useCallback(async () => {
    setError(null);
    setStatus("Requesting camera…");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play();

      setStatus("Loading pose model…");
      const landmarker = await getLandmarker();
      setStatus("");
      setRunning(true);

      const tick = () => {
        const v = videoRef.current;
        const canvas = canvasRef.current;
        if (!v || !canvas || v.readyState < 2) {
          rafRef.current = requestAnimationFrame(tick);
          return;
        }
        const ts = performance.now();
        if (ts <= lastTsRef.current) {
          rafRef.current = requestAnimationFrame(tick);
          return;
        }
        lastTsRef.current = ts;

        let landmarks: Landmark[][] = [];
        try {
          landmarks = landmarker.detectForVideo(v, ts).landmarks ?? [];
        } catch {
          // A dropped frame is not worth ending the session over.
        }

        const w = v.videoWidth;
        const h = v.videoHeight;
        if (canvas.width !== w || canvas.height !== h) {
          canvas.width = w;
          canvas.height = h;
        }
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.clearRect(0, 0, w, h);

        let nextChecks: FramingCheck[] = [];
        if (landmarks.length > 0) {
          const frame = mediapipeToKeypoints(landmarks[0]!, w, h);
          nextChecks = runFramingChecks(frame, w, h);
          setChecks(nextChecks);
          setCue(framingCue(nextChecks));
          setReady(isReadyToFilm(nextChecks));
        } else {
          setChecks([]);
          setCue("Step into frame");
          setReady(false);
        }

        drawGuide(ctx, w, h, isReadyToFilm(nextChecks));
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch (e) {
      setStatus("");
      setError(
        e instanceof Error && e.name === "NotAllowedError"
          ? "Camera permission was denied. Allow camera access and try again."
          : e instanceof Error
            ? e.message
            : "Could not start the camera.",
      );
      stop();
    }
  }, [stop]);

  function startCountdown() {
    if (countdownRef.current) clearInterval(countdownRef.current);
    setCountdown(COUNTDOWN_FROM);
    countdownRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c === null) return null;
        if (c <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          countdownRef.current = undefined;
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-[color:var(--line)] px-3 py-2 text-sm text-[color:var(--ink-muted)] transition hover:border-[color:var(--fairway)] hover:text-[color:var(--ink)]"
      >
        Check your framing first
      </button>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-[color:var(--line)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Framing check</p>
          <p className="text-xs text-[color:var(--ink-muted)]">
            Set the phone where you&apos;ll film from. Nothing is recorded or
            uploaded — film the swing itself with your camera app in slow motion.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-[color:var(--ink-muted)] hover:text-[color:var(--ink)]"
        >
          Close
        </button>
      </div>

      {error && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950">
          {error}
        </p>
      )}

      <div className="relative overflow-hidden rounded-lg bg-black">
        <video ref={videoRef} playsInline muted className="block max-h-[360px] w-full object-contain" />
        <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full object-contain" />

        {running && countdown === null && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-4 pb-3 pt-10 text-center">
            {/* Large, because the golfer is reading this from where they
                stand, not from arm's length at the phone. */}
            <p
              className="font-[family-name:var(--font-display)] text-2xl"
              style={{ color: ready ? STATUS_COLOR.good : "#ffffff" }}
            >
              {cue}
            </p>
          </div>
        )}

        {countdown !== null && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/45">
            <span className="font-[family-name:var(--font-display)] text-8xl text-white">
              {countdown === 0 ? "Go" : countdown}
            </span>
          </div>
        )}

        {!running && (
          <div className="flex h-[220px] items-center justify-center text-sm text-white/60">
            {status || "Camera is off"}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={running ? stop : start}
          className="rounded-md bg-[color:var(--fairway)] px-3 py-1.5 text-xs text-[color:var(--primary-foreground)]"
        >
          {running ? "Stop camera" : "Start camera"}
        </button>
        {running && (
          <button
            type="button"
            onClick={startCountdown}
            className="rounded-md bg-[color:var(--mist)] px-3 py-1.5 text-xs text-[color:var(--ink-muted)] hover:text-[color:var(--ink)]"
          >
            {countdown === null ? `${COUNTDOWN_FROM}s countdown` : "Restart countdown"}
          </button>
        )}
      </div>

      {checks.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {checks.map((c) => (
            <span key={c.id} className="flex items-center gap-1.5 text-xs">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: STATUS_COLOR[c.status] }}
              />
              <span className="text-[color:var(--ink-muted)]">{c.label}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * A framing guide box, green once every check passes.
 *
 * The box is inset by the same margins the checks enforce, so what the
 * golfer is asked to do and what they are shown are the same thing.
 */
function drawGuide(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  ready: boolean,
) {
  const inset = { x: w * 0.08, y: h * 0.06 };
  const unit = Math.max(w, h) / 480;

  ctx.strokeStyle = ready ? STATUS_COLOR.good : "rgba(255,255,255,0.55)";
  ctx.lineWidth = 2.5 * unit;
  ctx.setLineDash(ready ? [] : [12 * unit, 9 * unit]);
  ctx.strokeRect(inset.x, inset.y, w - inset.x * 2, h - inset.y * 2);
  ctx.setLineDash([]);
}
