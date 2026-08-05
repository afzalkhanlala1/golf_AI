"""End-to-end analysis → AnalysisResult dict."""

from __future__ import annotations

import tempfile
from pathlib import Path
from typing import Any, Optional
from uuid import UUID

from pipeline.blob_io import keypoints_payload, upload_keypoints_gzip
from pipeline.decode import DecodeError, decode_video, download_video
from pipeline.events import detect_events, has_swing_motion
from pipeline.metrics import compute_metrics
from pipeline.pose import run_pose
from pipeline.posture import compute_limb_measurements
from pipeline.view import classify_view


# Below this, pose tracking on a fast-moving clubhead/hands is too sparse to
# trust at all (a handful of frames across the whole downswing) — reject.
HARD_MIN_FPS = 24.0

# Below this, still analyzable — full body position at address/top/finish is
# largely frame-rate independent — but the impact instant is under-sampled,
# so we warn and damp confidence rather than reject. 120fps is the point
# where a 100mph clubhead stops skipping multiple feet between frames.
PREFERRED_MIN_FPS = 120.0

# Backwards-compatible name (README/tests reference MIN_FPS as "the floor").
MIN_FPS = HARD_MIN_FPS


def _fps_confidence_scale(fps: float, phase: str) -> float:
    """Damp confidence for clips shot below the preferred framerate.

    Full-body, low-speed phases (setup/top/finish) barely degrade below
    120fps. Fast phases (downswing/impact) degrade a lot — that's exactly
    the accuracy-ceiling finding in the build plan.
    """
    if fps >= PREFERRED_MIN_FPS:
        return 1.0
    # Linear ramp from 1.0 at 120fps down to a floor at HARD_MIN_FPS.
    span = PREFERRED_MIN_FPS - HARD_MIN_FPS
    t = max(0.0, min(1.0, (fps - HARD_MIN_FPS) / span)) if span > 0 else 0.0
    base_floor = 0.55
    scale = base_floor + (1.0 - base_floor) * t
    if phase in ("impact", "downswing"):
        scale *= 0.7
    return round(max(0.15, min(1.0, scale)), 3)


def _rejected(
    swing_id: str,
    reason: str,
    *,
    fps: float = 0,
    width: int = 0,
    height: int = 0,
    frame_count: int = 0,
    duration_ms: float = 0,
    view: str = "unknown",
    warnings: Optional[list[str]] = None,
    pose_conf: float = 0,
    full_body: bool = False,
) -> dict[str, Any]:
    return {
        "schemaVersion": "1.0",
        "swingId": swing_id,
        "status": "REJECTED",
        "rejectionReason": reason,
        "capture": {
            "fps": fps,
            "width": width,
            "height": height,
            "frameCount": frame_count,
            "durationMs": duration_ms,
            "view": view,
        },
        "quality": {
            "poseConfidenceMean": pose_conf,
            "fpsAdequate": fps >= PREFERRED_MIN_FPS,
            "fullBodyInFrame": full_body,
            "warnings": warnings or [],
        },
        "events": [],
        "metrics": [],
        "limbs": [],
        "faults": [],
        "keypointsUrl": None,
    }


def analyze_swing(
    *,
    swing_id: str,
    blob_url: str,
    claimed_view: str = "unknown",
    upload_keypoints: bool = True,
) -> dict[str, Any]:
    # Validate UUID shape early (contract requires uuid)
    try:
        UUID(swing_id)
    except ValueError as e:
        raise ValueError(f"swingId must be a UUID: {e}") from e

    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / "input.mp4"
        try:
            download_video(blob_url, path)
            clip = decode_video(path)
        except DecodeError as e:
            return _rejected(swing_id, e.reason, view=claimed_view)

    warnings: list[str] = []

    if clip.fps < HARD_MIN_FPS:
        return _rejected(
            swing_id,
            (
                f"Clip appears to be ~{clip.fps:.0f}fps, which is too low to "
                "track a golf swing at all. Re-film at 30fps or higher — "
                "your phone's native slow-motion mode (120fps+) gives the "
                "most accurate result, especially around impact."
            ),
            fps=clip.fps,
            width=clip.width,
            height=clip.height,
            frame_count=len(clip.frames),
            duration_ms=clip.duration_ms,
            view=claimed_view,
            warnings=["low_fps"],
        )

    if clip.fps < PREFERRED_MIN_FPS:
        warnings.append("low_fps")

    if clip.duration_ms < 3000:
        warnings.append("short_clip")

    pose = run_pose(clip.frames)
    if pose.multiple_people:
        warnings.append("multiple_people")
    if not pose.full_body_in_frame:
        warnings.append("partial_body")

    if not has_swing_motion(pose.keypoints, clip.height):
        return _rejected(
            swing_id,
            (
                "No golf swing motion detected in this clip. Make sure the "
                "full swing — address through finish — is in frame, and "
                "that the clip isn't mostly a static setup shot."
            ),
            fps=clip.fps,
            width=clip.width,
            height=clip.height,
            frame_count=len(clip.frames),
            duration_ms=clip.duration_ms,
            view=claimed_view,
            warnings=["no_swing_detected", *warnings],
            pose_conf=float(pose.pose_confidence_mean),
            full_body=bool(pose.full_body_in_frame),
        )

    detected_view = classify_view(pose.keypoints)
    if detected_view == "unknown":
        warnings.append("view_ambiguous")
        view = claimed_view if claimed_view != "unknown" else "unknown"
    elif claimed_view != "unknown" and claimed_view != detected_view:
        warnings.append("view_ambiguous")
        view = detected_view
    else:
        view = detected_view if detected_view != "unknown" else claimed_view

    events = detect_events(pose.keypoints, clip.frames, clip.fps)
    metrics = compute_metrics(
        pose.keypoints, events, clip.fps, pose.pose_confidence_mean
    )

    limbs = compute_limb_measurements(pose.keypoints, events)

    if clip.fps < PREFERRED_MIN_FPS:
        for e in events:
            phase = "impact" if e["event"] == "impact" else "full"
            e["confidence"] = round(
                e["confidence"] * _fps_confidence_scale(clip.fps, phase), 3
            )
        for m in metrics:
            m["confidence"] = round(
                m["confidence"] * _fps_confidence_scale(clip.fps, m["phase"]), 3
            )

    keypoints_url = None
    if upload_keypoints:
        payload = keypoints_payload(
            pose.keypoints,
            fps=clip.fps,
            width=clip.width,
            height=clip.height,
            swing_id=swing_id,
        )
        keypoints_url = upload_keypoints_gzip(payload, swing_id=swing_id)

    return {
        "schemaVersion": "1.0",
        "swingId": swing_id,
        "status": "OK",
        "rejectionReason": None,
        "capture": {
            "fps": float(clip.fps),
            "width": int(clip.width),
            "height": int(clip.height),
            "frameCount": len(clip.frames),
            "durationMs": float(clip.duration_ms),
            "view": view,
        },
        "quality": {
            "poseConfidenceMean": float(pose.pose_confidence_mean),
            "fpsAdequate": clip.fps >= PREFERRED_MIN_FPS,
            "fullBodyInFrame": bool(pose.full_body_in_frame),
            "warnings": warnings,
        },
        "events": events,
        "metrics": metrics,
        # Reliability-gated limb angles; the literature bands and score that
        # consume these live in TypeScript (SPEC 7.1).
        "limbs": limbs,
        "faults": [],  # TypeScript detectFaults owns faults
        "keypointsUrl": keypoints_url,
    }
