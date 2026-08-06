import { describe, expect, it } from "vitest";
import {
  INITIAL_ANNOUNCER,
  MIN_GAP_MS,
  REPEAT_GAP_MS,
  decideAnnouncement,
  type AnnouncerState,
} from "./announcer";

describe("decideAnnouncement", () => {
  it("speaks the first cue immediately", () => {
    const r = decideAnnouncement(INITIAL_ANNOUNCER, "Bend more from the hips", false, 1000);
    expect(r.speak).toBe("Bend more from the hips");
  });

  it("does not repeat the same cue on the next animation frame", () => {
    // The checks re-run ~30x a second; without this the coach talks over
    // itself continuously.
    let s: AnnouncerState = INITIAL_ANNOUNCER;
    let spoken = 0;
    for (let t = 0; t < 1000; t += 33) {
      const r = decideAnnouncement(s, "Soften your knees", false, t);
      if (r.speak) spoken++;
      s = r.next;
    }
    expect(spoken).toBe(1);
  });

  it("repeats an unchanged cue only after the long gap", () => {
    const s = decideAnnouncement(INITIAL_ANNOUNCER, "Widen your stance", false, 0).next;
    expect(decideAnnouncement(s, "Widen your stance", false, REPEAT_GAP_MS - 1).speak).toBeNull();
    const r = decideAnnouncement(s, "Widen your stance", false, REPEAT_GAP_MS);
    expect(r.speak).toBe("Widen your stance");
  });

  it("waits out the short gap even when the cue changes", () => {
    const s = decideAnnouncement(INITIAL_ANNOUNCER, "First cue", false, 0).next;
    expect(decideAnnouncement(s, "Second cue", false, MIN_GAP_MS - 1).speak).toBeNull();
    expect(decideAnnouncement(s, "Second cue", false, MIN_GAP_MS).speak).toBe("Second cue");
  });

  it("chimes once when setup comes good, then stays quiet", () => {
    let s = decideAnnouncement(INITIAL_ANNOUNCER, "Bend more", false, 0).next;

    const good = decideAnnouncement(s, null, true, 3000);
    expect(good.chime).toBe(true);
    expect(good.vibrate).toBe(true);
    s = good.next;

    // Holding the good position must not chime again.
    for (let t = 3100; t < 20000; t += 100) {
      const r = decideAnnouncement(s, null, true, t);
      expect(r.chime).toBe(false);
      s = r.next;
    }
  });

  it("chimes again after setup breaks and is recovered", () => {
    let s = decideAnnouncement(INITIAL_ANNOUNCER, null, true, 0).next;
    s = decideAnnouncement(s, "Bend more", false, 5000).next;
    expect(decideAnnouncement(s, null, true, 10000).chime).toBe(true);
  });

  it("never speaks a cue while everything is good", () => {
    const s = decideAnnouncement(INITIAL_ANNOUNCER, null, true, 0).next;
    expect(decideAnnouncement(s, "Bend more", true, 60000).speak).toBeNull();
  });

  it("stays silent when there is no cue", () => {
    const r = decideAnnouncement(INITIAL_ANNOUNCER, null, false, 5000);
    expect(r.speak).toBeNull();
    expect(r.chime).toBe(false);
  });
});
