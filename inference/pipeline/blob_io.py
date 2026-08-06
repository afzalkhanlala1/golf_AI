"""Upload gzipped keypoints JSON to Vercel Blob."""

from __future__ import annotations

import gzip
import json
import os
from typing import Any

import httpx
import numpy as np


"""Payload version. 2.0 adds `world` (metric 3D) and `tracer` (clubhead
path). `frames` is byte-for-byte the same shape it was at 1.0, so a client
written against 1.0 keeps working and simply won't offer 3D playback."""
KEYPOINTS_SCHEMA_VERSION = "2.0"


def keypoints_payload(
    keypoints: np.ndarray,
    *,
    fps: float,
    width: int,
    height: int,
    swing_id: str,
    world: np.ndarray | None = None,
    tracer: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    # Rounded before serialising: this file is fetched by the browser on
    # every result view, and full float64 repr roughly doubles it for
    # precision no consumer uses. 2dp in image space is sub-pixel; 4dp in
    # world space is a tenth of a millimetre.
    frames = np.round(keypoints.astype(float), 2).tolist()

    payload: dict[str, Any] = {
        "schemaVersion": KEYPOINTS_SCHEMA_VERSION,
        "swingId": swing_id,
        "fps": fps,
        "width": width,
        "height": height,
        "frameCount": int(keypoints.shape[0]),
        "frames": frames,
        # T × 21 × [x, y, z, visibility] in metres, hip-origin. None on
        # backends with no 3D head — the player checks for it rather than
        # assuming it is there.
        "world": (
            np.round(world.astype(float), 4).tolist() if world is not None else None
        ),
        # Clubhead path in image space, one entry per tracked frame.
        "tracer": tracer,
    }
    return payload


def upload_keypoints_gzip(
    payload: dict[str, Any],
    *,
    swing_id: str,
    token: str | None = None,
) -> str:
    token = token or os.environ.get("BLOB_READ_WRITE_TOKEN", "")
    if not token:
        raise RuntimeError("BLOB_READ_WRITE_TOKEN is required to store keypoints")

    raw = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    gz = gzip.compress(raw, compresslevel=6)
    pathname = f"keypoints/{swing_id}.json.gz"

    # Vercel Blob REST put
    url = f"https://blob.vercel-storage.com/{pathname}"
    with httpx.Client(timeout=120.0) as client:
        res = client.put(
            url,
            content=gz,
            headers={
                "Authorization": f"Bearer {token}",
                "x-api-version": "7",
                "x-content-type": "application/gzip",
                "x-add-random-suffix": "false",
            },
        )
        if res.status_code >= 400:
            raise RuntimeError(f"Blob upload failed: {res.status_code} {res.text}")
        data = res.json()
        blob_url = data.get("url")
        if not blob_url:
            raise RuntimeError(f"Blob upload missing url: {data}")
        return str(blob_url)
