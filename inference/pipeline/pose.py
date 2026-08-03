"""RTMPose top-down pose via rtmlib (ONNX Runtime)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

import numpy as np


@dataclass
class PoseSequence:
    """keypoints: (T, 17, 3) with x, y, confidence."""

    keypoints: np.ndarray
    multiple_people: bool
    pose_confidence_mean: float
    full_body_in_frame: bool


_BODY = None
_DEVICE = "cpu"


def init_pose_model(device: str = "cuda") -> None:
    """Load RTMDet/YOLOX detector + RTMPose (balanced mode)."""
    global _BODY, _DEVICE
    _DEVICE = device
    from rtmlib import Body

    # mode=balanced → YOLOX-m det + RTMPose-m (COCO-17 body). Apache-2.0 weights.
    _BODY = Body(
        mode="balanced",
        device=device,
        backend="onnxruntime",
        to_openpose=False,
    )


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


def run_pose(frames: list[np.ndarray]) -> PoseSequence:
    global _BODY
    if _BODY is None:
        init_pose_model(_DEVICE)

    import cv2

    T = len(frames)
    out = np.zeros((T, 17, 3), dtype=np.float32)
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

        # Truncate / pad to 17 joints if model returns body7 variants
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

        n = len(keypoints)
        if n > 1:
            multiple = True

        idx = _largest_person(keypoints, scores)
        if idx is None:
            confs.append(0.0)
            full_body_flags.append(False)
            continue

        kpt = keypoints[idx]
        sc = scores[idx]
        out[t, :, 0:2] = kpt
        out[t, :, 2] = sc
        confs.append(float(sc.mean()))
        full_body_flags.append(_full_body(kpt, sc, w, h))

    mean_conf = float(np.mean(confs)) if confs else 0.0
    return PoseSequence(
        keypoints=out,
        multiple_people=multiple,
        pose_confidence_mean=mean_conf,
        full_body_in_frame=bool(np.mean(full_body_flags) > 0.7)
        if full_body_flags
        else False,
    )
