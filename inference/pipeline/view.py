"""Camera view classification: face_on / down_the_line / unknown."""

from __future__ import annotations

import numpy as np


def classify_view(keypoints: np.ndarray) -> str:
    """
    Heuristic from shoulder/hip breadth vs depth motion.
    face_on: large left-right shoulder separation in image
    down_the_line: smaller lateral shoulder width, more depth-like motion
    """
    if keypoints.shape[0] < 5:
        return "unknown"

    # COCO: L/R shoulder 5/6, L/R hip 11/12
    ls = keypoints[:, 5]
    rs = keypoints[:, 6]
    conf = (ls[:, 2] + rs[:, 2]) / 2
    mask = conf > 0.4
    if mask.sum() < 5:
        return "unknown"

    width = np.abs(ls[mask, 0] - rs[mask, 0])
    mean_w = float(width.mean())
    # Normalize by torso height
    lh = keypoints[:, 11]
    rh = keypoints[:, 12]
    mid_s = (ls[:, 1] + rs[:, 1]) / 2
    mid_h = (lh[:, 1] + rh[:, 1]) / 2
    torso = np.abs(mid_h - mid_s)
    torso_m = float(torso[mask].mean()) + 1e-3
    ratio = mean_w / torso_m

    # Lateral hip drift (more for DTL-ish? actually FO shows more lateral)
    hip_x = (lh[:, 0] + rh[:, 0]) / 2
    hip_range = float(hip_x[mask].max() - hip_x[mask].min()) / torso_m

    if ratio > 0.55:
        return "face_on"
    if ratio < 0.35 and hip_range < 0.8:
        return "down_the_line"
    if 0.35 <= ratio <= 0.55:
        # Ambiguous — prefer claimed view will be handled in TS; mark unknown
        return "unknown"
    return "face_on" if ratio >= 0.45 else "down_the_line"
