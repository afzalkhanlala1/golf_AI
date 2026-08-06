"""Pixels → metres, derived from MediaPipe's metric reconstruction.

Every speed number in this pipeline needs one honest scale factor, and a
monocular camera does not give you one for free. Three ways to get it:

  1. Ask the golfer their height. Self-reported, and height is a poor
     predictor of shoulder width anyway.
  2. Detect a known object (the ball, 42.67mm). Circular, tiny, often
     motion-blurred or occluded at address — a bad thing to hang the whole
     speed feature on.
  3. Use the metric body reconstruction the pose model already produced.

We do (3). MediaPipe's `pose_world_landmarks` are in metres with the origin
at the hip midpoint, and — this is the part that makes it usable — their
x/y axes are aligned with the image axes. So for any body segment we can
compare its length in pixels against the length of its own projection into
the world x/y plane, and the two are measuring the same thing.

That alignment matters. Comparing a pixel length against the full 3D world
length would inflate the scale for any segment angled toward the camera:
the segment is foreshortened in the image but full-length in 3D. Dropping
the world z component before measuring removes that error rather than
averaging over it.

The estimate is still a projective approximation — it assumes the golfer
sits at roughly one depth, which is true for the body and false for a
clubhead swinging through a metre of depth. club.py accounts for that
separately in its own confidence, and the view classification carries the
rest: a face-on camera sees the clubhead's impact travel almost in-plane,
a down-the-line camera sees it heavily foreshortened.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

import numpy as np

# Matches src/lib/metrics/geometry.ts and pose.MP_TO_KP. Kept local rather
# than imported so this module has no dependency on the pose backend.
L_SHOULDER, R_SHOULDER = 5, 6
L_HIP, R_HIP = 11, 12

# Segments used for the estimate. Chosen because they are rigid, roughly
# planar with the torso, and visible in both camera views. Limb segments
# (upper arm, thigh) are deliberately excluded: they swing through large
# depth changes during the swing, which is exactly the case where a
# projective scale is least trustworthy.
_SEGMENTS: list[tuple[int, int]] = [
    (L_SHOULDER, R_SHOULDER),
    (L_HIP, R_HIP),
    (L_SHOULDER, L_HIP),
    (R_SHOULDER, R_HIP),
]

_MIN_VISIBILITY = 0.5
# Below this the world segment is short enough that its own reconstruction
# noise dominates the ratio.
_MIN_WORLD_METRES = 0.08
_MIN_PIXELS = 12.0
_MIN_SAMPLES = 8


@dataclass
class ScaleEstimate:
    """px_per_m: multiply metres by this to get pixels; divide to invert."""

    px_per_m: float
    """Relative spread of the underlying samples (MAD / median). Low is
    good; a high value means the segments disagreed, which usually means
    the golfer moved in depth or the reconstruction was unstable."""
    dispersion: float
    samples: int
    confidence: float


def estimate_scale(
    keypoints: np.ndarray,
    world: np.ndarray,
    *,
    frame_range: Optional[tuple[int, int]] = None,
) -> Optional[ScaleEstimate]:
    """Median px-per-metre over a window, or None if nothing was measurable.

    keypoints: (T, K, 3) image space x, y, confidence.
    world:     (T, K, 4) metric x, y, z, visibility.
    frame_range: inclusive-exclusive window to measure over. Defaults to the
        whole clip. Callers generally want the address window, where the
        golfer is stationary and square to the camera.
    """
    if keypoints.ndim != 3 or world.ndim != 3:
        return None
    if keypoints.shape[0] == 0 or world.shape[0] != keypoints.shape[0]:
        return None

    lo, hi = frame_range or (0, keypoints.shape[0])
    lo = max(0, int(lo))
    hi = min(keypoints.shape[0], int(hi))
    if hi <= lo:
        return None

    ratios: list[float] = []
    for t in range(lo, hi):
        kp = keypoints[t]
        wd = world[t]
        for a, b in _SEGMENTS:
            if kp[a, 2] < _MIN_VISIBILITY or kp[b, 2] < _MIN_VISIBILITY:
                continue
            if wd[a, 3] < _MIN_VISIBILITY or wd[b, 3] < _MIN_VISIBILITY:
                continue

            px = float(np.hypot(kp[a, 0] - kp[b, 0], kp[a, 1] - kp[b, 1]))
            # z dropped on purpose — see the module docstring.
            m = float(np.hypot(wd[a, 0] - wd[b, 0], wd[a, 1] - wd[b, 1]))
            if px < _MIN_PIXELS or m < _MIN_WORLD_METRES:
                continue
            ratios.append(px / m)

    if len(ratios) < _MIN_SAMPLES:
        return None

    arr = np.asarray(ratios, dtype=np.float64)
    median = float(np.median(arr))
    if not np.isfinite(median) or median <= 0:
        return None

    mad = float(np.median(np.abs(arr - median)))
    dispersion = mad / median if median > 0 else 1.0

    # Dispersion under ~4% is a clean, consistent read; past ~25% the
    # segments disagree enough that any speed built on this is guesswork.
    confidence = float(np.clip(1.0 - (dispersion - 0.04) / 0.21, 0.0, 1.0))
    if len(arr) < 24:
        confidence *= 0.8

    return ScaleEstimate(
        px_per_m=median,
        dispersion=round(dispersion, 4),
        samples=len(arr),
        confidence=round(float(np.clip(confidence, 0.0, 1.0)), 3),
    )
