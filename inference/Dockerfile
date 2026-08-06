# Golf AI inference — AWS Lambda container image.
#
# CPU only, on purpose. The default pose backend (MediaPipe) never uses a
# GPU, which is what makes Lambda viable at all: no GPU instance to keep
# warm, scale-to-zero between swings, and billing per millisecond of actual
# analysis. A clip takes roughly 45-90s, well inside Lambda's 15-minute
# ceiling.
FROM public.ecr.aws/lambda/python:3.11

# ffmpeg for decoding (PyAV links against it) and the GL/GLib shared objects
# OpenCV needs even in headless builds.
RUN dnf install -y tar xz findutils && \
    dnf install -y mesa-libGL glib2 && \
    dnf clean all

# Static ffmpeg build — the distro packages lag badly and PyAV wants a
# recent libav.
RUN curl -sSL -o /tmp/ffmpeg.tar.xz \
      https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz && \
    mkdir -p /tmp/ffmpeg && \
    tar -xJf /tmp/ffmpeg.tar.xz -C /tmp/ffmpeg --strip-components=1 && \
    cp /tmp/ffmpeg/ffmpeg /tmp/ffmpeg/ffprobe /usr/local/bin/ && \
    rm -rf /tmp/ffmpeg /tmp/ffmpeg.tar.xz

COPY requirements-aws.txt ${LAMBDA_TASK_ROOT}/
RUN pip install --no-cache-dir -r ${LAMBDA_TASK_ROOT}/requirements-aws.txt

# Bake the pose model in so a cold start never pays for a download.
RUN mkdir -p ${LAMBDA_TASK_ROOT}/models && \
    curl -sSL -o ${LAMBDA_TASK_ROOT}/models/pose_landmarker_full.task \
      https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task

ENV MEDIAPIPE_POSE_MODEL=${LAMBDA_TASK_ROOT}/models/pose_landmarker_full.task
ENV POSE_BACKEND=mediapipe
# MediaPipe/TFLite writes scratch files; /tmp is the only writable path.
ENV HOME=/tmp
ENV XDG_CACHE_HOME=/tmp

COPY pipeline/ ${LAMBDA_TASK_ROOT}/pipeline/
COPY lambda_handler.py ${LAMBDA_TASK_ROOT}/

CMD ["lambda_handler.handler"]
