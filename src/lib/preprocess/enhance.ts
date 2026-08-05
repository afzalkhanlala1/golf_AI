/**
 * Client-side clip conditioning: sharpening and frame interpolation.
 *
 * ── READ THIS BEFORE TRUSTING THE OUTPUT ────────────────────────────────
 * Neither operation creates information that was not captured.
 *
 * Sharpening (unsharp mask) increases local contrast at edges. It genuinely
 * helps a pose model find a joint whose edges are soft, because it makes an
 * edge that IS present easier to localise. It does not add detail; pushed
 * too hard it manufactures halos that can pull a keypoint off the joint.
 *
 * Interpolation synthesises in-between frames by blending or by shifting
 * pixels along an estimated motion vector. On slow, smooth motion the
 * result is close to what a real intermediate frame looked like. On a
 * clubhead travelling >100mph — the exact region a golfer cares about —
 * it is a guess between two positions that may be several feet apart, and
 * the true path between them (an arc, with the face rotating) is not
 * recoverable from the endpoints. It makes playback smoother. It does NOT
 * make impact measurable on a clip that failed to capture impact.
 *
 * So: this is a capture-quality aid, not a way to turn 30fps into 120fps
 * for measurement purposes. Anything measured off interpolated frames must
 * stay labelled as such.
 * ────────────────────────────────────────────────────────────────────────
 */

export type ClipProbe = {
  width: number;
  height: number;
  durationSec: number;
  /** Measured by sampling frame callbacks, not read from metadata. */
  estimatedFps: number | null;
  frameCountEstimate: number | null;
};

export type EnhanceOptions = {
  /** 0 = off. ~0.6-1.2 is a useful range. */
  sharpenAmount: number;
  /** Upscale factor applied before sharpening, 1 = none. */
  upscale: number;
  /** Synthetic frames inserted between each real pair. 0 = off. */
  interpolateFactor: number;
  /** Use block-matching motion compensation instead of a straight blend. */
  motionCompensated: boolean;
};

export const DEFAULT_OPTIONS: EnhanceOptions = {
  sharpenAmount: 0.8,
  upscale: 1,
  interpolateFactor: 1,
  motionCompensated: true,
};

/** Below this long edge, pose keypoints get unreliable. */
export const LOW_RESOLUTION_EDGE = 320;
/** Below this, the impact region is under-sampled. */
export const PREFERRED_FPS = 120;

/**
 * Probe a clip's real properties.
 *
 * fps is measured with requestVideoFrameCallback during a short playback
 * rather than trusted from container metadata, which routinely lies.
 */
export async function probeClip(file: File): Promise<ClipProbe> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.src = url;

  try {
    await new Promise<void>((resolve, reject) => {
      video.addEventListener("loadedmetadata", () => resolve(), { once: true });
      video.addEventListener(
        "error",
        () => {
          const code = video.error?.code;
          reject(
            new Error(
              code === 4 || code === 3
                ? "This video's codec isn't supported by browsers (GolfDB/Kaggle clips are MPEG-4 Part 2, not H.264). Convert first: ffmpeg -i in.mp4 -c:v libx264 -pix_fmt yuv420p out.mp4"
                : "Could not read that video file.",
            ),
          );
        },
        { once: true },
      );
    });

    const width = video.videoWidth;
    const height = video.videoHeight;
    const durationSec = video.duration;

    let estimatedFps: number | null = null;
    if ("requestVideoFrameCallback" in video) {
      const rvfc = video as HTMLVideoElement & {
        requestVideoFrameCallback: (cb: () => void) => number;
      };
      try {
        await video.play();
        let frames = 0;
        const start = performance.now();
        await new Promise<void>((resolve) => {
          const tick = () => {
            frames += 1;
            if (performance.now() - start >= 1000) return resolve();
            rvfc.requestVideoFrameCallback(tick);
          };
          rvfc.requestVideoFrameCallback(tick);
        });
        video.pause();
        estimatedFps = frames;
      } catch {
        estimatedFps = null;
      }
    }

    return {
      width,
      height,
      durationSec,
      estimatedFps,
      frameCountEstimate:
        estimatedFps && Number.isFinite(durationSec)
          ? Math.round(estimatedFps * durationSec)
          : null,
    };
  } finally {
    URL.revokeObjectURL(url);
    video.src = "";
  }
}

