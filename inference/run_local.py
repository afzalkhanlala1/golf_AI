"""
Run the full analysis pipeline on a local file, no Modal, no blob storage.

    cd inference
    MEDIAPIPE_POSE_MODEL=models/pose_landmarker_full.task \
        python run_local.py "../Test vedio 1.mp4"

Exists so the pipeline can be exercised end-to-end without spending GPU
credits or waiting on a deploy — the pose backend runs on CPU.
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

os.environ.setdefault(
    "MEDIAPIPE_POSE_MODEL", str(Path(__file__).parent / "models" / "pose_landmarker_full.task")
)

from pipeline.analyze import analyze_swing  # noqa: E402


def main() -> None:
    if len(sys.argv) < 2:
        print("usage: python run_local.py <video> [view]")
        raise SystemExit(2)

    path = Path(sys.argv[1]).resolve()
    view = sys.argv[2] if len(sys.argv) > 2 else "unknown"
    if not path.exists():
        print(f"no such file: {path}")
        raise SystemExit(2)

    result = analyze_swing(
        swing_id="00000000-0000-4000-8000-000000000001",
        blob_url=path.as_uri(),
        claimed_view=view,
        upload_keypoints=False,
    )

    out = Path(__file__).parent / "local_result.json"
    out.write_text(json.dumps(result, indent=2), encoding="utf-8")

    c, q = result["capture"], result["quality"]
    print(f"backend      : {os.environ.get('POSE_BACKEND', 'mediapipe')}")
    print(f"status       : {result['status']}")
    if result["rejectionReason"]:
        print(f"reason       : {result['rejectionReason']}")
    print(
        f"capture      : {c['width']}x{c['height']} @ {c['fps']:.2f}fps, "
        f"{c['frameCount']} frames, view={c['view']}"
    )
    print(
        f"quality      : poseConf={q['poseConfidenceMean']:.3f} "
        f"fullBody={q['fullBodyInFrame']} warnings={q['warnings']}"
    )
    if result["events"]:
        print("events       :", {e["event"]: e["frame"] for e in result["events"]})
    print(f"metrics      : {len(result['metrics'])}")
    limbs = result.get("limbs", [])
    scorable = [l for l in limbs if l["scorable"]]
    print(f"limbs        : {len(scorable)}/{len(limbs)} scorable")
    print(f"\nwrote {out}")


if __name__ == "__main__":
    main()
