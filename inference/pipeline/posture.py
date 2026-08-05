"""
Reliability-gated limb measurement.

Algorithms ported from a collaborator's independent pipeline
(AdanNazir/golf-swing-analysis, tools/posture_metrics.py), which arrived at
them by testing against real footage rather than by assumption. Adapted here
from MediaPipe's 33 landmarks to the RTMPose COCO-17 keypoints this service
already produces — the techniques are pose-agnostic, they only need a
per-keypoint confidence, which RTMPose provides just as MediaPipe's
`visibility` does.

Three findings drive everything in this file, each one established
empirically in that work:

1. SINGLE FRAMES ARE NOISY. A joint angle read off one frame swings wildly
   even at high reported confidence — tracing a trail elbow across nine
   consecutive frames near the top produced 25 deg to 175 deg, physically
   impossible inside 0.3s. Every angle here is therefore the MEDIAN of the
   angle computed independently on each frame in a small window.

2. HIGH CONFIDENCE DOES NOT MEAN CORRECT. When a limb is occluded (routine
   for the lead arm from down-the-line), the pose model confidently INFERS
   a plausible position, and every frame in the window agrees on the same
   wrong answer — a median cannot rescue it. So an angle built on an
   inferred rather than observed joint is not a measurement and must never
   be scored. That is a separate, higher bar than the bar for displaying a
   number at all.

3. A MEDIAN CANNOT FIX A WINDOW THAT DISAGREES WITH ITSELF. Blurred footage
   produced 77 deg vs 153 deg on ADJACENT frames while the model still
   reported ~0.9 confidence. So there is a second, independent gate on how
   much the frames in the window disagree — and it deliberately looks at a
   WIDER neighbourhood than the value is measured over, because a joint
   thrashing either side of one momentarily-quiet window is not actually
   trustworthy there.

The product rule that falls out: report the measurement, but refuse to
GRADE it unless both gates pass. Missing is honest; wrong is not.
"""

from __future__ import annotations

from typing import Any, Callable, Optional

import numpy as np

L_SHOULDER, R_SHOULDER = 5, 6
L_ELBOW, R_ELBOW = 7, 8
L_WRIST, R_WRIST = 9, 10
L_HIP, R_HIP = 11, 12
L_KNEE, R_KNEE = 13, 14
L_ANKLE, R_ANKLE = 15, 16

EVENT_ORDER = [
    "address",
    "toe_up",
    "mid_backswing",
    "top",
    "mid_downswing",
    "impact",
    "mid_follow_through",
    "finish",
]

# Bar for emitting a number at all.
MIN_CONFIDENCE = 0.35

# Much higher bar, required before a measurement may be GRADED. See finding
# 2 above — this is "the model can actually see this joint", not a value
# tuned to make any particular swing score well.
SCORING_MIN_CONFIDENCE = 0.60

# Frames either side of the event that the value is measured over.
WINDOW_RADIUS = 2

# Wider neighbourhood used only to judge stability (finding 3).
SPREAD_CONTEXT_RADIUS = 5

# If the frames disagree by more than this, there is no usable measurement.
SCORING_MAX_SPREAD_DEG = 25.0

# At the top, the trail elbow folds while the lead arm stays near straight.
TRAIL_ROLE_MIN_DIFF_DEG = 15.0
TRAIL_FOLD_MAX_DEG = 120.0
LEAD_STRAIGHT_MIN_DEG = 150.0


def _ok(kpts: np.ndarray, t: int, idx: int, thr: float = MIN_CONFIDENCE) -> bool:
    return 0 <= t < kpts.shape[0] and float(kpts[t, idx, 2]) >= thr


def _angle_2d(kpts: np.ndarray, t: int, a: int, b: int, c: int) -> Optional[float]:
    """Angle at joint b, image-plane only.

    2D on purpose. The collaborator's work tested the intuition that a
    LOCAL joint angle would be safe in 3D even though a torso-spanning
    vector isn't, and it did not hold: the windowed 3D median still read a
    visibly-bent trail arm as essentially straight (~166 deg) where the 2D
    median gave ~96.5 deg, matching both the footage and the literature.
    Whole-body rotation foreshortens the limb once depth is involved.
    """
    if not (_ok(kpts, t, a) and _ok(kpts, t, b) and _ok(kpts, t, c)):
        return None
    ax, ay = float(kpts[t, a, 0]), float(kpts[t, a, 1])
    bx, by = float(kpts[t, b, 0]), float(kpts[t, b, 1])
    cx, cy = float(kpts[t, c, 0]), float(kpts[t, c, 1])
    v1 = (ax - bx, ay - by)
    v2 = (cx - bx, cy - by)
    n1 = (v1[0] ** 2 + v1[1] ** 2) ** 0.5
    n2 = (v2[0] ** 2 + v2[1] ** 2) ** 0.5
    if n1 < 1e-9 or n2 < 1e-9:
        return None
    cos = max(-1.0, min(1.0, (v1[0] * v2[0] + v1[1] * v2[1]) / (n1 * n2)))
    return float(np.degrees(np.arccos(cos)))


def _windowed(
    kpts: np.ndarray,
    center: int,
    fn: Callable[[int], Optional[float]],
    radius: int,
) -> list[float]:
    lo = max(0, center - radius)
    hi = min(kpts.shape[0], center + radius + 1)
    out = []
    for f in range(lo, hi):
        v = fn(f)
        if v is not None:
            out.append(v)
    return out