/**
 * Unsharp mask: out = src + amount * (src - blur(src)).
 *
 * A 3x3 box blur is enough here — the goal is edge contrast for a pose
 * model, not photographic quality, and a bigger kernel costs frame time
 * without helping keypoint localisation.
 */
export function sharpen(src: ImageData, amount: number): ImageData {
  if (amount <= 0) return src;
  const { width: w, height: h, data } = src;
  const out = new ImageData(new Uint8ClampedArray(data), w, h);
  const o = out.data;

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) {
        let sum = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            sum += data[((y + dy) * w + (x + dx)) * 4 + c]!;
          }
        }
        const blur = sum / 9;
        const v = data[i + c]!;
        o[i + c] = Math.max(0, Math.min(255, v + amount * (v - blur)));
      }
    }
  }
  return out;
}

/** Mean absolute difference between two blocks, on luma only. */
function blockSad(
  a: ImageData,
  b: ImageData,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  size: number,
): number {
  const { width: w, height: h } = a;
  let sum = 0;
  let n = 0;
  for (let y = 0; y < size; y += 2) {
    for (let x = 0; x < size; x += 2) {
      const sy = ay + y;
      const sx = ax + x;
      const ty = by + y;
      const tx = bx + x;
      if (sy < 0 || sy >= h || sx < 0 || sx >= w) continue;
      if (ty < 0 || ty >= h || tx < 0 || tx >= w) continue;
      const i = (sy * w + sx) * 4;
      const j = (ty * w + tx) * 4;
      // Luma approximation — chroma adds cost without improving matching.
      const la = a.data[i]! * 0.299 + a.data[i + 1]! * 0.587 + a.data[i + 2]! * 0.114;
      const lb = b.data[j]! * 0.299 + b.data[j + 1]! * 0.587 + b.data[j + 2]! * 0.114;
      sum += Math.abs(la - lb);
      n += 1;
    }
  }
  return n === 0 ? Number.POSITIVE_INFINITY : sum / n;
}

const BLOCK = 16;
/**
 * Half-width of the motion search, in pixels.
 *
 * Has to be generous: at 30fps a golfer's hands can cross a large part of
 * the frame between consecutive frames, and a search that can't reach the
 * true displacement silently returns a near-zero vector — which looks like
 * "no motion" and produces a plain ghosted blend exactly where motion
 * matters most. Cost is kept down by searching coarse-then-fine rather
 * than by shrinking the range.
 */
const SEARCH = 16;
const COARSE_STEP = 4;
const FINE_RADIUS = 3;

/** Best (dx, dy) for one block: coarse sweep, then a fine refine around it. */
function findMotion(
  prev: ImageData,
  next: ImageData,
  bx: number,
  by: number,
): { dx: number; dy: number } {
  // Zero-motion bias. A flat or repetitive block (sky, grass, a plain wall)
  // matches equally well at MANY offsets, and without this the first offset
  // the loop happens to try wins — so large parts of a static background
  // get assigned a big spurious vector and are then smeared across the
  // frame, overwriting the parts that genuinely moved. Seeding with the
  // stationary candidate and requiring a strict improvement means an
  // ambiguous block stays put, which is the correct answer for one.
  let bestDx = 0;
  let bestDy = 0;
  let best = blockSad(prev, next, bx, by, bx, by, BLOCK);

  const consider = (dx: number, dy: number) => {
    if (dx === 0 && dy === 0) return;
    const sad = blockSad(prev, next, bx, by, bx + dx, by + dy, BLOCK);
    if (sad < best) {
      best = sad;
      bestDx = dx;
      bestDy = dy;
    }
  };

  for (let dy = -SEARCH; dy <= SEARCH; dy += COARSE_STEP) {
    for (let dx = -SEARCH; dx <= SEARCH; dx += COARSE_STEP) {
      consider(dx, dy);
    }
  }

  const cx = bestDx;
  const cy = bestDy;
  for (let dy = cy - FINE_RADIUS; dy <= cy + FINE_RADIUS; dy++) {
    for (let dx = cx - FINE_RADIUS; dx <= cx + FINE_RADIUS; dx++) {
      consider(dx, dy);
    }
  }
  return { dx: bestDx, dy: bestDy };
}

