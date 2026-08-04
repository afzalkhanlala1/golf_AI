"""
Phone video rotation correction.

Phones (especially iPhones) commonly store video with a QuickTime/MP4
display-matrix rotation instead of physically rotating the pixel data.
PyAV/ffmpeg decode the raw stream and do NOT apply that rotation for you —
it's a display hint, not baked into the frame data — so without correcting
for it, a portrait phone clip gets analyzed sideways: pose detection runs on
a rotated body, and every swing-event/metric heuristic (which assumes
roughly vertical swing motion) reads the wrong axis entirely.

Usage:
    correction = get_rotation_correction(video_path)  # 0, 90, 180, or 270
    frame = apply_rotation(frame, correction)
"""

from __future__ import annotations

import json
import subprocess

import cv2
import numpy as np


def get_rotation_correction(video_path: str) -> int:
    """Clockwise rotation (0/90/180/270) to apply to decoded frames so they
    come out upright. Reads the stream's display-matrix rotation / rotate
    tag via ffprobe; returns 0 if there's no metadata or ffprobe fails."""
    try:
        result = subprocess.run(
            [
                "ffprobe",
                "-v",
                "quiet",
                "-print_format",
                "json",
                "-show_streams",
                video_path,
            ],
            capture_output=True,
            text=True,
            timeout=10,
        )
        data = json.loads(result.stdout)
    except Exception:
        return 0

    for stream in data.get("streams", []):
        if stream.get("codec_type") != "video":
            continue
        raw_rotation = None
        for side_data in stream.get("side_data_list", []):
            if "rotation" in side_data:
                raw_rotation = int(side_data["rotation"])
                break
        if raw_rotation is None:
            tag = stream.get("tags", {}).get("rotate")
            if tag:
                raw_rotation = -int(tag)  # rotate tag is clockwise-positive, opposite convention
        if not raw_rotation:
            return 0
        needed = (-raw_rotation) % 360
        return needed if needed in (90, 180, 270) else 0
    return 0


def apply_rotation(frame: np.ndarray, correction: int) -> np.ndarray:
    if correction == 90:
        return cv2.rotate(frame, cv2.ROTATE_90_CLOCKWISE)
    if correction == 180:
        return cv2.rotate(frame, cv2.ROTATE_180)
    if correction == 270:
        return cv2.rotate(frame, cv2.ROTATE_90_COUNTERCLOCKWISE)
    return frame
