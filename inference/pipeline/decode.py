"""Video decode + true fps via ffprobe/PyAV."""

from __future__ import annotations

import json
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Optional
from urllib.request import urlretrieve

import av
import cv2
import numpy as np


@dataclass
class DecodedClip:
    frames: list[np.ndarray]  # RGB uint8
    fps: float
    width: int
    height: int
    duration_ms: float
    path: Path


class DecodeError(Exception):
    def __init__(self, reason: str, rejection: bool = True):
        super().__init__(reason)
        self.reason = reason
        self.rejection = rejection


def _ffprobe_fps(path: Path) -> Optional[float]:
    """Prefer ffprobe r_frame_rate / avg_frame_rate over container metadata."""
    try:
        out = subprocess.check_output(
            [
                "ffprobe",
                "-v",
                "error",
                "-select_streams",
                "v:0",
                "-show_entries",
                "stream=r_frame_rate,avg_frame_rate,nb_frames,duration",
                "-of",
                "json",
                str(path),
            ],
            text=True,
        )
        data = json.loads(out)
        stream = (data.get("streams") or [{}])[0]
        for key in ("r_frame_rate", "avg_frame_rate"):
            rate = stream.get(key)
            if rate and rate != "0/0":
                num, den = rate.split("/")
                den_f = float(den)
                if den_f > 0:
                    fps = float(num) / den_f
                    if fps > 1:
                        return fps
    except (subprocess.CalledProcessError, FileNotFoundError, ValueError, KeyError):
        return None
    return None


def download_video(url: str, dest: Path) -> Path:
    dest.parent.mkdir(parents=True, exist_ok=True)
    urlretrieve(url, dest)
    return dest


def decode_video(path: Path, max_long_edge: int = 1080) -> DecodedClip:
    probe_fps = _ffprobe_fps(path)

    container = av.open(str(path))
    stream = container.streams.video[0]
    stream.thread_type = "AUTO"

    meta_fps = float(stream.average_rate) if stream.average_rate else 0.0
    fps = probe_fps or meta_fps
    if fps <= 1:
        raise DecodeError("Could not determine a reliable frame rate for this clip.")

    frames: list[np.ndarray] = []
    width = height = 0

    for frame in container.decode(video=0):
        img = frame.to_ndarray(format="rgb24")
        h, w = img.shape[:2]
        long_edge = max(h, w)
        if long_edge > max_long_edge:
            scale = max_long_edge / long_edge
            img = cv2.resize(
                img,
                (int(w * scale), int(h * scale)),
                interpolation=cv2.INTER_AREA,
            )
            h, w = img.shape[:2]
        width, height = w, h
        frames.append(img)

    container.close()

    if not frames:
        raise DecodeError("No frames could be decoded from this clip.")

    duration_ms = (len(frames) / fps) * 1000.0
    if duration_ms < 1000:
        raise DecodeError("Clip is shorter than 1 second. Film a full swing (5–10s).")
    if duration_ms > 20_000:
        raise DecodeError("Clip is longer than 20 seconds. Trim to a single swing.")

    return DecodedClip(
        frames=frames,
        fps=fps,
        width=width,
        height=height,
        duration_ms=duration_ms,
        path=path,
    )
