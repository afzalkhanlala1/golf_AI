"""Scale-invariant metrics (SPEC §7.2). No scoring / faults — TypeScript owns those."""

from __future__ import annotations

from typing import Any, Optional

import numpy as np

NOSE = 0
L_SHOULDER, R_SHOULDER = 5, 6
L_ELBOW, R_ELBOW = 7, 8
L_WRIST, R_WRIST = 9, 10
L_HIP, R_HIP = 11, 12
L_KNEE, R_KNEE = 13, 14
L_ANKLE, R_ANKLE = 15, 16

# Mid-handicap bands — mirrors src/lib/scoring/rubric.config.ts
TARGETS: dict[str, dict[str, float]] = {
    "tempo_ratio": {"min": 2.7, "max": 3.3},
    "backswing_duration_ms": {"min": 700, "max": 1200},
    "shoulder_turn_top": {"min": 80, "max": 105},
    "hip_turn_top": {"min": 35, "max": 55},
    "x_factor_top": {"min": 30, "max": 50},
    "spine_angle_address": {"min": 25, "max": 40},
    "spine_angle_change": {"min": 0, "max": 8},
    "spine_tilt_top": {"min": -2, "max": 12},
    "hip_depth_change_downswing": {"min": 0, "max": 0.05},
    "hip_lateral_backswing": {"min": 0, "max": 0.08},
    "hip_lateral_downswing": {"min": 0, "max": 0.08},
    "head_movement": {"min": 0, "max": 0.15},
    "lead_arm_angle_top": {"min": 150, "max": 180},
    "lead_arm_angle_impact": {"min": 145, "max": 180},
    "kinematic_sequence_index": {"min": 0.7, "max": 1.0},
    "shoulder_plane_top": {"min": 35, "max": 55},
    "weight_forward_finish": {"min": 0.55, "max": 0.85},
}

PHASE: dict[str, str] = {
    "tempo_ratio": "full",
    "backswing_duration_ms": "backswing",
    "shoulder_turn_top": "top",
    "hip_turn_top": "top",
    "x_factor_top": "top",
    "spine_angle_address": "setup",
    "spine_angle_change": "impact",
    "spine_tilt_top": "top",
    "hip_depth_change_downswing": "downswing",
    "hip_lateral_backswing": "backswing",
    "hip_lateral_downswing": "downswing",
    "head_movement": "full",
    "lead_arm_angle_top": "top",
    "lead_arm_angle_impact": "impact",
    "kinematic_sequence_index": "downswing",
    "shoulder_plane_top": "top",
    "weight_forward_finish": "finish",
}

UNIT: dict[str, str] = {
    "tempo_ratio": "ratio",
    "backswing_duration_ms": "ms",
    "shoulder_turn_top": "deg",
    "hip_turn_top": "deg",
    "x_factor_top": "deg",
    "spine_angle_address": "deg",
    "spine_angle_change": "deg",
    "spine_tilt_top": "deg",
    "hip_depth_change_downswing": "norm",
    "hip_lateral_backswing": "norm",
    "hip_lateral_downswing": "norm",
    "head_movement": "norm",
    "lead_arm_angle_top": "deg",
    "lead_arm_angle_impact": "deg",
    "kinematic_sequence_index": "index",
    "shoulder_plane_top": "deg",
    "weight_forward_finish": "norm",
}


def _ef(events: list[dict], name: str) -> Optional[int]:
    for e in events:
        if e["event"] == name:
            return int(e["frame"])
    return None


def _ok(kpts: np.ndarray, t: int, idx: int, thr: float = 0.3) -> bool:
    return 0 <= t < kpts.shape[0] and float(kpts[t, idx, 2]) >= thr


def _xy(kpts: np.ndarray, t: int, idx: int) -> Optional[np.ndarray]:
    if not _ok(kpts, t, idx):
        return None
    return kpts[t, idx, :2].astype(np.float64)


def _mid(a: Optional[np.ndarray], b: Optional[np.ndarray]) -> Optional[np.ndarray]:
    if a is None or b is None:
        return None
    return (a + b) / 2.0


def _inclination(p0: np.ndarray, p1: np.ndarray) -> float:
    d = p1 - p0
    return float(np.degrees(np.arctan2(d[1], d[0])))


def _angle_from_vertical(hip: np.ndarray, shoulder: np.ndarray) -> float:
    v = shoulder - hip
    return float(np.degrees(np.arctan2(v[0], -v[1] + 1e-9)))


def _joint_angle(a: np.ndarray, b: np.ndarray, c: np.ndarray) -> float:
    ba, bc = a - b, c - b
    nba, nbc = np.linalg.norm(ba), np.linalg.norm(bc)
    if nba < 1e-6 or nbc < 1e-6:
        return float("nan")
    cos = np.clip(np.dot(ba, bc) / (nba * nbc), -1.0, 1.0)
    return float(np.degrees(np.arccos(cos)))


