"""
Pose estimation.

Default backend is MediaPipe Pose, matching the collaborator's pipeline
(AdanNazir/golf-swing-analysis) exactly — same solution, same
model_complexity, same confidence thresholds, same temporal-tracking and
per-clip reset behaviour — so both projects measure from identical
landmarks and their analysis work transfers without a translation layer.

RTMPose remains available behind POSE_BACKEND=rtmpose. It is the more
accurate backbone (see the build plan's model comparison), so keeping it
one env var away means the choice can be revisited without a code change.

Both backends emit the same (T, 21, 3) array of x, y, confidence — COCO-17
at indices 0-16, plus 4 real foot landmarks (left/right heel, left/right
toe) appended at 17-20. MediaPipe's native 33-point output already includes
the foot points; RTMPose's plain Body model does not, so on that backend
indices 17-20 come back zero-confidence and every downstream consumer
(segmentation, metrics) treats them as unobserved rather than guessed —
the same "missing is honest, wrong is not" rule everything else here
follows.

NOTE ON DATA PROTECTION: neither backend changes your GDPR position by
itself. Both process the same video of the same identifiable person, in
the same place. What matters legally is *where* processing happens, what
is retained, and on what lawful basis — not which pose model runs. The
genuine privacy win available from MediaPipe is that it can run fully
on-device (see src/lib/segmentation/browser-pose.ts), so video never
leaves the user's device at all; running it server-side here is
architecturally identical to running RTMPose server-side.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Optional

import numpy as np


@dataclass
class PoseSequence:
    """keypoints: (T, 21, 3) with x, y, confidence — see MP_TO_KP above.

    world: (T, 21, 4) with x, y, z, visibility in METRES, origin at the
    midpoint of the hips. This is MediaPipe's own metric reconstruction
    (`pose_world_landmarks`), which the Tasks API returns alongside the
    image-space landmarks and which this pipeline previously discarded.

    Two things depend on it:

      1. 3D skeleton playback — the depth axis is measured here, not
         inferred from a 2D projection.
      2. The pixels→metres scale used for speed estimation. Shoulder width
         in metres (world) against shoulder width in pixels (image) gives a
         per-frame scale without asking the golfer for their height.

    The RTMPose backend has no 3D head, so on that backend `world` comes
    back all zeros and every consumer treats it as unobserved — the same
    rule the feet follow at indices 17-20.
    """

    keypoints: np.ndarray
    world: np.ndarray
    multiple_people: bool
    pose_confidence_mean: float
    full_body_in_frame: bool

    def has_world(self) -> bool:
        """True when a usable metric reconstruction came back."""
        return bool(self.world.size) and bool((self.world[:, :, 3] > 0.3).any())


# MediaPipe emits 33 landmarks; index i here is the MediaPipe landmark that
# supplies output keypoint i. Mirrors the mapping used in the browser path
# (src/lib/segmentation/browser-pose.ts) and the KP indices in
# src/lib/metrics/geometry.ts — keep all three in step.
MP_TO_KP = [
    0,   # nose
    2,   # left eye
    5,   # right eye
    7,   # left ear
    8,   # right ear
    11,  # left shoulder
    12,  # right shoulder
    13,  # left elbow
    14,  # right elbow
    15,  # left wrist
    16,  # right wrist
    23,  # left hip
    24,  # right hip
    25,  # left knee
    26,  # right knee
    27,  # left ankle
    28,  # right ankle
    29,  # left heel
    31,  # left foot index (toe)
    30,  # right heel
    32,  # right foot index (toe)
]
NUM_KEYPOINTS = len(MP_TO_KP)  # 21

_BODY = None
_MP_POSE = None
_DEVICE = "cpu"

# Baked into the image at build time (see app.py) so no model download
# happens on a cold start. `full` corresponds to the collaborator's
# production model_complexity=1.
_MODEL_PATH = os.environ.get(
    "MEDIAPIPE_POSE_MODEL", "/root/models/pose_landmarker_full.task"
)


def _backend() -> str:
    return os.environ.get("POSE_BACKEND", "mediapipe").strip().lower()


def init_pose_model(device: str = "cuda") -> None:
    """Warm the configured backend. `device` is honoured by RTMPose only —
    MediaPipe Pose runs on CPU here, which is also why this service no
    longer strictly needs a GPU when MediaPipe is the backend."""
    global _BODY, _MP_POSE, _DEVICE
    _DEVICE = device

    if _backend() == "rtmpose":
        from rtmlib import Body

        # mode=balanced → YOLOX-m det + RTMPose-m (COCO-17). Apache-2.0.
        _BODY = Body(
            mode="balanced",
            device=device,
            backend="onnxruntime",
            to_openpose=False,
        )
        return

    from mediapipe.tasks.python import vision as mp_vision
    from mediapipe.tasks.python.core.base_options import BaseOptions

    # Tasks API, not the legacy mp.solutions.pose — for the reason the
    # collaborator documents in tools/extract_landmarks.py: the browser
    # runtime (@mediapipe/tasks-vision, used by our own segmentation lab)
    # runs the Tasks-API model family, and the legacy API would silently
    # produce a different model's landmark distribution than what runs
    # client-side. The legacy API is also simply gone from current
    # mediapipe builds.
    #
    # RunningMode.VIDEO tracks landmarks temporally across consecutive
    # frames, which is what static_image_mode=False bought on the legacy
    # API. Confidences are left permissive at 0.3 — posture.py's
    # reliability gates decide what is trustworthy, rather than discarding
    # landmarks here where that judgement can't be made.
    options = mp_vision.PoseLandmarkerOptions(
        base_options=BaseOptions(model_asset_path=_MODEL_PATH),
        running_mode=mp_vision.RunningMode.VIDEO,
        num_poses=1,
        min_pose_detection_confidence=0.3,
        min_tracking_confidence=0.3,
        min_pose_presence_confidence=0.3,
    )
    _MP_POSE = mp_vision.PoseLandmarker.create_from_options(options)


def _largest_person(keypoints: np.ndarray, scores: np.ndarray) -> Optional[int]:
    if keypoints is None or len(keypoints) == 0:
        return None
    areas = []
    for i in range(len(keypoints)):
        pts = keypoints[i]
        conf = scores[i]
        valid = pts[conf > 0.3]
        if len(valid) < 5:
            areas.append(0.0)
            continue
        w = valid[:, 0].max() - valid[:, 0].min()
        h = valid[:, 1].max() - valid[:, 1].min()
        areas.append(float(w * h))
    return int(np.argmax(areas)) if areas else None


def _full_body(kpt: np.ndarray, conf: np.ndarray, w: int, h: int) -> bool:
    needed = [5, 6, 15, 16]  # L/R shoulder, L/R ankle
    for i in needed:
        if i >= len(conf) or conf[i] < 0.3:
            return False
        x, y = kpt[i]
        if x < 0 or y < 0 or x > w or y > h:
            return False
    return True


def _run_mediapipe(frames: list[np.ndarray], fps: float = 30.0) -> PoseSequence:
    global _MP_POSE
    import mediapipe as mp

    # A fresh landmarker per clip: RunningMode.VIDEO carries tracking state
    # forward, and reusing one instance across clips biases the opening
    # frames of each video toward wherever the previous one ended.
    init_pose_model(_DEVICE)

    T = len(frames)
    out = np.zeros((T, NUM_KEYPOINTS, 3), dtype=np.float32)
    world = np.zeros((T, NUM_KEYPOINTS, 4), dtype=np.float32)
    confs: list[float] = []
    full_body_flags: list[bool] = []

    step_ms = 1000.0 / fps if fps > 0 else 33.0

    for t, frame in enumerate(frames):
        h, w = frame.shape[:2]
        # decode.py already produces RGB, which is what MediaPipe wants.
        try:
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=frame)
            # detect_for_video requires strictly increasing timestamps.
            result = _MP_POSE.detect_for_video(mp_image, int(t * step_ms))
        except Exception:
            result = None

        landmark_sets = getattr(result, "pose_landmarks", None) if result else None
        if not landmark_sets:
            confs.append(0.0)
            full_body_flags.append(False)
            continue

        lms = landmark_sets[0]
        for kp_idx, mp_idx in enumerate(MP_TO_KP):
            if mp_idx >= len(lms):
                continue
            lm = lms[mp_idx]
            out[t, kp_idx, 0] = lm.x * w
            out[t, kp_idx, 1] = lm.y * h
            # `visibility` is MediaPipe's own estimate that the joint was
            # genuinely observed rather than inferred behind an occlusion —
            # exactly the signal posture.py's occlusion gate needs.
            out[t, kp_idx, 2] = float(getattr(lm, "visibility", 0.0))

        # Metric reconstruction, hip-origin, in metres. Separate landmark
        # list from the image-space one above — same indices, different
        # coordinate system, so it is mapped through MP_TO_KP identically.
        world_sets = getattr(result, "pose_world_landmarks", None)
        if world_sets:
            wlms = world_sets[0]
            for kp_idx, mp_idx in enumerate(MP_TO_KP):
                if mp_idx >= len(wlms):
                    continue
                wl = wlms[mp_idx]
                world[t, kp_idx, 0] = float(wl.x)
                world[t, kp_idx, 1] = float(wl.y)
                world[t, kp_idx, 2] = float(wl.z)
                world[t, kp_idx, 3] = float(getattr(wl, "visibility", 0.0))

        # Mean confidence and full-body check both deliberately stay scoped
        # to the original 17 body points (0:17), not the appended feet —
        # feet being briefly out of frame (a common camera crop) shouldn't
        # tank the clip's overall confidence score or trip full_body_in_frame.
        confs.append(float(out[t, :17, 2].mean()))
        full_body_flags.append(_full_body(out[t, :, :2], out[t, :, 2], w, h))

    mean_conf = float(np.mean(confs)) if confs else 0.0
    return PoseSequence(
        keypoints=out,
        world=world,
        # mp.solutions.Pose is single-person by design, so a second golfer
        # in frame cannot be detected here — unlike the RTMPose path, which
        # ran a multi-person detector. Reported as False rather than
        # guessed; the `multiple_people` warning simply never fires on this
        # backend.
        multiple_people=False,
        pose_confidence_mean=mean_conf,
        full_body_in_frame=bool(np.mean(full_body_flags) > 0.7)
        if full_body_flags
        else False,
    )


def _run_rtmpose(frames: list[np.ndarray]) -> PoseSequence:
    global _BODY
    if _BODY is None:
        init_pose_model(_DEVICE)

    import cv2

    # rtmlib's plain Body model outputs COCO-17 only — no feet. Every frame
    # is padded out to NUM_KEYPOINTS (21) below, so indices 17-20 simply
    # stay at their np.zeros() confidence of 0 for this backend: the foot
    # region is measured but not scored, same as any other joint the model
    # never observed. Never approximated by extrapolating past the ankle —
    # a guessed foot position is not a measurement.
    T = len(frames)
    out = np.zeros((T, NUM_KEYPOINTS, 3), dtype=np.float32)
    # rtmlib's Body model is 2D-only. Left at zeros so has_world() reports
    # False and the 3D player / speed scale fall back rather than replay a
    # flat skeleton that looks like depth but isn't.
    world = np.zeros((T, NUM_KEYPOINTS, 4), dtype=np.float32)
    multiple = False
    confs: list[float] = []
    full_body_flags: list[bool] = []

    for t, frame in enumerate(frames):
        bgr = cv2.cvtColor(frame, cv2.COLOR_RGB2BGR)
        h, w = frame.shape[:2]

        try:
            keypoints, scores = _BODY(bgr)
        except Exception:
            keypoints, scores = np.zeros((0, 17, 2)), np.zeros((0, 17))

        keypoints = np.asarray(keypoints)
        scores = np.asarray(scores)

        if keypoints.size == 0:
            confs.append(0.0)
            full_body_flags.append(False)
            continue

        if keypoints.ndim == 2:
            keypoints = keypoints[None, ...]
            scores = scores[None, ...]

        if keypoints.shape[1] > 17:
            keypoints = keypoints[:, :17, :]
            scores = scores[:, :17]
        elif keypoints.shape[1] < 17:
            pad_k = np.zeros((keypoints.shape[0], 17, 2), dtype=np.float32)
            pad_s = np.zeros((keypoints.shape[0], 17), dtype=np.float32)
            n = keypoints.shape[1]
            pad_k[:, :n] = keypoints
            pad_s[:, :n] = scores
            keypoints, scores = pad_k, pad_s

        if len(keypoints) > 1:
            multiple = True

        idx = _largest_person(keypoints, scores)
        if idx is None:
            confs.append(0.0)
            full_body_flags.append(False)
            continue

        kpt = keypoints[idx]
        sc = scores[idx]
        out[t, :17, 0:2] = kpt
        out[t, :17, 2] = sc
        confs.append(float(sc.mean()))
        full_body_flags.append(_full_body(kpt, sc, w, h))

    mean_conf = float(np.mean(confs)) if confs else 0.0
    return PoseSequence(
        keypoints=out,
        world=world,
        multiple_people=multiple,
        pose_confidence_mean=mean_conf,
        full_body_in_frame=bool(np.mean(full_body_flags) > 0.7)
        if full_body_flags
        else False,
    )


def run_pose(frames: list[np.ndarray], fps: float = 30.0) -> PoseSequence:
    if _backend() == "rtmpose":
        return _run_rtmpose(frames)
    return _run_mediapipe(frames, fps)
