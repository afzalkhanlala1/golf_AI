"""
Golf AI inference — Modal + FastAPI.

Deploy (human operator): see README.md
"""

from __future__ import annotations

import os
import traceback
from typing import Literal, Optional

import modal
from fastapi import BackgroundTasks, FastAPI, Header, HTTPException
from pydantic import BaseModel, HttpUrl

app = modal.App("golf-ai-inference")

inference_image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("ffmpeg", "libgl1", "libglib2.0-0", "curl")
    .pip_install(
        "fastapi>=0.115.0",
        "uvicorn[standard]>=0.32.0",
        "pydantic>=2.9.0",
        "numpy>=1.26.0",
        "opencv-python-headless>=4.10.0",
        "av>=12.0.0",
        "httpx>=0.27.0",
        "onnxruntime-gpu>=1.19.0",
        "rtmlib>=0.0.13",
        # Default pose backend — matches the collaborator's pipeline.
        "mediapipe>=0.10.14",
        "torch>=2.2.0",
        "torchvision>=0.17.0",
        "Pillow>=10.0.0",
    )
    # Bake the pose model into the image so a cold start never pays for a
    # model download. `full` matches the collaborator's production
    # model_complexity=1.
    .run_commands(
        "mkdir -p /root/models",
        "curl -sSL -o /root/models/pose_landmarker_full.task "
        "https://storage.googleapis.com/mediapipe-models/pose_landmarker/"
        "pose_landmarker_full/float16/1/pose_landmarker_full.task",
    )
    .env({"PYTHONPATH": "/root"})
    .add_local_dir(
        local_path="pipeline",
        remote_path="/root/pipeline",
        copy=True,
    )
)

secrets = [modal.Secret.from_name("golf-ai-inference")]


class AnalyzeRequest(BaseModel):
    swingId: str
    blobUrl: HttpUrl
    view: Literal["face_on", "down_the_line", "unknown"] = "unknown"
    club: Optional[str] = None
    callbackUrl: Optional[HttpUrl] = None


class Accepted(BaseModel):
    accepted: bool = True
    swingId: str


def _check_secret(x_inference_secret: Optional[str]) -> None:
    expected = os.environ.get("INFERENCE_SHARED_SECRET", "")
    if not expected or not x_inference_secret or x_inference_secret != expected:
        raise HTTPException(status_code=401, detail="Unauthorized")


def _failure_payload(swing_id: str, view: str, message: str) -> dict:
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


# GPU is opt-in, and off by default.
#
# The default pose backend (MediaPipe) runs on CPU — it never touched the
# T4 this used to reserve unconditionally, so every analysis was paying GPU
# rates for CPU work. Set INFERENCE_GPU=T4 (or any Modal GPU string) only
# if you switch back to POSE_BACKEND=rtmpose, which does use it.
_GPU = os.environ.get("INFERENCE_GPU") or None


@app.cls(
    image=inference_image,
    gpu=_GPU,
    timeout=600,
    memory=4096,
    secrets=secrets,
)
class InferenceService:
    @modal.enter()
    def startup(self) -> None:
        from pipeline.pose import init_pose_model

        # MediaPipe (the default backend) runs on CPU; the device argument
        # only matters if POSE_BACKEND=rtmpose.
        try:
            init_pose_model("cuda")
        except Exception:
            init_pose_model("cpu")

    @modal.method()
    def run_job(
        self,
        swing_id: str,
        blob_url: str,
        view: str,
        callback_url: Optional[str],
    ) -> dict:
        from pipeline.analyze import analyze_swing
        from pipeline.callback import post_callback

        try:
            result = analyze_swing(
                swing_id=swing_id,
                blob_url=blob_url,
                claimed_view=view,
                upload_keypoints=True,
            )
        except Exception:
            traceback.print_exc()
            result = _failure_payload(
                swing_id,
                view,
                "Inference pipeline failed. Please try another clip.",
            )
        if callback_url:
            try:
                post_callback(callback_url, result)
            except Exception:
                traceback.print_exc()
        return result

    @modal.asgi_app()
    def fastapi(self):
        web = FastAPI(title="Golf AI Inference", version="1.0.0")
        service = self

        @web.get("/health")
        def health():
            return {
                "ok": True,
                "service": "golf-ai-inference",
                "secretConfigured": bool(
                    os.environ.get("INFERENCE_SHARED_SECRET")
                ),
            }

        @web.post("/analyze", response_model=Accepted, status_code=202)
        def analyze(
            body: AnalyzeRequest,
            x_inference_secret: Optional[str] = Header(default=None),
        ):
            _check_secret(x_inference_secret)
            if not body.callbackUrl:
                raise HTTPException(
                    status_code=400,
                    detail="callbackUrl is required for async /analyze",
                )
            service.run_job.spawn(
                body.swingId,
                str(body.blobUrl),
                body.view,
                str(body.callbackUrl),
            )
            return Accepted(swingId=body.swingId)

        @web.post("/analyze/sync")
        def analyze_sync(
            body: AnalyzeRequest,
            x_inference_secret: Optional[str] = Header(default=None),
        ):
            """Blocking path for smoke tests / debugging."""
            _check_secret(x_inference_secret)
            return service.run_job.remote(
                body.swingId,
                str(body.blobUrl),
                body.view,
                str(body.callbackUrl) if body.callbackUrl else None,
            )

        return web


# Local uvicorn fallback (CPU): `cd inference && uvicorn app:local_app --port 8000`
local_app = FastAPI(title="Golf AI Inference (local)", version="1.0.0")


@local_app.on_event("startup")
def _local_startup() -> None:
    try:
        from pipeline.pose import init_pose_model

        init_pose_model("cpu")
    except Exception as e:
        print(f"pose model warm-up skipped: {e}")


@local_app.get("/health")
def local_health():
    return {"ok": True, "service": "golf-ai-inference-local"}


@local_app.post("/analyze", status_code=202)
def local_analyze(
    body: AnalyzeRequest,
    background: BackgroundTasks,
    x_inference_secret: Optional[str] = Header(default=None),
):
    _check_secret(x_inference_secret)
    if not body.callbackUrl:
        raise HTTPException(status_code=400, detail="callbackUrl required")

    def job():
        try:
            from pipeline.analyze import analyze_swing
            from pipeline.callback import post_callback

            result = analyze_swing(
                swing_id=body.swingId,
                blob_url=str(body.blobUrl),
                claimed_view=body.view,
            )
            post_callback(str(body.callbackUrl), result)
        except Exception:
            traceback.print_exc()

    background.add_task(job)
    return {"accepted": True, "swingId": body.swingId}


@local_app.post("/analyze/sync")
def local_analyze_sync(
    body: AnalyzeRequest,
    x_inference_secret: Optional[str] = Header(default=None),
):
    _check_secret(x_inference_secret)
    from pipeline.analyze import analyze_swing
    from pipeline.callback import post_callback

    result = analyze_swing(
        swing_id=body.swingId,
        blob_url=str(body.blobUrl),
        claimed_view=body.view,
        upload_keypoints=os.environ.get("SKIP_BLOB_UPLOAD") != "1",
    )
    if body.callbackUrl:
        post_callback(str(body.callbackUrl), result)
    return result