def _hip_w(kpts: np.ndarray, t: int) -> Optional[float]:
    lh, rh = _xy(kpts, t, L_HIP), _xy(kpts, t, R_HIP)
    if lh is None or rh is None:
        return None
    w = float(np.linalg.norm(lh - rh))
    return w if w > 1e-3 else None


def _shoulder_w(kpts: np.ndarray, t: int) -> Optional[float]:
    ls, rs = _xy(kpts, t, L_SHOULDER), _xy(kpts, t, R_SHOULDER)
    if ls is None or rs is None:
        return None
    w = float(np.linalg.norm(ls - rs))
    return w if w > 1e-3 else None


def _stance_w(kpts: np.ndarray, t: int) -> Optional[float]:
    la, ra = _xy(kpts, t, L_ANKLE), _xy(kpts, t, R_ANKLE)
    if la is None or ra is None:
        return None
    w = float(abs(la[0] - ra[0]))
    return w if w > 1e-3 else None


def _metric(key: str, value: float, confidence: float) -> dict[str, Any]:
    tgt = TARGETS.get(key)
    return {
        "key": key,
        "value": round(float(value), 4 if UNIT.get(key) in ("norm", "ratio", "index") else 2),
        "unit": UNIT[key],
        "phase": PHASE[key],
        "confidence": round(min(1.0, max(0.0, confidence)), 3),
        "target": {"min": tgt["min"], "max": tgt["max"]} if tgt else None,
    }


def _kinematic_peaks(
    kpts: np.ndarray, top: int, impact: int
) -> Optional[tuple[int, int, int]]:
    if impact <= top + 2:
        return None

    def series_angle(i0: int, i1: int) -> np.ndarray:
        vals = []
        for t in range(top, impact + 1):
            a = _xy(kpts, t, i0)
            b = _xy(kpts, t, i1)
            if a is None or b is None:
                vals.append(np.nan)
            else:
                vals.append(_inclination(a, b))
        return np.asarray(vals, dtype=np.float64)

    pelvis = series_angle(L_HIP, R_HIP)
    thorax = series_angle(L_SHOULDER, R_SHOULDER)

    arm = []
    for t in range(top, impact + 1):
        s, e, w = _xy(kpts, t, L_SHOULDER), _xy(kpts, t, L_ELBOW), _xy(kpts, t, L_WRIST)
        if s is None or e is None or w is None:
            s, e, w = _xy(kpts, t, R_SHOULDER), _xy(kpts, t, R_ELBOW), _xy(kpts, t, R_WRIST)
        if s is None or e is None or w is None:
            arm.append(np.nan)
        else:
            arm.append(_joint_angle(s, e, w))
    arm_a = np.asarray(arm, dtype=np.float64)

    def peak_vel(angles: np.ndarray) -> Optional[int]:
        if np.all(np.isnan(angles)) or len(angles) < 3:
            return None
        filled = np.copy(angles)
        nans = np.isnan(filled)
        if nans.all():
            return None
        idx = np.where(~nans)[0]
        filled[nans] = np.interp(np.where(nans)[0], idx, filled[idx])
        vel = np.abs(np.diff(filled, prepend=filled[0]))
        return top + int(np.argmax(vel))

    p, th, a = peak_vel(pelvis), peak_vel(thorax), peak_vel(arm_a)
    if p is None or th is None or a is None:
        return None
    return p, th, a


def _sequence_index(pelvis: int, thorax: int, arm: int) -> float:
    if pelvis < thorax < arm:
        g1, g2 = thorax - pelvis, arm - thorax

        def gap_score(g: int) -> float:
            if 2 <= g <= 12:
                return 1.0
            if g < 2:
                return max(0.0, g / 2.0)
            return max(0.0, 1.0 - (g - 12) / 20.0)

        return (gap_score(g1) + gap_score(g2)) / 2.0
    ok = 0
    if pelvis < thorax:
        ok += 1
    if thorax < arm:
        ok += 1
    if pelvis < arm:
        ok += 1
    return ok / 3.0


