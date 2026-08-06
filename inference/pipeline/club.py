"""Clubhead tracking, ball tracking, and the speed metrics built on them.

The pose model gives us the body. It does not give us the club, and the
club is where every number a golfer actually cares about comes from. This
module tracks the clubhead through the strike from ordinary video and
derives clubhead speed, ball speed, smash factor and angle of attack.

## How the clubhead is found

The clubhead is small, thin, and during the downswing it is the fastest
thing in the frame — often smeared across a hundred pixels of motion blur.
That last property is what makes it findable. We do not detect a club; we
detect the strongest motion that is the right distance from the hands.

Per frame, in order:

  1. Three-frame differencing — `min(|f_t - f_t-1|, |f_t - f_t+1|)`. Plain
     consecutive differencing lights up both where the object is *and*
     where it just was, so the trailing ghost competes with the real
     position. Taking the minimum against the next frame cancels the ghost
     and leaves the clubhead at its position at time t.
  2. Suppress the torso. The body is also moving fast and produces far more
     motion energy than a clubhead. A filled shoulder/hip polygon plus a
     head disc gets zeroed out. The hands are deliberately *not* masked —
     the club grows out of them.
  3. Keep only blobs in an annulus around the hands, sized by real club
     length through the pixels-per-metre scale. A driver is ~1.05m; the
     band runs 0.45–1.30× that to tolerate scale error and the shaft
     angles that foreshorten it.
  4. Reject blobs that are too large. A blurred clubhead is a thin streak.
     A forearm sweeping through frame is a slab. Area does separate them.
  5. Among survivors, take the point farthest from the hands — the far end
     of the shaft-plus-head streak — scored by motion strength, distance,
     and agreement with where the previous two frames predicted it would
     be. Continuity is what keeps the track from jumping to a shadow.

## Why several outputs are withheld

A single camera measures motion in the image plane. It does not measure
motion along its own axis, and no confidence value repairs that — a
foreshortened clubhead is not a noisy measurement, it is a biased one, and
publishing it with a low score would still put a wrong number in front of
someone trying to improve.

So the gates are hard, not soft:

  - Clubhead speed and attack angle: face-on only. At impact the clubhead
    travels down the target line, which a face-on camera sees across the
    frame and a down-the-line camera sees head-on. From DTL the same swing
    can read 2–3× slow. We emit nothing and say why.
  - Ball speed: face-on and >=120fps. A struck ball covers ~2.2m per frame
    at 30fps and is gone before the second sample.
  - Clubhead speed also needs >=60fps: frame differencing measures average
    velocity across the interval, which underestimates the peak, and the
    error grows as the interval does.
  - Club path (in-to-out) is not emitted at all. It is an angle relative to
    the target line, and in face-on the target line runs along the camera
    axis where there is no signal to measure. This is a monocular limit,
    not a tuning problem.

The tracer polyline has no such restriction — it is drawn in image space,
which is exactly where it was measured, so it is produced for any view.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Any, Optional

import cv2
import numpy as np

from pipeline.metrics import make_metric
from pipeline.scale import ScaleEstimate, estimate_scale

NOSE = 0
L_SHOULDER, R_SHOULDER = 5, 6
L_WRIST, R_WRIST = 9, 10
L_HIP, R_HIP = 11, 12
L_ANKLE, R_ANKLE = 15, 16

_MPH_PER_MPS = 2.2369362920544

# Driver-ish. Irons are shorter, but the annulus is wide enough to cover
# the whole bag and we are not told which club was swung.
_CLUB_LENGTH_M = 1.05
_ANNULUS_MIN = 0.45
_ANNULUS_MAX = 1.30
_BALL_DIAMETER_M = 0.04267

MIN_FPS_CLUBHEAD = 60.0
MIN_FPS_BALL = 120.0
# The tracer needs the same sampling density the speed estimate does: the
# polyline IS the track, so if the track is unreliable the drawing is a
# fabrication rather than a rough guide.
MIN_FPS_TRACER = 60.0

# A track is only accepted if it behaves like something bolted to the end of
# a rigid shaft. These are the tolerances for that judgement.
_MIN_DETECTION_SCORE = 0.18
_RIGID_TOLERANCE = 0.22   # fraction of median hand->head distance
_MIN_RIGID_FRACTION = 0.70
_MIN_COVERAGE = 0.50

# How far the tracked point must reach from the hands, in metres, at its
# 90th percentile. A lob wedge is ~0.90m and a driver ~1.15m; junior clubs
# run shorter, hence the low floor. Anything under this is a forearm or a
# point on the shaft, not the head — measured at 0.62m on real footage that
# the rigidity test alone was happy to accept.
_MIN_CLUB_REACH_M = 0.78
_MAX_CLUB_REACH_M = 1.30

# Tracking runs on a downscaled copy. The clubhead streak survives it, the
# per-frame cost does not, and the blur that the smaller image introduces
# works in our favour for blob detection.
_TRACK_LONG_EDGE = 640

# Physically plausible outputs. Anything outside these came from a bad
# track, so it is dropped rather than reported.
_CLUBHEAD_MPH_RANGE = (35.0, 145.0)
_BALL_MPH_RANGE = (40.0, 220.0)
_SMASH_RANGE = (1.00, 1.56)


@dataclass
class ClubTracking:
    """tracer entries are `{f, x, y, c}` in ORIGINAL image pixels.

    The `*_unavailable_reason` fields are the point of this type. A golfer
    who gets no clubhead speed is owed an answer for why — "your camera was
    down-the-line" is fixable next swing, "we lost the club" is not the same
    problem, and neither is "shoot at 120fps". These are kept separate from
    `quality.warnings`, which is about the capture being deficient; being
    told that a monocular camera cannot measure depth is not a defect in
    the golfer's video.
    """

    tracer: list[dict[str, Any]] = field(default_factory=list)
    metrics: list[dict[str, Any]] = field(default_factory=list)
    tracked: bool = False
    scale_px_per_m: Optional[float] = None
    speed_unavailable_reason: Optional[str] = None
    ball_unavailable_reason: Optional[str] = None

    def _no_speed(self, reason: str) -> "ClubTracking":
        self.speed_unavailable_reason = reason
        # No clubhead speed means no smash factor to divide into, so the
        # ball number would be an orphan even if we could find it.
        self.ball_unavailable_reason = "needs_clubhead_speed"
        return self


def _event_frame(events: list[dict], name: str) -> Optional[int]:
    for e in events:
        if e.get("event") == name:
            return int(e["frame"])
    return None


def _hand_centre(kp: np.ndarray) -> Optional[tuple[float, float]]:
    lw, rw = kp[L_WRIST], kp[R_WRIST]
    pts = [p for p in (lw, rw) if p[2] >= 0.3]
    if not pts:
        return None
    return (
        float(np.mean([p[0] for p in pts])),
        float(np.mean([p[1] for p in pts])),
    )


def _body_suppression_mask(
    kp: np.ndarray, shape: tuple[int, int], s: float
) -> np.ndarray:
    """255 where motion should be ignored (torso + head)."""
    h, w = shape
    mask = np.zeros((h, w), dtype=np.uint8)

    torso = [L_SHOULDER, R_SHOULDER, R_HIP, L_HIP]
    if all(kp[i, 2] >= 0.3 for i in torso):
        poly = np.array(
            [[kp[i, 0] * s, kp[i, 1] * s] for i in torso], dtype=np.int32
        )
        cv2.fillConvexPoly(mask, poly, 255)

        shoulder_px = float(
            np.hypot(
                (kp[L_SHOULDER, 0] - kp[R_SHOULDER, 0]) * s,
                (kp[L_SHOULDER, 1] - kp[R_SHOULDER, 1]) * s,
            )
        )
        # Grow it a little: the pose polygon is a skeleton, the golfer has
        # width. Too much and it eats a low clubhead near the ball.
        pad = max(3, int(shoulder_px * 0.18))
        mask = cv2.dilate(mask, np.ones((pad, pad), np.uint8))

        if kp[NOSE, 2] >= 0.3:
            cv2.circle(
                mask,
                (int(kp[NOSE, 0] * s), int(kp[NOSE, 1] * s)),
                max(4, int(shoulder_px * 0.45)),
                255,
                -1,
            )
    return mask


def _motion(
    grays: dict[int, np.ndarray], t: int
) -> Optional[np.ndarray]:
    """Three-frame difference at t; falls back to two-frame at the edges."""
    cur = grays.get(t)
    prev = grays.get(t - 1)
    if cur is None or prev is None:
        return None
    d_prev = cv2.absdiff(cur, prev)
    nxt = grays.get(t + 1)
    if nxt is None:
        return d_prev
    return cv2.min(d_prev, cv2.absdiff(cur, nxt))


def _detect_clubhead(
    diff: np.ndarray,
    body: np.ndarray,
    hand: tuple[float, float],
    r_min: float,
    r_max: float,
    predicted: Optional[tuple[float, float]],
) -> Optional[tuple[float, float, float]]:
    """Best (x, y, score) in tracking-resolution pixels, or None."""
    h, w = diff.shape

    # Percentile threshold rather than a fixed one: exposure, lighting and
    # background clutter move the noise floor around between clips.
    thr = max(14.0, float(np.percentile(diff, 99.3)) * 0.45)
    _, mask = cv2.threshold(diff, thr, 255, cv2.THRESH_BINARY)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    mask[body > 0] = 0

    n, labels, stats, _ = cv2.connectedComponentsWithStats(mask, 8)
    if n <= 1:
        return None

    min_area = 4
    max_area = int(0.012 * h * w)
    hx, hy = hand
    sigma = max(6.0, 0.30 * r_max)

    best: Optional[tuple[float, float, float]] = None
    for i in range(1, n):
        area = int(stats[i, cv2.CC_STAT_AREA])
        if area < min_area or area > max_area:
            continue

        x0 = int(stats[i, cv2.CC_STAT_LEFT])
        y0 = int(stats[i, cv2.CC_STAT_TOP])
        cw = int(stats[i, cv2.CC_STAT_WIDTH])
        ch = int(stats[i, cv2.CC_STAT_HEIGHT])
        sub = labels[y0 : y0 + ch, x0 : x0 + cw] == i
        ys, xs = np.nonzero(sub)
        if ys.size == 0:
            continue
        ys = ys + y0
        xs = xs + x0

        d = np.hypot(xs - hx, ys - hy)
        keep = (d >= r_min) & (d <= r_max)
        if not keep.any():
            continue
        xs, ys, d = xs[keep], ys[keep], d[keep]

        # Far end of the streak — the head, not the shaft.
        j = int(np.argmax(d))
        cx, cy, dist = float(xs[j]), float(ys[j]), float(d[j])

        strength = float(np.mean(diff[ys, xs]))
        score = (0.35 + 0.65 * (dist / r_max)) * min(1.0, strength / 60.0)

        if predicted is not None:
            gap = math.hypot(cx - predicted[0], cy - predicted[1])
            score *= 0.30 + 0.70 * math.exp(-(gap * gap) / (2 * sigma * sigma))

        if best is None or score > best[2]:
            best = (cx, cy, score)

    return best


def _run_pass(
    grays: dict[int, np.ndarray],
    keypoints: np.ndarray,
    lo: int,
    hi: int,
    s: float,
    shape: tuple[int, int],
    r_min: float,
    r_max: float,
) -> dict[int, tuple[float, float, float]]:
    """Detect the clubhead across [lo, hi] with the given annulus."""
    track: dict[int, tuple[float, float, float]] = {}
    for t in range(lo, hi + 1):
        diff = _motion(grays, t)
        if diff is None:
            continue
        hand = _hand_centre(keypoints[t])
        if hand is None:
            continue
        hand_t = (hand[0] * s, hand[1] * s)

        predicted = None
        p1, p2 = track.get(t - 1), track.get(t - 2)
        if p1 is not None and p2 is not None:
            predicted = (2 * p1[0] - p2[0], 2 * p1[1] - p2[1])
        elif p1 is not None:
            predicted = (p1[0], p1[1])

        body = _body_suppression_mask(keypoints[t], shape, s)
        found = _detect_clubhead(diff, body, hand_t, r_min, r_max, predicted)
        # Taking the best of a bad set is how a tracker ends up drawing the
        # background. A frame with nothing club-like in it contributes
        # nothing, and the gap logic deals with the hole.
        if found is not None and found[2] >= _MIN_DETECTION_SCORE:
            track[t] = found
    return track


def _hand_distances(
    track: dict[int, tuple[float, float, float]],
    keypoints: np.ndarray,
    s: float,
) -> np.ndarray:
    ds = []
    for t, (x, y, _) in track.items():
        hand = _hand_centre(keypoints[t])
        if hand is None:
            continue
        ds.append(math.hypot(x - hand[0] * s, y - hand[1] * s))
    return np.asarray(ds, dtype=np.float64)


def _track_is_club_like(
    track: dict[int, tuple[float, float, float]],
    keypoints: np.ndarray,
    s: float,
    window: int,
    px_per_m_track: Optional[float],
) -> bool:
    """Does this track behave like the end of a rigid shaft — of a real club?

    Two independent questions, and both have to pass.

    *Rigidity*: the strongest thing we know about a clubhead, stronger than
    any appearance cue, is that it holds a fixed distance from the hands,
    because there is a steel tube in between. Clutter has no reason to obey
    that.

    *Length*: rigidity alone is not enough, and real footage proves it — a
    track can lock onto the forearm or the middle of the shaft and hold a
    beautifully consistent radius that simply is not a club. Because the
    metric scale is available, the radius can be checked in metres against
    what is actually in a golf bag.

    The length test uses the 90th percentile rather than the median, which
    is what makes it survive a down-the-line camera. A club angled toward
    the lens projects shorter than it is, and how much shorter changes
    through the swing — but somewhere in the arc it comes close to square
    to the camera and shows near its true length. The median is dragged
    down by the foreshortened frames; the upper tail is not.
    """
    if window <= 0 or len(track) < 5:
        return False
    if len(track) / window < _MIN_COVERAGE:
        return False

    ds = _hand_distances(track, keypoints, s)
    if ds.size < 5:
        return False
    median = float(np.median(ds))
    if median <= 1e-6:
        return False

    rigid = float(np.mean(np.abs(ds - median) <= _RIGID_TOLERANCE * median))
    if rigid < _MIN_RIGID_FRACTION:
        return False

    if px_per_m_track:
        reach_m = float(np.percentile(ds, 90)) / px_per_m_track
        if not (_MIN_CLUB_REACH_M <= reach_m <= _MAX_CLUB_REACH_M):
            return False

    return True


def _interpolate_gaps(
    track: dict[int, tuple[float, float, float]], lo: int, hi: int, max_gap: int = 2
) -> None:
    """Fill short dropouts in place; long ones stay missing on purpose."""
    known = sorted(track)
    for a, b in zip(known, known[1:]):
        gap = b - a
        if gap <= 1 or gap - 1 > max_gap:
            continue
        ax, ay, ac = track[a]
        bx, by, bc = track[b]
        for k in range(1, gap):
            f = k / gap
            track[a + k] = (
                ax + (bx - ax) * f,
                ay + (by - ay) * f,
                min(ac, bc) * 0.6,  # interpolated, and labelled as weaker
            )


def _smooth_track(
    track: dict[int, tuple[float, float, float]],
) -> dict[int, tuple[float, float, float]]:
    """3-tap smoothing over runs of consecutive frames.

    Kept deliberately short. A wider window would flatten the velocity peak
    at impact, which is the one number this whole module exists to measure.
    """
    out = dict(track)
    for t in sorted(track):
        if (t - 1) not in track or (t + 1) not in track:
            continue
        px, py, _ = track[t - 1]
        cx, cy, cc = track[t]
        nx, ny, _ = track[t + 1]
        out[t] = (
            0.25 * px + 0.5 * cx + 0.25 * nx,
            0.25 * py + 0.5 * cy + 0.25 * ny,
            cc,
        )
    return out


def _impact_speed_px_per_frame(
    track: dict[int, tuple[float, float, float]], impact: int
) -> Optional[tuple[float, float]]:
    """(px/frame, confidence) from the fastest step around impact."""
    steps: list[tuple[float, float]] = []
    for t in range(impact - 2, impact + 2):
        a, b = track.get(t), track.get(t + 1)
        if a is None or b is None:
            continue
        if a[2] < 0.30 or b[2] < 0.30:
            continue
        steps.append((math.hypot(b[0] - a[0], b[1] - a[1]), min(a[2], b[2])))

    if not steps:
        return None
    steps.sort(key=lambda s: s[0], reverse=True)
    # Second largest when we have the samples to spare: one mis-tracked
    # frame produces a huge step, and the max would take it every time.
    pick = steps[1] if len(steps) >= 3 else steps[0]
    return pick


def _locate_ball_at_address(
    frames_rgb: list[np.ndarray],
    impact: int,
    origin: tuple[float, float],
    px_per_m: float,
) -> Optional[tuple[float, float]]:
    """Ball centre in ORIGINAL-resolution pixels, from the frames before impact.

    Runs at native resolution on a small crop. Finding the ball is the one
    step in this module that genuinely needs the pixels: a golf ball is
    42mm, which on the downscaled tracking copy is three or four pixels
    across — under Hough's useful floor. The crop keeps native resolution
    affordable, and the ball is stationary here, so we know where to look.
    """
    r_px = 0.5 * _BALL_DIAMETER_M * px_per_m
    if r_px < 2.5:
        return None  # genuinely too few pixels to call it a circle

    h, w = frames_rgb[0].shape[:2]
    ox, oy = origin
    box = 0.45 * px_per_m
    x0, x1 = int(max(0, ox - box)), int(min(w, ox + box))
    y0, y1 = int(max(0, oy - box)), int(min(h, oy + box))
    if x1 - x0 < 12 or y1 - y0 < 12:
        return None

    crops = [
        cv2.cvtColor(frames_rgb[t][y0:y1, x0:x1], cv2.COLOR_RGB2GRAY).astype(np.float32)
        for t in range(max(0, impact - 6), max(1, impact - 1))
    ]
    if len(crops) < 2:
        return None

    # Averaging is safe precisely because the ball has not moved yet, and it
    # takes the sensor noise down with it.
    still = cv2.GaussianBlur(np.mean(crops, axis=0).astype(np.uint8), (5, 5), 0)

    circles = cv2.HoughCircles(
        still,
        cv2.HOUGH_GRADIENT,
        dp=1.0,
        minDist=max(6.0, r_px * 3),
        param1=90,
        param2=13,
        minRadius=max(2, int(r_px * 0.6)),
        maxRadius=max(4, int(r_px * 1.9)),
    )
    if circles is None or len(circles[0]) == 0:
        return None
    return float(circles[0][0][0]) + x0, float(circles[0][0][1]) + y0


def _detect_ball(
    frames_rgb: list[np.ndarray],
    grays: dict[int, np.ndarray],
    impact: int,
    origin: tuple[float, float],
    px_per_m: float,
    s: float,
    fps: float,
) -> Optional[tuple[float, float]]:
    """(ball speed mph, confidence), or None if it could not be tracked.

    Two resolutions on purpose. The ball is *located* at native resolution
    where it is only a few dozen pixels (above), then *followed* on the
    downscaled copy, because a struck ball crosses a large fraction of the
    frame per frame and the wide search is what costs — not the precision,
    which the long displacement makes cheap.
    """
    b0_full = _locate_ball_at_address(frames_rgb, impact, origin, px_per_m)
    if b0_full is None:
        return None

    bx, by = b0_full[0] * s, b0_full[1] * s
    px_per_m_track = px_per_m * s
    r_px = 0.5 * _BALL_DIAMETER_M * px_per_m_track
    ball_area = max(2.0, math.pi * r_px * r_px)

    # Candidate blobs per frame after impact.
    cands: dict[int, list[tuple[float, float]]] = {}
    for k in range(1, 5):
        d = _motion(grays, impact + k)
        if d is None:
            continue
        thr = max(12.0, float(np.percentile(d, 99.5)) * 0.4)
        _, m = cv2.threshold(d, thr, 255, cv2.THRESH_BINARY)
        n, _, stats, cents = cv2.connectedComponentsWithStats(m, 8)
        found: list[tuple[float, float]] = []
        for i in range(1, n):
            area = int(stats[i, cv2.CC_STAT_AREA])
            if area < ball_area * 0.3 or area > ball_area * 12:
                continue
            cx, cy = float(cents[i][0]), float(cents[i][1])
            dist = math.hypot(cx - bx, cy - by)
            # Plausible travel for frame k, expressed as a pixel band.
            lo = (_BALL_MPH_RANGE[0] / _MPH_PER_MPS) * px_per_m_track * k / fps
            hi = (_BALL_MPH_RANGE[1] / _MPH_PER_MPS) * px_per_m_track * k / fps
            if lo <= dist <= hi:
                found.append((cx, cy))
        if found:
            cands[k] = found

    if not cands:
        return None

    # The clubhead is still moving fast right next to the ball just after
    # impact, and it can pass the size and distance filters. What it cannot
    # do is stay on the ball's straight line — the club is on an arc and
    # decelerating. So rather than trusting any single frame, take each
    # early candidate as a hypothesised velocity and keep whichever one the
    # later frames actually confirm.
    best: Optional[tuple[float, int, float]] = None  # (px/frame, hits, spread)
    for k0, pts in cands.items():
        for cx, cy in pts:
            vx, vy = (cx - bx) / k0, (cy - by) / k0
            speed = math.hypot(vx, vy)
            if speed <= 1e-6:
                continue
            tol = max(3.0, 0.25 * speed)

            hits, resid = 1, 0.0
            for k, others in cands.items():
                if k == k0:
                    continue
                px_, py_ = bx + vx * k, by + vy * k
                near = min(
                    (math.hypot(ox_ - px_, oy_ - py_) for ox_, oy_ in others),
                    default=None,
                )
                if near is not None and near <= tol * k:
                    hits += 1
                    resid += near

            score = (hits, -resid)
            if best is None or score > (best[1], -best[2]):
                best = (speed, hits, resid)

    if best is None:
        return None

    px_per_frame, hits, _ = best
    # One unconfirmed frame is exactly the case the clubhead fakes. Require
    # the line to hold across at least two frames before reporting a number.
    if hits < 2:
        return None

    mph = (px_per_frame * fps / px_per_m_track) * _MPH_PER_MPS
    if not (_BALL_MPH_RANGE[0] <= mph <= _BALL_MPH_RANGE[1]):
        return None

    return mph, float(min(0.45 + 0.13 * hits, 0.85))


def track_club(
    frames_rgb: list[np.ndarray],
    keypoints: np.ndarray,
    world: Optional[np.ndarray],
    events: list[dict],
    fps: float,
    view: str,
    width: int,
    height: int,
) -> Optional[ClubTracking]:
    """Track the clubhead and derive what the camera can honestly support.

    Returns None when there is nothing to track against — no impact event,
    or too few usable frames. A returned object may still carry an empty
    metric list: the tracer is useful on its own.
    """
    impact = _event_frame(events, "impact")
    if impact is None or not frames_rgb:
        return None

    T = len(frames_rgb)
    if not (0 <= impact < T):
        return None

    out = ClubTracking()

    # --- scale -------------------------------------------------------
    # Computed before the frame-rate gate below, because it does not depend
    # on frame rate: it comes from body proportions at address. A 30fps clip
    # still gets a valid pixels-per-metre out of this.
    addr = _event_frame(events, "address")
    scale_est: Optional[ScaleEstimate] = None
    if world is not None:
        window = (max(0, (addr or 0) - 2), (addr or 0) + 12) if addr is not None else None
        scale_est = estimate_scale(keypoints, world, frame_range=window)
        if scale_est is None:
            scale_est = estimate_scale(keypoints, world)
    if scale_est is not None:
        out.scale_px_per_m = round(scale_est.px_per_m, 2)

    # Below this the clubhead is not a trackable object. At 30fps a 100mph
    # clubhead covers ~1.5m between exposures — further than the club is
    # long — so there is no continuity to follow and the head itself is
    # smeared across that whole arc rather than sitting anywhere. Attempting
    # it produces a confident-looking polyline stitched out of grass, trees
    # and the golfer's own legs, which is worse than drawing nothing.
    if fps < MIN_FPS_TRACER:
        return out._no_speed("needs_high_fps")

    # --- tracking window ---------------------------------------------
    # Mid-backswing to mid-follow-through, not top to finish. Outside that
    # span the club is slow or parked, the frame difference is dominated by
    # wind and camera shake, and every detection is noise — which then feeds
    # the continuity term and drags the live part of the track with it.
    start = _event_frame(events, "mid_backswing") or _event_frame(events, "top")
    end = _event_frame(events, "mid_follow_through") or _event_frame(events, "finish")
    lo = start if start is not None else max(0, impact - int(fps * 0.45))
    hi = end if end is not None else min(T - 1, impact + int(fps * 0.35))
    lo = max(1, min(lo, impact - 1))
    hi = min(T - 2, max(hi, impact + 1))
    if hi <= lo:
        return None

    s = min(1.0, _TRACK_LONG_EDGE / max(width, height)) if max(width, height) else 1.0

    grays: dict[int, np.ndarray] = {}
    for t in range(lo - 1, hi + 2):
        if not (0 <= t < T):
            continue
        g = cv2.cvtColor(frames_rgb[t], cv2.COLOR_RGB2GRAY)
        if s < 1.0:
            g = cv2.resize(g, None, fx=s, fy=s, interpolation=cv2.INTER_AREA)
        grays[t] = g

    if len(grays) < 3:
        return None
    th, tw = grays[next(iter(grays))].shape

    # Annulus radii. With a metric scale we use real club length; without
    # one we fall back to shoulder width, which is a worse but workable
    # proxy — and in that case no speed is emitted anyway.
    if scale_est is not None:
        club_px = _CLUB_LENGTH_M * scale_est.px_per_m * s
    else:
        sw = [
            float(np.hypot(*(keypoints[t, L_SHOULDER, :2] - keypoints[t, R_SHOULDER, :2])))
            for t in range(lo, hi + 1)
            if keypoints[t, L_SHOULDER, 2] > 0.3 and keypoints[t, R_SHOULDER, 2] > 0.3
        ]
        if not sw:
            return None
        club_px = float(np.median(sw)) * 2.6 * s

    window = hi - lo + 1

    # Pass 1: a wide annulus, because we only know the club length to within
    # whatever the bag holds and however the shaft is foreshortened.
    track = _run_pass(
        grays, keypoints, lo, hi, s, (th, tw),
        club_px * _ANNULUS_MIN, club_px * _ANNULUS_MAX,
    )
    if len(track) < 5:
        return out._no_speed("not_tracked")

    # Pass 2: the detections themselves say how long the club is in this
    # clip — that is a measurement, where the 1.05m constant was an
    # assumption. Re-running against a tight band around the observed radius
    # rejects the near-body and background candidates that a wide annulus
    # has to tolerate.
    observed = _hand_distances(track, keypoints, s)
    if observed.size >= 5:
        radius = float(np.median(observed))
        tight = _run_pass(
            grays, keypoints, lo, hi, s, (th, tw), radius * 0.80, radius * 1.20
        )
        if len(tight) >= len(track) * 0.6:
            track = tight

    px_per_m_track = scale_est.px_per_m * s if scale_est is not None else None
    if not _track_is_club_like(track, keypoints, s, window, px_per_m_track):
        # It found things; they just did not move like a clubhead. Saying so
        # is the useful outcome — a drawn-on arc that is not the club would
        # be read as ground truth.
        return out._no_speed("not_tracked")

    _interpolate_gaps(track, lo, hi)
    track = _smooth_track(track)

    # Interpolation draws a straight line between two detections; when the
    # club swept across the far side of the hands in between, that line
    # passes through the golfer instead of around them. Drop anything the
    # shaft cannot reach rather than letting it into the drawn path.
    radius = float(np.median(_hand_distances(track, keypoints, s)) or 0.0)
    if radius > 1e-6:
        for t in list(track):
            hand = _hand_centre(keypoints[t])
            if hand is None:
                continue
            d = math.hypot(track[t][0] - hand[0] * s, track[t][1] - hand[1] * s)
            if not (0.70 * radius <= d <= 1.30 * radius):
                del track[t]

    if len(track) < 5:
        return out._no_speed("not_tracked")

    out.tracked = True

    inv = 1.0 / s if s > 0 else 1.0
    out.tracer = [
        {
            "f": t,
            "x": round(track[t][0] * inv, 1),
            "y": round(track[t][1] * inv, 1),
            "c": round(float(np.clip(track[t][2], 0.0, 1.0)), 3),
        }
        for t in sorted(track)
    ]

    # --- speeds ------------------------------------------------------
    if scale_est is None:
        return out._no_speed("needs_3d_pose")
    if view != "face_on":
        # See the module docstring: this is bias, not noise.
        return out._no_speed("needs_face_on")
    if fps < MIN_FPS_CLUBHEAD:
        return out._no_speed("needs_high_fps")

    step = _impact_speed_px_per_frame(track, impact)
    if step is None:
        return out._no_speed("not_tracked_at_impact")

    px_per_frame, track_conf = step
    px_per_m_track = scale_est.px_per_m * s
    club_mph = (px_per_frame * fps / px_per_m_track) * _MPH_PER_MPS

    club_conf = track_conf * scale_est.confidence
    # 60fps is the floor; the estimate keeps tightening up to ~240.
    club_conf *= float(np.clip(0.55 + 0.45 * (fps - 60.0) / 180.0, 0.55, 1.0))

    if _CLUBHEAD_MPH_RANGE[0] <= club_mph <= _CLUBHEAD_MPH_RANGE[1]:
        out.metrics.append(
            make_metric("clubhead_speed_mph", club_mph, club_conf)
        )
    else:
        return out._no_speed("implausible_result")

    # --- attack angle -------------------------------------------------
    a, b = track.get(impact - 1), track.get(impact + 1)
    if a is not None and b is not None and a[2] >= 0.3 and b[2] >= 0.3:
        dx, dy = b[0] - a[0], b[1] - a[1]
        if abs(dx) > 1e-3:
            # Image y grows downward, so a rising clubhead has dy < 0.
            aoa = math.degrees(math.atan2(-dy, abs(dx)))
            if -12.0 <= aoa <= 12.0:
                out.metrics.append(
                    make_metric("attack_angle_deg", aoa, club_conf * 0.7)
                )

    # --- ball ---------------------------------------------------------
    if fps < MIN_FPS_BALL:
        out.ball_unavailable_reason = "needs_120fps"
        return out

    origin = track.get(impact)
    if origin is None:
        out.ball_unavailable_reason = "not_detected"
        return out

    # The clubhead at impact is, by definition, where the ball was.
    ball = _detect_ball(
        frames_rgb,
        grays,
        impact,
        (origin[0] * inv, origin[1] * inv),
        scale_est.px_per_m,
        s,
        fps,
    )
    if ball is None:
        out.ball_unavailable_reason = "not_detected"
        return out

    ball_mph, ball_conf = ball
    ball_conf *= scale_est.confidence
    out.metrics.append(make_metric("ball_speed_mph", ball_mph, ball_conf))

    smash = ball_mph / club_mph if club_mph > 1e-6 else 0.0
    if _SMASH_RANGE[0] <= smash <= _SMASH_RANGE[1]:
        out.metrics.append(
            make_metric("smash_factor", smash, min(club_conf, ball_conf))
        )
    # Out of physical range means one of the two speeds is wrong. We cannot
    # tell which, so the smash factor is simply absent — both speeds still
    # stand on their own, each with its own confidence.

    return out
