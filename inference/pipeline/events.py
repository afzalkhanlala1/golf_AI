"""Swing event detection — heuristic first, optional SwingNet checkpoint."""

from __future__ import annotations

import os
from typing import Optional

import numpy as np

EVENT_NAMES = [
    "address",
    "toe_up",
    "mid_backswing",
    "top",
    "mid_downswing",
    "impact",
    "mid_follow_through",
    "finish",
]

# COCO wrists
L_WRIST, R_WRIST = 9, 10

# Minimum wrist vertical travel, as a fraction of frame height, to call a
# clip a real golf swing rather than a static/near-static shot. Ported from
# a collaborator's independent MediaPipe-based pipeline, which learned this
# threshold auto-skipping non-swing clips during dataset labeling — reject
# rather than emit nonsense event frames on a clip with no real motion.
MIN_SWING_RANGE_FRAC = 0.10


def has_swing_motion(keypoints: np.ndarray, frame_height: float) -> bool:
    if frame_height <= 0 or keypoints.shape[0] == 0:
        return True
    y = _wrist_series(keypoints)[:, 1]
    y_range = float(np.nanmax(y) - np.nanmin(y))
    return (y_range / frame_height) >= MIN_SWING_RANGE_FRAC


def _wrist_series(keypoints: np.ndarray) -> np.ndarray:
    """Prefer the wrist with higher mean confidence; return (T, 2) xy."""
    lw = keypoints[:, L_WRIST, :]
    rw = keypoints[:, R_WRIST, :]
    if float(lw[:, 2].mean()) >= float(rw[:, 2].mean()):
        return lw[:, :2]
    return rw[:, :2]


def _smooth(x: np.ndarray, win: int = 5) -> np.ndarray:
    if len(x) < win:
        return x
    kernel = np.ones(win) / win
    pad = win // 2
    xp = np.pad(x, (pad, pad), mode="edge")
    return np.convolve(xp, kernel, mode="valid")