def compute_metrics(
    keypoints: np.ndarray,
    events: list[dict],
    fps: float,
    pose_confidence_mean: float,
) -> list[dict[str, Any]]:
    """Return Metric[] matching contract/analysis.schema. Omit unreliable keys."""
    address = _ef(events, "address")
    top = _ef(events, "top")
    impact = _ef(events, "impact")
    finish = _ef(events, "finish")
    if address is None or top is None or impact is None or finish is None:
        return []
    if not (address < top < impact <= finish):
        return []

    conf = float(np.clip(pose_confidence_mean, 0.35, 0.95))
    out: list[dict[str, Any]] = []

    back = top - address
    down = impact - top
    if down > 0:
        out.append(_metric("tempo_ratio", back / down, conf))
        out.append(_metric("backswing_duration_ms", (back / fps) * 1000.0, conf))

    ls_a, rs_a = _xy(keypoints, address, L_SHOULDER), _xy(keypoints, address, R_SHOULDER)
    ls_t, rs_t = _xy(keypoints, top, L_SHOULDER), _xy(keypoints, top, R_SHOULDER)
    if all(p is not None for p in (ls_a, rs_a, ls_t, rs_t)):
        st = abs(_inclination(ls_t, rs_t) - _inclination(ls_a, rs_a))  # type: ignore[arg-type]
        out.append(_metric("shoulder_turn_top", st, conf))
        out.append(_metric("shoulder_plane_top", abs(_inclination(ls_t, rs_t)), conf))  # type: ignore[arg-type]

    lh_a, rh_a = _xy(keypoints, address, L_HIP), _xy(keypoints, address, R_HIP)
    lh_t, rh_t = _xy(keypoints, top, L_HIP), _xy(keypoints, top, R_HIP)
    if all(p is not None for p in (lh_a, rh_a, lh_t, rh_t)):
        ht = abs(_inclination(lh_t, rh_t) - _inclination(lh_a, rh_a))  # type: ignore[arg-type]
        out.append(_metric("hip_turn_top", ht, conf))

    keys = {m["key"]: m["value"] for m in out}
    if "shoulder_turn_top" in keys and "hip_turn_top" in keys:
        out.append(
            _metric(
                "x_factor_top",
                keys["shoulder_turn_top"] - keys["hip_turn_top"],
                conf,
            )
        )

    mh_a = _mid(lh_a, rh_a)
    ms_a = _mid(ls_a, rs_a)
    if mh_a is not None and ms_a is not None:
        out.append(_metric("spine_angle_address", abs(_angle_from_vertical(mh_a, ms_a)), conf))

    mh_i = _mid(_xy(keypoints, impact, L_HIP), _xy(keypoints, impact, R_HIP))
    ms_i = _mid(_xy(keypoints, impact, L_SHOULDER), _xy(keypoints, impact, R_SHOULDER))
    if mh_a is not None and ms_a is not None and mh_i is not None and ms_i is not None:
        a = abs(_angle_from_vertical(mh_a, ms_a))
        i = abs(_angle_from_vertical(mh_i, ms_i))
        out.append(_metric("spine_angle_change", abs(i - a), conf))

    mh_t = _mid(lh_t, rh_t)
    ms_t = _mid(ls_t, rs_t)
    if mh_t is not None and ms_t is not None:
        out.append(_metric("spine_tilt_top", _angle_from_vertical(mh_t, ms_t), conf * 0.9))

    hw = _hip_w(keypoints, address)
    if hw and mh_a is not None and mh_i is not None:
        dy = mh_i[1] - mh_a[1]
        out.append(_metric("hip_depth_change_downswing", max(0.0, dy / hw), conf))

    if hw and mh_a is not None and mh_t is not None:
        out.append(
            _metric("hip_lateral_backswing", abs(mh_t[0] - mh_a[0]) / hw, conf)
        )

    if hw and mh_a is not None and mh_i is not None:
        out.append(
            _metric("hip_lateral_downswing", abs(mh_i[0] - mh_a[0]) / hw, conf)
        )

    sw = _shoulder_w(keypoints, address)
    nose0 = _xy(keypoints, address, NOSE)
    if sw and nose0 is not None:
        max_d = 0.0
        for t in range(address, finish + 1):
            n = _xy(keypoints, t, NOSE)
            if n is None:
                continue
            max_d = max(max_d, float(np.linalg.norm(n - nose0)))
        out.append(_metric("head_movement", max_d / sw, conf))

    def lead_arm(t: int) -> Optional[float]:
        for s, e, w in (
            (L_SHOULDER, L_ELBOW, L_WRIST),
            (R_SHOULDER, R_ELBOW, R_WRIST),
        ):
            a, b, c = _xy(keypoints, t, s), _xy(keypoints, t, e), _xy(keypoints, t, w)
            if a is not None and b is not None and c is not None:
                ang = _joint_angle(a, b, c)
                if not np.isnan(ang):
                    return ang
        return None

    lat = lead_arm(top)
    if lat is not None:
        out.append(_metric("lead_arm_angle_top", lat, conf))
    lai = lead_arm(impact)
    if lai is not None:
        out.append(_metric("lead_arm_angle_impact", lai, conf))

    peaks = _kinematic_peaks(keypoints, top, impact)
    if peaks:
        out.append(_metric("kinematic_sequence_index", _sequence_index(*peaks), conf * 0.85))

    stance = _stance_w(keypoints, address)
    mh_f = _mid(_xy(keypoints, finish, L_HIP), _xy(keypoints, finish, R_HIP))
    la = _xy(keypoints, address, L_ANKLE)
    if stance and mh_f is not None and la is not None:
        val = (mh_f[0] - la[0]) / stance
        out.append(_metric("weight_forward_finish", min(1.0, max(0.0, val)), conf * 0.8))

    return out
