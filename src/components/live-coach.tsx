"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { KP } from "@/lib/metrics/geometry";
import {
  getLandmarker,
  mediapipeToKeypoints,
  type Landmark,
} from "@/lib/segmentation/browser-pose";
import { BONES, isVisible } from "@/lib/segmentation/skeleton";
import {
  primaryCue,
  runLiveChecks,
  type CoachView,
  type LiveCheck,
} from "@/lib/coach/live-checks";
import {
  INITIAL_ANNOUNCER,
  decideAnnouncement,
  type AnnouncerState,
} from "@/lib/coach/announcer";

const STATUS_COLOR: Record<LiveCheck["status"], string> = {
  good: "#4ade80",
  close: "#fbbf24",
  off: "#f87171",
  unknown: "#94a3b8",
};

/**
 * Two-note rising chime for "setup is good".
 *
 * Synthesised rather than shipped as an audio file: it is two sine tones,
 * and a file would be a network request plus a decode for something the
 * browser can generate in a few lines.
 */
function playChime(ctx: AudioContext) {
  const now = ctx.currentTime;
  for (const [i, freq] of [660, 990].entries()) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    // Ramped, not switched: an instant start or stop on a sine wave clicks.
    const t0 = now + i * 0.1;
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(0.18, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.24);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + 0.26);
  }
}

function speak(text: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  // Drop anything queued: a cue from three seconds ago is already stale, and
  // letting them queue means the voice falls further behind the golfer.
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 1.05;
  u.pitch = 1;
  window.speechSynthesis.speak(u);
}