def detect_events_heuristic(
    keypoints: np.ndarray,
    fps: float,
) -> list[dict]:
    """
    address = first sustained low-motion window
    top = wrist trajectory apex, bounded before the frame of peak wrist speed
    impact = peak wrist speed, bounded by hands returning to ~address height
    finish = last sustained low-motion window
    intermediate four interpolated

    The top/impact bounding follows a collaborator's independently-developed
    MediaPipe pipeline: unbounded "max speed after top" frequently lands in
    the release/early follow-through instead of impact, because hand speed
    often keeps climbing past contact rather than peaking exactly at it.
    """
    T = keypoints.shape[0]
    if T < 8:
        return []

    xy = _wrist_series(keypoints)
    speed = np.linalg.norm(np.diff(xy, axis=0, prepend=xy[:1]), axis=1)
    speed = _smooth(speed, 5)
    y = _smooth(xy[:, 1], 5)

    # Low motion threshold
    thr = max(float(np.percentile(speed, 20)), 1e-3)

    def sustained_low(start_search: int, forward: bool) -> int:
        length = max(3, int(fps * 0.05))
        if forward:
            for i in range(start_search, T - length):
                if np.all(speed[i : i + length] < thr * 1.5):
                    return i
            return start_search
        for i in range(min(start_search, T - 1), length, -1):
            if np.all(speed[i - length : i] < thr * 1.5):
                return i
        return start_search

    address = sustained_low(0, True)
    finish = sustained_low(T - 1, False)

    # Top: lowest wrist y (apex in image coords) between address and the
    # frame of peak wrist speed in the whole clip. Peak speed happens during
    # the downswing, strictly after the top — bounding the apex search by it
    # (rather than a fixed fractional window) holds up across swings with
    # very different backswing/downswing proportions.
    top_search_end = int(np.argmax(speed))
    if top_search_end <= address + 2:
        top_search_end = T - 1
    segment = y[address : top_search_end + 1]
    top = address + int(np.argmin(segment)) if len(segment) else address + T // 3
    if top <= address:
        top = min(address + max(2, T // 6), T - 2)

    # Impact: peak speed within a window bounded by the hands returning to
    # roughly address height. The margin is a fraction of this swing's own
    # observed wrist travel, not an absolute pixel value, so it holds across
    # camera distances/resolutions.
    address_y = y[address]
    y_range = float(np.nanmax(y) - np.nanmin(y))
    margin = max(2.0, 0.06 * y_range)
    return_idx = None
    for i in range(top + 1, T):
        if y[i] >= address_y - margin:
            return_idx = i
            break

    if return_idx is None:
        # Hands never returned to ~address height — fall back to the plain
        # velocity-peak search over the rest of the clip.
        after = speed[top:]
        impact = top + (int(np.argmax(after)) if len(after) else 1)
    else:
        buffer = max(2, (return_idx - top) // 4)
        window_end = min(T - 1, return_idx + buffer)
        impact = top + int(np.argmax(speed[top : window_end + 1]))

    # Ordering guards
    address = max(0, min(address, top - 2))
    impact = max(top + 1, min(impact, finish - 1 if finish > top else T - 2))
    finish = max(impact + 1, min(finish, T - 1))

    def lerp(a: int, b: int, t: float) -> int:
        return int(round(a + (b - a) * t))

    frames = {
        "address": address,
        "toe_up": lerp(address, top, 0.25),
        "mid_backswing": lerp(address, top, 0.55),
        "top": top,
        "mid_downswing": lerp(top, impact, 0.5),
        "impact": impact,
        "mid_follow_through": lerp(impact, finish, 0.45),
        "finish": finish,
    }

    # Heuristic confidences are intentionally lower than SwingNet
    conf = {
        "address": 0.55,
        "toe_up": 0.4,
        "mid_backswing": 0.4,
        "top": 0.6,
        "mid_downswing": 0.4,
        "impact": 0.62,
        "mid_follow_through": 0.4,
        "finish": 0.55,
    }

    out = []
    for name in EVENT_NAMES:
        f = frames[name]
        out.append(
            {
                "event": name,
                "frame": int(f),
                "timestampMs": float(f / fps * 1000.0),
                "confidence": conf[name],
            }
        )
    return out


def detect_events_swingnet(
    frames_rgb: list[np.ndarray],
    fps: float,
    checkpoint_url: str,
) -> Optional[list[dict]]:
    """
    Optional SwingNet path. Preprocess like GolfDB: 160×160, ImageNet norm.
    Returns None if checkpoint cannot be loaded (caller falls back to heuristic).
    """
    try:
        import tempfile
        from pathlib import Path
        from urllib.request import urlretrieve

        import torch
        import torch.nn.functional as F
        import cv2
    except ImportError:
        return None

    try:
        from pipeline.swingnet_model import EventDetector
    except ImportError:
        return None

    try:
        with tempfile.TemporaryDirectory() as tmp:
            ckpt_path = Path(tmp) / "swingnet.pth.tar"
            urlretrieve(checkpoint_url, ckpt_path)

            device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
            model = EventDetector(
                pretrain=False,
                width_mult=1.0,
                lstm_layers=1,
                lstm_hidden=256,
                bidirectional=True,
                dropout=False,
            )
            save = torch.load(ckpt_path, map_location=device, weights_only=False)
            state = save.get("model_state_dict", save)
            model.load_state_dict(state)
            model.to(device)
            model.eval()

            mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
            std = np.array([0.229, 0.224, 0.225], dtype=np.float32)
            input_size = 160

            tensors = []
            for img in frames_rgb:
                h, w = img.shape[:2]
                ratio = input_size / max(h, w)
                nh, nw = int(h * ratio), int(w * ratio)
                resized = cv2.resize(img, (nw, nh))
                canvas = np.zeros((input_size, input_size, 3), dtype=np.float32)
                canvas[:, :] = mean * 255.0
                top = (input_size - nh) // 2
                left = (input_size - nw) // 2
                canvas[top : top + nh, left : left + nw] = resized.astype(np.float32)
                x = canvas / 255.0
                x = (x - mean) / std
                tensors.append(torch.from_numpy(x.transpose(2, 0, 1)))

            video = torch.stack(tensors, dim=0).unsqueeze(0).to(device)
            seq = 64
            probs_list = []
            with torch.no_grad():
                t = video.shape[1]
                for start in range(0, t, seq):
                    chunk = video[:, start : start + seq]
                    logits = model(chunk)
                    probs_list.append(F.softmax(logits, dim=1).cpu().numpy())
            probs = np.concatenate(probs_list, axis=0)

            events = []
            for cls, name in enumerate(EVENT_NAMES):
                frame = int(np.argmax(probs[:, cls]))
                events.append(
                    {
                        "event": name,
                        "frame": frame,
                        "timestampMs": float(frame / fps * 1000.0),
                        "confidence": float(probs[frame, cls]),
                    }
                )
            events_sorted = sorted(events, key=lambda e: e["frame"])
            for i, name in enumerate(EVENT_NAMES):
                events_sorted[i]["event"] = name
            return events_sorted
    except Exception:
        return None



def detect_events(
    keypoints: np.ndarray,
    frames_rgb: list[np.ndarray],
    fps: float,
) -> list[dict]:
    ckpt = os.environ.get("SWINGNET_CHECKPOINT_URL", "").strip()
    if ckpt:
        result = detect_events_swingnet(frames_rgb, fps, ckpt)
        if result:
            return result
    return detect_events_heuristic(keypoints, fps)
