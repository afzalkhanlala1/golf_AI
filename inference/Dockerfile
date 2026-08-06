# Golf AI inference — AWS Lambda container image.
#
# CPU only, on purpose. The default pose backend (MediaPipe) never uses a
# GPU, which is what makes Lambda viable at all: no GPU instance to keep
# warm, scale-to-zero between swings, and billing per millisecond of actual
# analysis. A clip takes roughly 45-90s, well inside Lambda's 15-minute
# ceiling.
FROM public.ecr.aws/lambda/python:3.11

# ffmpeg for decoding (PyAV links against it) and the GL/GLib shared objects
# OpenCV needs even in headless builds. This base image is Amazon Linux 2
# (yum), not AL2023 (dnf) — confirmed against /etc/os-release, don't assume.
RUN yum install -y tar xz findutils mesa-libGL glib2 && \
    yum clean all

# curl flags shared by every download in this file: fail fast on a stalled
# connection and retry instead of hanging. A bare `curl -sSL` with no
# timeout genuinely hung for 2.5+ hours against a stalled connection during
# testing before finally erroring — --max-time bounds the whole request,
# --speed-limit/--speed-time kills a connection that goes idle mid-transfer,
# and --retry covers a transient failure instead of failing the whole build
# on one bad attempt.
ARG CURL_FLAGS="--fail --location --silent --show-error \
  --connect-timeout 15 --max-time 180 \
  --speed-limit 5000 --speed-time 30 \
  --retry 3 --retry-delay 5 --retry-connrefused"

# Static ffmpeg build — the distro packages lag badly and PyAV wants a
# recent libav.
RUN curl $CURL_FLAGS -o /tmp/ffmpeg.tar.xz \
      https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz && \
    mkdir -p /tmp/ffmpeg && \
    tar -xJf /tmp/ffmpeg.tar.xz -C /tmp/ffmpeg --strip-components=1 && \
    cp /tmp/ffmpeg/ffmpeg /tmp/ffmpeg/ffprobe /usr/local/bin/ && \
    rm -rf /tmp/ffmpeg /tmp/ffmpeg.tar.xz

COPY requirements-aws.txt ${LAMBDA_TASK_ROOT}/
# --only-binary forces wheels for every package. Without it, pip picked
# numpy 2.4.6 (no prebuilt wheel yet for this image) and fell back to
# building from source via meson — which fails outright, since this base
# image ships no C compiler. The right fix is refusing the source build,
# not adding a compiler toolchain just to avoid ever compiling anything.
RUN pip install --no-cache-dir --only-binary=:all: --timeout 120 --retries 5 \
      -r ${LAMBDA_TASK_ROOT}/requirements-aws.txt

# Bake the pose model in so a cold start never pays for a download. Its own
# --max-time is longer (a ~9MB file, but on a slow link) — the shared
# CURL_FLAGS default is sized for small downloads.
RUN mkdir -p ${LAMBDA_TASK_ROOT}/models && \
    curl $CURL_FLAGS --max-time 300 \
      -o ${LAMBDA_TASK_ROOT}/models/pose_landmarker_full.task \
      https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task

ENV MEDIAPIPE_POSE_MODEL=${LAMBDA_TASK_ROOT}/models/pose_landmarker_full.task
ENV POSE_BACKEND=mediapipe
# MediaPipe/TFLite writes scratch files; /tmp is the only writable path.
ENV HOME=/tmp
ENV XDG_CACHE_HOME=/tmp

COPY pipeline/ ${LAMBDA_TASK_ROOT}/pipeline/
COPY lambda_handler.py ${LAMBDA_TASK_ROOT}/

CMD ["lambda_handler.handler"]
