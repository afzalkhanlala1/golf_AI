"""Lightweight self-check for heuristic event ordering (no GPU)."""

from __future__ import annotations

import numpy as np

from pipeline.events import detect_events_heuristic


def main() -> None:
    T, fps = 200, 240.0
    kpts = np.zeros((T, 17, 3), dtype=np.float32)
    kpts[:, :, 2] = 0.9
    # Synthetic wrist path: rise then fall then settle
    t = np.arange(T)
    y = 400 - 200 * np.sin(np.pi * t / 120).clip(0)
    y[120:] = 400 + 40 * np.sin(np.pi * (t[120:] - 120) / 80)
    x = 300 + 0.2 * t
    kpts[:, 10, 0] = x
    kpts[:, 10, 1] = y
    kpts[:, 9, 0] = x
    kpts[:, 9, 1] = y

    events = detect_events_heuristic(kpts, fps)
    assert len(events) == 8
    frames = [e["frame"] for e in events]
    assert frames == sorted(frames), frames
    names = [e["event"] for e in events]
    assert names[0] == "address" and names[-1] == "finish"
    print("heuristic events ok:", list(zip(names, frames)))


if __name__ == "__main__":
    main()