export function LiveCoach() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | undefined>(undefined);
  const streamRef = useRef<MediaStream | null>(null);
  const lastTsRef = useRef(-1);

  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<CoachView>("face_on");
  const [checks, setChecks] = useState<LiveCheck[]>([]);
  const [cue, setCue] = useState("Step into frame to start");
  const [audioOn, setAudioOn] = useState(true);

  const viewRef = useRef(view);
  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  const audioOnRef = useRef(audioOn);
  useEffect(() => {
    audioOnRef.current = audioOn;
    // Silence anything mid-sentence the moment audio is switched off.
    if (!audioOn && typeof window !== "undefined") window.speechSynthesis?.cancel();
  }, [audioOn]);

  const announcerRef = useRef<AnnouncerState>(INITIAL_ANNOUNCER);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = undefined;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    setRunning(false);
    setStatus("");
  }, []);

  // The camera must be released when this component goes away, or the
  // browser keeps the recording indicator lit after navigating off.
  useEffect(() => stop, [stop]);

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

      // Created inside the click handler on purpose: browsers only allow an
      // AudioContext to start from a user gesture, and one created earlier
      // would be born suspended and stay silent.
      if (!audioCtxRef.current) {
        const Ctor =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext;
        if (Ctor) audioCtxRef.current = new Ctor();
      }
      await audioCtxRef.current?.resume().catch(() => {});

      announcerRef.current = INITIAL_ANNOUNCER;
      setStatus("");
      setRunning(true);

      const tick = () => {
        const v = videoRef.current;
        const canvas = canvasRef.current;
        if (!v || !canvas || v.readyState < 2) {
          rafRef.current = requestAnimationFrame(tick);
          return;
        }

        // MediaPipe rejects a timestamp it has already seen, and a paused
        // or stalled element can hand us the same currentTime twice.
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
          // A dropped frame is not worth tearing the session down for.
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

        if (landmarks.length > 0) {
          const frame = mediapipeToKeypoints(landmarks[0]!, w, h);
          const next = runLiveChecks(frame, viewRef.current);
          setChecks(next);
          const nextCue = primaryCue(next);
          setCue(nextCue);

          // "All good" means every check that could be measured passed —
          // an unmeasurable one (head position from down-the-line) must not
          // block the confirmation forever.
          const known = next.filter((c) => c.status !== "unknown");
          const allGood = known.length > 0 && known.every((c) => c.status === "good");

          const decision = decideAnnouncement(
            announcerRef.current,
            allGood ? null : nextCue,
            allGood,
            ts,
          );
          announcerRef.current = decision.next;

          if (audioOnRef.current) {
            if (decision.speak) speak(decision.speak);
            if (decision.chime && audioCtxRef.current) playChime(audioCtxRef.current);
          }
          if (decision.vibrate) navigator.vibrate?.(120);

          const byId = new Map(next.map((c) => [c.id, c.status]));
          drawSkeleton(ctx, frame, w, h, byId);
        } else {
          setChecks([]);
          setCue("Step into frame to start");
        }

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

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm uppercase tracking-[0.18em] text-[color:var(--ink-muted)]">
          Live Coach
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-4xl">
          Check your setup before you swing.
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-[color:var(--ink-muted)]">
          Live posture coaching from your camera. Nothing is recorded and no
          video leaves your device — the pose model runs in this browser tab.
        </p>
      </div>

      <div className="rounded-xl border border-[color:var(--line)] bg-[color:var(--mist)]/40 px-4 py-3 text-xs leading-relaxed text-[color:var(--ink-muted)]">
        <strong className="text-[color:var(--ink)]">Setup, not swing.</strong>{" "}
        A webcam runs at about 30fps, and a downswing lasts a quarter of a
        second — roughly seven frames. Live swing numbers from a webcam would
        be invented. Address position is the opposite: you hold it still, the
        pose model is at its most reliable, and it is where the cheapest
        improvements live. For swing analysis, film in slow motion and upload it.
      </div>

      {error && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {error}
        </div>
      )}

      <div className="relative overflow-hidden rounded-xl bg-black">
        <video
          ref={videoRef}
          playsInline
          muted
          className="block max-h-[520px] w-full object-contain"
        />
        <canvas
          ref={canvasRef}
          className="pointer-events-none absolute inset-0 h-full w-full object-contain"
        />
        {running && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-4 pb-4 pt-10 text-center">
            <p className="font-[family-name:var(--font-display)] text-2xl text-white">
              {cue}
            </p>
          </div>
        )}
        {!running && (
          <div className="flex h-[320px] items-center justify-center text-sm text-white/60">
            {status || "Camera is off"}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={running ? stop : start}
          className="rounded-md bg-[color:var(--fairway)] px-4 py-2 text-sm text-[color:var(--primary-foreground)]"
        >
          {running ? "Stop camera" : "Start camera"}
        </button>

        <button
          type="button"
          onClick={() => setAudioOn((v) => !v)}
          aria-pressed={audioOn}
          className={`rounded-md px-3 py-2 text-sm transition ${
            audioOn
              ? "bg-[color:var(--fairway)] text-[color:var(--primary-foreground)]"
              : "bg-[color:var(--mist)] text-[color:var(--ink-muted)]"
          }`}
        >
          {audioOn ? "🔊 Voice on" : "🔇 Voice off"}
        </button>

        <div className="flex gap-1 rounded-lg bg-[color:var(--mist)] p-1 text-xs">
          {(
            [
              ["face_on", "Face-on"],
              ["down_the_line", "Down-the-line"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setView(key)}
              className={`rounded-md px-3 py-1.5 transition ${
                view === key
                  ? "bg-[color:var(--fairway)] text-[color:var(--primary-foreground)]"
                  : "text-[color:var(--ink-muted)] hover:text-[color:var(--ink)]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {checks.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {checks.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-3 rounded-xl border border-[color:var(--line)] p-3"
            >
              <span
                className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: STATUS_COLOR[c.status] }}
              />
              <div className="min-w-0">
                <p className="text-sm">
                  {c.label}
                  {c.reading && (
                    <span className="ml-2 text-[color:var(--ink-muted)]">
                      {c.reading}
                    </span>
                  )}
                </p>
                <p className="truncate text-xs text-[color:var(--ink-muted)]">
                  {c.cue}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Skeleton coloured by which check each region belongs to, so the feedback
 * lands on the body part it is about rather than only in the text list.
 */
function drawSkeleton(
  ctx: CanvasRenderingContext2D,
  frame: ReturnType<typeof mediapipeToKeypoints>,
  w: number,
  h: number,
  status: Map<string, LiveCheck["status"]>,
) {
  const unit = Math.max(w, h) / 480;

  const colourFor = (a: number, b: number): string => {
    const leg =
      a === KP.leftKnee || b === KP.leftKnee || a === KP.rightKnee || b === KP.rightKnee;
    if (leg) return STATUS_COLOR[status.get("knee") ?? "unknown"];
    const torso =
      (a === KP.leftShoulder || a === KP.rightShoulder || a === KP.leftHip || a === KP.rightHip) &&
      (b === KP.leftShoulder || b === KP.rightShoulder || b === KP.leftHip || b === KP.rightHip);
    if (torso) return STATUS_COLOR[status.get("spine") ?? "unknown"];
    return "#ffffff";
  };

  ctx.lineCap = "round";
  for (const bone of BONES) {
    if (!isVisible(frame, bone.a) || !isVisible(frame, bone.b)) continue;
    const a = frame[bone.a]!;
    const b = frame[bone.b]!;

    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = "rgba(0,0,0,0.5)";
    ctx.lineWidth = 7 * unit;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = colourFor(bone.a, bone.b);
    ctx.lineWidth = 4 * unit;
    ctx.stroke();
  }
}
