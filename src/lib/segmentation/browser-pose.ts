/**
 * Client-side pose extraction for the segmentation lab.
 *
 * SCOPE — this is a LAB PATH ONLY. Production swing analysis runs RTMPose on
 * the GPU service; that stays the source of truth for every metric, score and
 * fault. MediaPipe here exists purely so an arbitrary clip can be segmented
 * in the browser within seconds, with no upload, no GPU cost, and no
 * dependency on the inference service being warm. Its output must never feed
 * the scoring pipeline — MediaPipe is materially less accurate than RTMPose,
 * which is exactly why the production stack does not use it.
 *
 * Licence: @mediapipe/tasks-vision is Apache-2.0.
 */

import type { PoseFrame } from "@/lib/metrics/geometry";

const WASM_BASE =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

/**
 * MediaPipe emits 33 landmarks; the segmentation code (and the rest of this
 * app) speaks COCO-17. Index i of this array is the MediaPipe landmark that
 * supplies COCO keypoint i.
 */
const MP_TO_COCO = [
  0, // nose
  2, // left eye
  5, // right eye
  7, // left ear
  8, // right ear
  11, // left shoulder
  12, // right shoulder
  13, // left elbow
  14, // right elbow
  15, // left wrist
  16, // right wrist
  23, // left hip
  24, // right hip
  25, // left knee
  26, // right knee
  27, // left ankle
  28, // right ankle
] as const;

/** Cap on extracted frames — keeps a long clip from locking the tab up. */
const MAX_FRAMES = 400;

export type Landmark = { x: number; y: number; z: number; visibility?: number };

/** Blank COCO-17 frame — every joint present but zero-confidence. */
export function emptyFrame(): PoseFrame {
  return Array.from({ length: 17 }, () => ({ x: 0, y: 0, c: 0 }));
}

/**
 * Convert one MediaPipe landmark set (33 normalised points) into a COCO-17
 * frame in pixel coordinates. Pure — unit tested against the index map.
 */
export function mediapipeToCoco(
  landmarks: Landmark[] | undefined,
  width: number,
  height: number,
): PoseFrame {
  if (!landmarks || landmarks.length < 29) return emptyFrame();
  return MP_TO_COCO.map((mpIndex) => {
    const p = landmarks[mpIndex];
    if (!p) return { x: 0, y: 0, c: 0 };
    return {
      x: p.x * width,
      y: p.y * height,
      // MediaPipe reports visibility, not a detection score; treat it as the
      // confidence signal and let it drive region opacity.
      c: typeof p.visibility === "number" ? p.visibility : 0.9,
    };
  });
}

/**
 * Below this, pose keypoints get too coarse to trust — the Kaggle
 * `videos-160` GolfDB mirror is 160x160, which the build plan flags as
 * fine for training SwingNet but far too small for quality pose.
 */
export const LOW_RESOLUTION_EDGE = 320;

export type ExtractionResult = {
  frames: PoseFrame[];
  fps: number;
  width: number;
  height: number;
  /** Frames where no person was found at all. */
  missedFrames: number;
  /** True when the clip's long edge is under LOW_RESOLUTION_EDGE. */
  lowResolution: boolean;
};

let landmarkerPromise: Promise<{
  detectForVideo: (v: HTMLVideoElement, t: number) => { landmarks: Landmark[][] };
  close: () => void;
}> | null = null;

async function getLandmarker() {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const { FilesetResolver, PoseLandmarker } = await import(
        "@mediapipe/tasks-vision"
      );
      const vision = await FilesetResolver.forVisionTasks(WASM_BASE);
      const lm = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
        runningMode: "VIDEO",
        numPoses: 1,
      });
      return lm as unknown as {
        detectForVideo: (
          v: HTMLVideoElement,
          t: number,
        ) => { landmarks: Landmark[][] };
        close: () => void;
      };
    })();
  }
  return landmarkerPromise;
}

