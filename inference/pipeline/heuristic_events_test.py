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


def test_clip_ending_mid_follow_through() -> None:
    """A clip trimmed right after impact has no settled finish. The
    follow-through must still span real frames, not collapse to impact+1."""
    T, fps = 200, 30.0
    kpts = np.zeros((T, 17, 3), dtype=np.float32)
    kpts[:, :, 2] = 0.9

    y = np.zeros(T)
    y[0:60] = 400.0                                   # long, still address
    for i, f in enumerate(range(60, 120)):            # backswing
        y[f] = 400 - 250 * (i / 59)
    for i, f in enumerate(range(120, 150)):           # downswing to impact
        y[f] = 150 + 260 * ((i / 29) ** 2)
    for i, f in enumerate(range(150, T)):             # still moving at cutoff
        y[f] = 410 - 300 * (i / (T - 151))

    kpts[:, 9, 1] = y
    kpts[:, 10, 1] = y
    kpts[:, 9, 0] = 300.0
    kpts[:, 10, 0] = 300.0

    events = detect_events_heuristic(kpts, fps)
    by = {e["event"]: e["frame"] for e in events}
    assert by["impact"] < by["finish"], by
    span = by["finish"] - by["impact"]
    assert span > 5, f"follow-through collapsed to {span} frame(s): {by}"
    frames = [e["frame"] for e in events]
    assert frames == sorted(frames), frames
    print("mid-follow-through clip ok:", by)


if __name__ == "__main__":
    test_clip_ending_mid_follow_through()


def test_long_static_setup_gives_plausible_tempo() -> None:
    """A clip that opens with a long static setup must not report the whole
    clip as the backswing. Regression for GolfDB 2.mp4 (tempo_ratio 13.9)."""
    T, fps = 225, 30.0
    y = np.zeros(T)
    y[0:150] = 400.0
    for i, f in enumerate(range(150, 172)):
        y[f] = 400 - 250 * (i / 21)
    for i, f in enumerate(range(172, 182)):
        y[f] = 150 + 260 * ((i / 9) ** 2)
    for i, f in enumerate(range(182, T)):
        y[f] = 410 - 320 * (i / (T - 183))

    k = np.zeros((T, 17, 3), dtype=np.float32)
    k[:, :, 2] = 0.9
    k[:, 9, 1] = y
    k[:, 10, 1] = y
    k[:, 9, 0] = 300.0
    k[:, 10, 0] = 300.0

    by = {e["event"]: e["frame"] for e in detect_events_heuristic(k, fps)}
    tempo = (by["top"] - by["address"]) / max(1, by["impact"] - by["top"])
    assert by["address"] > 100, by
    assert (by["top"] - by["address"]) / fps < 2.0, by
    assert 1.5 < tempo < 6.0, f"tempo {tempo}: {by}"
    print("long-static-setup ok:", by, "tempo %.2f" % tempo)
