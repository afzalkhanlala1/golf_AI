"""HMAC-SHA256 signed callback to the Next.js API."""

from __future__ import annotations

import hashlib
import hmac
import json
import os
from typing import Any

import httpx


def sign_body(raw: bytes, secret: str) -> str:
    return hmac.new(secret.encode("utf-8"), raw, hashlib.sha256).hexdigest()


def post_callback(callback_url: str, result: dict[str, Any]) -> None:
    secret = os.environ.get("INFERENCE_SHARED_SECRET", "")
    if not secret:
        raise RuntimeError("INFERENCE_SHARED_SECRET is required for callbacks")

    raw = json.dumps(result, separators=(",", ":")).encode("utf-8")
    signature = sign_body(raw, secret)

    with httpx.Client(timeout=60.0) as client:
        res = client.post(
            callback_url,
            content=raw,
            headers={
                "Content-Type": "application/json",
                "X-Signature": signature,
            },
        )
        if res.status_code >= 400:
            raise RuntimeError(
                f"Callback failed: {res.status_code} {res.text[:1500]}"
            )
