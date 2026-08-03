"""Upload gzipped keypoints JSON to Vercel Blob."""

from __future__ import annotations

import gzip
import json
import os
from typing import Any

import httpx
import numpy as np


def keypoints_payload(
    keypoints: np.ndarray,
    *,
    fps: float,
    width: int,
    height: int,
    swing_id: str,
) -> dict[str, Any]:
    # frames: T × 17 × [x, y, confidence]
    frames = keypoints.astype(float).tolist()
    return {
        "schemaVersion": "1.0",
        "swingId": swing_id,
        "fps": fps,
        "width": width,
        "height": height,
        "frameCount": int(keypoints.shape[0]),
        "frames": frames,
    }


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