def windowed_median(
    kpts: np.ndarray, center: int, fn: Callable[[int], Optional[float]]
) -> Optional[float]:
    vals = _windowed(kpts, center, fn, WINDOW_RADIUS)
    if not vals:
        return None
    vals.sort()
    return vals[len(vals) // 2]


def windowed_spread(
    kpts: np.ndarray, center: int, fn: Callable[[int], Optional[float]]
) -> float:
    """How much the frames around `center` disagree, in degrees."""
    vals = _windowed(kpts, center, fn, SPREAD_CONTEXT_RADIUS)
    if len(vals) < 2:
        return 0.0
    return max(vals) - min(vals)


def windowed_confidence(kpts: np.ndarray, center: int, triple: tuple) -> float:
    """Median across the window of the WEAKEST of the three joints — an
    angle is only as trustworthy as its least-visible vertex."""
    lo = max(0, center - WINDOW_RADIUS)
    hi = min(kpts.shape[0], center + WINDOW_RADIUS + 1)
    mins = []
    for f in range(lo, hi):
        mins.append(min(float(kpts[f, i, 2]) for i in triple))
    if not mins:
        return 0.0
    mins.sort()
    return mins[len(mins) // 2]


def _confident_backswing_min_elbow(
    kpts: np.ndarray, address: int, top: int, triple: tuple
) -> Optional[float]:
    """Smallest elbow angle this arm reaches between address and top,
    counting only frames where the arm is genuinely visible.

    Scans the whole backswing rather than the single top frame because the
    top frame is itself an estimate — if it lands a few frames into the
    transition the trail arm has already begun unfolding and reads far
    straighter than it actually got (153 deg at the detected top vs 77 deg
    six frames earlier, on real footage).
    """
    best = None
    for f in range(max(0, address), min(top + 1, kpts.shape[0])):
        if windowed_confidence(kpts, f, triple) < SCORING_MIN_CONFIDENCE:
            continue
        a = windowed_median(kpts, f, lambda t: _angle_2d(kpts, t, *triple))
        if a is not None and (best is None or a < best):
            best = a
    return best


def detect_trail_side(
    kpts: np.ndarray, address: int, top: int
) -> Optional[tuple[str, str]]:
    """Returns (trail_side, lead_side) as "left"/"right", or None.

    Determined from the swing's own data rather than assumed from
    handedness — assuming would silently apply the trail-arm threshold to a
    left-hander's lead arm. The trail elbow folds to roughly 90 deg at the
    top while the lead arm stays near straight, so the fold is a large,
    unambiguous signal.

    Handles the one-sided case deliberately, because it is the common one:
    filmed down-the-line, the lead arm is hidden behind the body, and
    requiring both would throw away a perfectly measurable trail side.
    """
    left = _confident_backswing_min_elbow(
        kpts, address, top, (L_SHOULDER, L_ELBOW, L_WRIST)
    )
    right = _confident_backswing_min_elbow(
        kpts, address, top, (R_SHOULDER, R_ELBOW, R_WRIST)
    )

    if left is not None and right is not None:
        if abs(left - right) < TRAIL_ROLE_MIN_DIFF_DEG:
            return None  # neither folded distinctly more — don't guess
        return ("left", "right") if left < right else ("right", "left")

    for side, value in (("left", left), ("right", right)):
        if value is None:
            continue
        other = "right" if side == "left" else "left"
        if value <= TRAIL_FOLD_MAX_DEG:
            return (side, other)
        if value >= LEAD_STRAIGHT_MIN_DEG:
            return (other, side)
    return None


_LIMB_SPECS = [
    ("arm", "left", (L_SHOULDER, L_ELBOW, L_WRIST)),
    ("arm", "right", (R_SHOULDER, R_ELBOW, R_WRIST)),
    ("leg", "left", (L_HIP, L_KNEE, L_ANKLE)),
    ("leg", "right", (R_HIP, R_KNEE, R_ANKLE)),
]


def compute_limb_measurements(
    keypoints: np.ndarray, events: list[dict]
) -> list[dict[str, Any]]:
    """Every limb at every swing event, with both reliability gates applied.

    Emits measurements only — the literature bands and the score live in
    TypeScript (SPEC 7.1) so the rubric stays versionable in one place.
    Each entry carries `scorable`, which is the web app's signal that this
    number is solid enough to grade rather than merely display.
    """
    frames = {e["event"]: int(e["frame"]) for e in events}
    if "address" not in frames or "top" not in frames:
        return []

    trail_lead = detect_trail_side(keypoints, frames["address"], frames["top"])

    out: list[dict[str, Any]] = []
    for limb_kind, side, triple in _LIMB_SPECS:
        role = None
        if trail_lead is not None:
            role = "trail" if side == trail_lead[0] else "lead"

        for event_name in EVENT_ORDER:
            if event_name not in frames:
                continue
            frame = frames[event_name]

            def fn(t: int, tr=triple) -> Optional[float]:
                return _angle_2d(keypoints, t, *tr)

            value = windowed_median(keypoints, frame, fn)
            if value is None:
                continue

            conf = windowed_confidence(keypoints, frame, triple)
            spread = windowed_spread(keypoints, frame, fn)
            scorable = (
                conf >= SCORING_MIN_CONFIDENCE and spread <= SCORING_MAX_SPREAD_DEG
            )

            reason = None
            if conf < SCORING_MIN_CONFIDENCE:
                reason = "joint_occluded"
            elif spread > SCORING_MAX_SPREAD_DEG:
                reason = "unstable_tracking"
            elif role is None:
                reason = "role_undetermined"

            out.append(
                {
                    "limb": limb_kind,
                    "side": side,
                    "role": role,
                    "event": event_name,
                    "frame": frame,
                    "valueDeg": round(float(value), 1),
                    "confidence": round(float(conf), 3),
                    "spreadDeg": round(float(spread), 1),
                    "scorable": bool(scorable and role is not None),
                    "notScorableReason": reason,
                }
            )

    return out
