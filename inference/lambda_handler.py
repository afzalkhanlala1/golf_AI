"""
AWS Lambda entry point for the inference service.

Preserves the exact HTTP contract the Modal service exposed, so the web app
needs no change beyond pointing INFERENCE_URL at the Function URL:

    GET  /health        -> liveness
    POST /analyze       -> 202 Accepted, work continues in the background
    POST /analyze/sync  -> blocking, returns the AnalysisResult (smoke tests)

## Why the function invokes itself

Analysis takes 45-90s, but the caller expects an immediate 202 — Next.js
fires the request and the GPU service calls back later. A Lambda cannot
return a response and keep working, so /analyze re-invokes this same
function asynchronously (InvocationType="Event") with a job payload, then
returns 202 straight away. The async copy runs the pipeline and posts the
HMAC-signed callback. One function, one image, and the caller's contract is
unchanged.

The self-invoke needs lambda:InvokeFunction on its own ARN — see
aws-iam-policy.json.
"""

from __future__ import annotations

import json
import os
import traceback
from typing import Any, Optional

EVENT_JOB_MARKER = "__golfai_job__"


def _response(status: int, body: dict[str, Any]) -> dict[str, Any]:
    return {
        "statusCode": status,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps(body),
    }


def _failure_payload(swing_id: str, view: str, message: str) -> dict[str, Any]:
    return {
        "schemaVersion": "1.0",
        "swingId": swing_id,
        "status": "REJECTED",
        "rejectionReason": message,
        "capture": {
            "fps": 0,
            "width": 0,
            "height": 0,
            "frameCount": 0,
            "durationMs": 0,
            "view": view,
        },
        "quality": {
            "poseConfidenceMean": 0,
            "fpsAdequate": False,
            "fullBodyInFrame": False,
            "warnings": [],
        },
        "events": [],
        "metrics": [],
        "limbs": [],
        "faults": [],
        "keypointsUrl": None,
    }


def _check_secret(headers: dict[str, str]) -> Optional[dict[str, Any]]:
    expected = os.environ.get("INFERENCE_SHARED_SECRET", "")
    # Lambda lowercases header names in the Function URL event.
    supplied = headers.get("x-inference-secret") or headers.get(
        "X-Inference-Secret", ""
    )
    if not expected or not supplied or supplied != expected:
        return _response(401, {"error": "Unauthorized"})
    return None


def _run_job(payload: dict[str, Any]) -> dict[str, Any]:
    from pipeline.analyze import analyze_swing
    from pipeline.callback import post_callback

    swing_id = payload["swingId"]
    view = payload.get("view", "unknown")
    try:
        result = analyze_swing(
            swing_id=swing_id,
            blob_url=payload["blobUrl"],
            claimed_view=view,
            upload_keypoints=True,
        )
    except Exception:
        traceback.print_exc()
        result = _failure_payload(
            swing_id, view, "Inference pipeline failed. Please try another clip."
        )

    callback_url = payload.get("callbackUrl")
    if callback_url:
        try:
            post_callback(callback_url, result)
        except Exception:
            traceback.print_exc()
    return result


def _spawn(payload: dict[str, Any]) -> None:
    """Re-invoke this function asynchronously to do the slow work."""
    import boto3

    boto3.client("lambda").invoke(
        FunctionName=os.environ["AWS_LAMBDA_FUNCTION_NAME"],
        InvocationType="Event",
        Payload=json.dumps({EVENT_JOB_MARKER: True, **payload}).encode("utf-8"),
    )


def handler(event: dict[str, Any], context: Any) -> Any:
    # Async self-invocation: this is the worker pass.
    if event.get(EVENT_JOB_MARKER):
        return _run_job(event)

    ctx = event.get("requestContext") or {}
    http = ctx.get("http") or {}
    method = (http.get("method") or "GET").upper()
    path = http.get("path") or "/"
    headers = {k.lower(): v for k, v in (event.get("headers") or {}).items()}

    if path.rstrip("/").endswith("/health") or path == "/":
        return _response(
            200,
            {
                "ok": True,
                "service": "golf-ai-inference",
                "platform": "aws-lambda",
                "backend": os.environ.get("POSE_BACKEND", "mediapipe"),
                "secretConfigured": bool(os.environ.get("INFERENCE_SHARED_SECRET")),
            },
        )

    if method != "POST":
        return _response(405, {"error": "Method not allowed"})

    unauthorized = _check_secret(headers)
    if unauthorized:
        return unauthorized

    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return _response(400, {"error": "Invalid JSON body"})

    if not body.get("swingId") or not body.get("blobUrl"):
        return _response(400, {"error": "swingId and blobUrl are required"})

    payload = {
        "swingId": body["swingId"],
        "blobUrl": body["blobUrl"],
        "view": body.get("view", "unknown"),
        "callbackUrl": body.get("callbackUrl"),
    }

    if path.rstrip("/").endswith("/analyze/sync"):
        return _response(200, _run_job(payload))

    if not payload["callbackUrl"]:
        return _response(400, {"error": "callbackUrl is required for async /analyze"})

    try:
        _spawn(payload)
    except Exception:
        traceback.print_exc()
        return _response(500, {"error": "Could not queue analysis"})

    return _response(202, {"accepted": True, "swingId": payload["swingId"]})