/** Warm the model + wasm so the first real extraction isn't a cold start. */
export function preloadPoseModel(): void {
  void getLandmarker().catch(() => {
    landmarkerPromise = null;
  });
}

function seek(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const onSeeked = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("Video seek failed"));
    };
    const cleanup = () => {
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
      clearTimeout(timer);
    };
    // A seek that never fires shouldn't hang the whole extraction.
    const timer = setTimeout(() => {
      cleanup();
      resolve();
    }, 2000);
    video.addEventListener("seeked", onSeeked);
    video.addEventListener("error", onError);
    video.currentTime = time;
  });
}

/**
 * Runs pose over a local video file and returns COCO-17 frames in pixel
 * coordinates, ready for `segmentBodyParts`.
 *
 * Frames are sampled by seeking rather than by playback, so extraction is
 * deterministic and independent of how fast the clip would play.
 */
export async function extractPoseFromVideo(
  file: File,
  onProgress?: (fraction: number) => void,
): Promise<ExtractionResult> {
  const landmarker = await getLandmarker();
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = url;

  try {
    await new Promise<void>((resolve, reject) => {
      const onReady = () => {
        cleanup();
        resolve();
      };
      const onError = () => {
        cleanup();
        // MEDIA_ERR_SRC_NOT_SUPPORTED (4) almost always means the container
        // decoded but the video codec did not. Worth naming explicitly:
        // GolfDB / Kaggle videos-160 clips are MPEG-4 Part 2 (tag mp4v),
        // which no browser decodes, and "could not read the file" sends
        // people hunting for a corrupt download that isn't the problem.
        const code = video.error?.code;
        if (code === 4 || code === 3) {
          reject(
            new Error(
              "This video's codec isn't supported by browsers (common with GolfDB/Kaggle clips, which are MPEG-4 Part 2 rather than H.264). Convert it first: ffmpeg -i input.mp4 -c:v libx264 -pix_fmt yuv420p output.mp4 — or run it through the normal swing upload and view it here under “Analyzed swings”, which uses the server's decoder and better pose.",
            ),
          );
          return;
        }
        reject(new Error("Could not read that video file."));
      };
      const cleanup = () => {
        video.removeEventListener("loadedmetadata", onReady);
        video.removeEventListener("error", onError);
      };
      video.addEventListener("loadedmetadata", onReady);
      video.addEventListener("error", onError);
    });

    const duration = video.duration;
    if (!Number.isFinite(duration) || duration <= 0) {
      throw new Error("Could not determine the video's duration.");
    }

    const width = video.videoWidth;
    const height = video.videoHeight;
    if (!width || !height) {
      throw new Error("Could not determine the video's dimensions.");
    }

    // Aim for ~30 samples/sec, but never exceed MAX_FRAMES for long clips.
    const targetFps = 30;
    const wanted = Math.ceil(duration * targetFps);
    const count = Math.min(wanted, MAX_FRAMES);
    const fps = count / duration;
    const step = duration / count;

    const frames: PoseFrame[] = [];
    let missedFrames = 0;

    for (let i = 0; i < count; i++) {
      const t = Math.min(i * step, Math.max(0, duration - 1e-3));
      await seek(video, t);

      let landmarks: Landmark[] | undefined;
      try {
        const res = landmarker.detectForVideo(video, Math.round(t * 1000));
        landmarks = res.landmarks?.[0];
      } catch {
        landmarks = undefined;
      }

      if (!landmarks || landmarks.length < 29) {
        missedFrames += 1;
        frames.push(emptyFrame());
      } else {
        frames.push(mediapipeToCoco(landmarks, width, height));
      }

      if (onProgress && i % 5 === 0) onProgress((i + 1) / count);
    }

    onProgress?.(1);
    return {
      frames,
      fps,
      width,
      height,
      missedFrames,
      lowResolution: Math.max(width, height) < LOW_RESOLUTION_EDGE,
    };
  } finally {
    URL.revokeObjectURL(url);
    video.src = "";
  }
}
