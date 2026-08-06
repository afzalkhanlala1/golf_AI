# Golf AI inference (Modal)

GPU service that decodes a swing clip, runs RTMPose, detects 8 GolfDB events (heuristic by default; optional SwingNet), computes scale-invariant metrics, uploads gzipped keypoints to Vercel Blob, and POSTs an HMAC-signed `AnalysisResult` to the Next.js callback.

Scoring and TPI faults stay in TypeScript (`src/lib/scoring/`).

## Pipeline

1. **Decode** — `ffprobe` true fps; reject &lt;1s / &gt;20s; max 1080p long edge; reject &lt;24fps outright, warn + damp confidence 24–120fps; correct phone display-matrix rotation (`pipeline/orientation.py`)
2. **Pose** — RTMDet + RTMPose (COCO-17) via `rtmlib` / ONNX Runtime; largest person; `multiple_people` warning; reject clips with no real swing motion (`no_swing_detected`)
3. **Events** — heuristic wrist kinematics first (impact bounded by hands returning to address height, not unbounded peak speed — see `events.py` docstring); if `SWINGNET_CHECKPOINT_URL` is set, try SwingNet then fall back
4. **View** — face-on / down-the-line / unknown (+ `view_ambiguous`)
5. **Metrics** — SPEC §7.2 keys only (no faults)
6. **Keypoints** — gzip JSON → Vercel Blob
7. **Callback** — `POST {callbackUrl}` with header `X-Signature: hex(HMAC-SHA256(body, INFERENCE_SHARED_SECRET))`

## Prerequisites

- [Modal](https://modal.com) account + CLI: `pip install modal && modal setup`
- Vercel Blob token (same `BLOB_READ_WRITE_TOKEN` as the web app)
- Shared secret matching Vercel `INFERENCE_SHARED_SECRET`

## Deploy

From this directory (`inference/`):

```bash
# One-time: create the Modal secret (values must match Vercel)
modal secret create golf-ai-inference \
  INFERENCE_SHARED_SECRET="your-long-random-secret" \
  BLOB_READ_WRITE_TOKEN="vercel_blob_rw_..." \
  SWINGNET_CHECKPOINT_URL=""   # optional; leave empty for heuristic events

modal deploy app.py
```

Modal prints a URL like:

`https://<workspace>--golf-ai-inference-inferenceservice-fastapi.modal.run`

## Wire the web app

On Vercel (Production + Preview):

| Variable | Value |
|---|---|
| `INFERENCE_MODE` | `modal` |
| `INFERENCE_URL` | the Modal URL above (no trailing slash) |
| `INFERENCE_SHARED_SECRET` | same as Modal secret |
| `BLOB_READ_WRITE_TOKEN` | unchanged |
| `NEXT_PUBLIC_APP_URL` | your deployed app origin (callback base) |

Redeploy the Next.js app after changing env vars.

Keep `INFERENCE_MODE=mock` locally until Modal is up.

## Smoke test

With Modal deployed and env set in the repo root `.env.local`:

```bash
# required
INFERENCE_URL=https://...modal.run
INFERENCE_SHARED_SECRET=...
# optional sample (must be publicly fetchable; prefer ≥120fps swing clip)
SMOKE_VIDEO_URL=https://...

pnpm inference:smoke
```

The script calls `POST /analyze/sync` and validates the body against `contract/analysis.schema.json`.

For a local CPU dry-run (slow, needs ffmpeg + Python deps):

```bash
cd inference
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
export INFERENCE_SHARED_SECRET=dev-secret
export BLOB_READ_WRITE_TOKEN=...   # or SKIP_BLOB_UPLOAD=1 (keypointsUrl will be null → schema may fail URL check)
export SKIP_BLOB_UPLOAD=1
uvicorn app:local_app --port 8000
```

Note: with `SKIP_BLOB_UPLOAD=1`, `keypointsUrl` is null (allowed by the schema).

## API

### `GET /health`

```json
{ "ok": true, "service": "golf-ai-inference" }
```

### `POST /analyze` → 202

Headers: `X-Inference-Secret: <secret>`

```json
{
  "swingId": "<uuid>",
  "blobUrl": "https://...",
  "view": "face_on",
  "club": null,
  "callbackUrl": "https://your.app/api/swings/<uuid>/callback"
}
```

Spawns GPU work; result is delivered via signed callback.

### `POST /analyze/sync`

Same body (callback optional). Blocks until `AnalysisResult` is ready. Used by `pnpm inference:smoke`.

## Checkpoint D

After deploy + env flip, upload a real slow-motion swing in the app and confirm status goes `QUEUED → PROCESSING → COMPLETE` with metrics, faults, and feedback.

## Deploying to AWS Lambda (alternative to Modal)

The service also runs on Lambda as a container image. Viable because the
default MediaPipe backend is CPU-only — no GPU instance, scale-to-zero
between swings, billed per millisecond of actual analysis.

The HTTP contract is identical to the Modal deployment, so the web app needs
no change beyond pointing `INFERENCE_URL` at the Function URL.

### Credentials

**Never paste an access key into a chat, a commit, or a command argument.**
Configure it once, locally:

```bash
aws configure          # prompts for key, secret, region — stored in ~/.aws
```

or export for the current shell only:

```bash
export AWS_ACCESS_KEY_ID=...
export AWS_SECRET_ACCESS_KEY=...
export AWS_DEFAULT_REGION=us-east-1
```

`deploy-aws.sh` reads whichever of those is present. It never accepts a key
as an argument, so nothing secret lands in your shell history.

Use a dedicated IAM user, not root: create one, attach `aws-iam-policy.json`
(replace `ACCOUNT_ID` and `REGION`), and generate its access key.

### Deploy

```bash
cd inference && ./deploy-aws.sh
```

Idempotent — re-run it to ship an update. It creates the ECR repo, builds
and pushes the image, creates the execution role, creates or updates the
function, and prints the Function URL.

Then set `INFERENCE_URL` to that URL in Vercel and in `.env.local`. Leave
`INFERENCE_MODE=modal`; it selects the HTTP client, which is the same for
both platforms.

### How it stays async

Analysis takes 45–90s but the caller expects an immediate 202. A Lambda
cannot respond and keep working, so `/analyze` re-invokes the same function
asynchronously with the job payload and returns 202; the async copy runs the
pipeline and posts the HMAC-signed callback. That is why the execution role
grants `lambda:InvokeFunction` on its own ARN.

### Notes

- `requirements-aws.txt` omits torch/rtmlib/onnxruntime — they exist only
  for the optional RTMPose backend and would add >1GB to the image. To run
  `POSE_BACKEND=rtmpose` on AWS, add them back and expect slower cold starts.
- Memory is 3008MB: on Lambda, CPU scales with memory, so this is a speed
  setting as much as a memory one.
- First request after idle pays a cold start (image pull + model load).