/**
 * Interpolate a frame at `t` (0..1) between two real frames.
 *
 * With `motionCompensated`, each block searches the next frame for its best
 * match and is placed along that displacement — this is the "pixel ends up
 * halfway between its two positions" idea, done per block rather than per
 * pixel because per-pixel optical flow is far too slow in a browser.
 *
 * Without it, a straight cross-fade. The cross-fade never invents a wrong
 * position — it just ghosts — which is sometimes the more honest artifact.
 */
export function interpolateFrame(
  prev: ImageData,
  next: ImageData,
  t: number,
  motionCompensated: boolean,
): ImageData {
  const { width: w, height: h } = prev;
  const out = new ImageData(w, h);

  // Start from the straight blend. Motion-compensated blocks overwrite it
  // below; anywhere a block doesn't land, the blend is the fallback rather
  // than a hole.
  for (let i = 0; i < out.data.length; i++) {
    out.data[i] = prev.data[i]! + (next.data[i]! - prev.data[i]!) * t;
  }
  if (!motionCompensated) return out;

  for (let by = 0; by < h; by += BLOCK) {
    for (let bx = 0; bx < w; bx += BLOCK) {
      const { dx, dy } = findMotion(prev, next, bx, by);
      if (dx === 0 && dy === 0) continue; // blend already correct

      // A block that sat at (bx, by) in `prev` and moved by (dx, dy) is,
      // at time t, at (bx + t*dx, by + t*dy). Write it there.
      const destX = bx + Math.round(dx * t);
      const destY = by + Math.round(dy * t);

      for (let y = 0; y < BLOCK; y++) {
        for (let x = 0; x < BLOCK; x++) {
          const sy = by + y;
          const sx = bx + x;
          if (sy >= h || sx >= w) continue;

          const dyOut = destY + y;
          const dxOut = destX + x;
          if (dyOut < 0 || dyOut >= h || dxOut < 0 || dxOut >= w) continue;

          const si = (sy * w + sx) * 4;
          const ny = Math.min(h - 1, Math.max(0, sy + dy));
          const nx = Math.min(w - 1, Math.max(0, sx + dx));
          const ni = (ny * w + nx) * 4;
          const di = (dyOut * w + dxOut) * 4;

          for (let c = 0; c < 4; c++) {
            out.data[di + c] =
              prev.data[si + c]! * (1 - t) + next.data[ni + c]! * t;
          }
        }
      }
    }
  }
  return out;
}

export type EnhanceReport = {
  inputWidth: number;
  inputHeight: number;
  outputWidth: number;
  outputHeight: number;
  inputFps: number | null;
  outputFps: number | null;
  realFrames: number;
  syntheticFrames: number;
  sharpened: boolean;
};

/** What the enhancement will and won't achieve, in plain language. */
export function describeOutcome(
  probe: ClipProbe,
  opts: EnhanceOptions,
): { improvements: string[]; caveats: string[] } {
  const improvements: string[] = [];
  const caveats: string[] = [];

  const longEdge = Math.max(probe.width, probe.height);
  if (opts.upscale > 1 || opts.sharpenAmount > 0) {
    improvements.push(
      `Edges sharpened${opts.upscale > 1 ? ` and upscaled ${opts.upscale}x` : ""} — helps pose find soft joints.`,
    );
  }
  if (longEdge < LOW_RESOLUTION_EDGE) {
    caveats.push(
      `Source is ${probe.width}x${probe.height}. Upscaling enlarges it but recovers no real detail — the joints were never captured sharply.`,
    );
  }

  if (opts.interpolateFactor > 0 && probe.estimatedFps) {
    const outFps = probe.estimatedFps * (opts.interpolateFactor + 1);
    improvements.push(
      `Playback smoothed from ~${probe.estimatedFps}fps to ~${Math.round(outFps)}fps.`,
    );
    if (probe.estimatedFps < PREFERRED_FPS) {
      caveats.push(
        `Synthetic frames are estimated between real ones. At ~${probe.estimatedFps}fps the clubhead moves a long way between captured frames, so the interpolated impact region is a guess — do not read impact measurements off it.`,
      );
    }
  }

  return { improvements, caveats };
}
