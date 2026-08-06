/**
 * Deciding when the Live Coach should make a sound.
 *
 * Separated from the speech and audio APIs so the timing rules can be
 * tested, and because the rules are the hard part — the speaking itself is
 * three lines of browser API.
 *
 * ## Why this needs rules at all
 *
 * The checks re-evaluate every animation frame, roughly 30 times a second.
 * Speaking the cue whenever it is non-empty would produce an unbroken
 * stream of overlapping speech that is useless to stand over a ball to.
 * Three constraints shape it:
 *
 * 1. **Say a thing when it changes.** A new cue is news; the same cue
 *    repeated a hundred milliseconds later is not.
 * 2. **Do not nag.** Someone adjusting their posture needs a few seconds of
 *    silence to actually adjust. Repeating the same cue is allowed, but on
 *    a much longer interval than a change.
 * 3. **Confirm success once.** The moment everything comes good is worth a
 *    chime — it is the "you can swing now" signal, and it is the only
 *    moment the golfer is waiting for. Chiming repeatedly while they hold a
 *    good position would turn a reward into an irritation.
 *
 * Timing is passed in rather than read from a clock so the rules are
 * deterministic under test.
 */

export type AnnouncerState = {
  lastCue: string | null;
  lastSpokenAt: number;
  wasAllGood: boolean;
};

export const INITIAL_ANNOUNCER: AnnouncerState = {
  lastCue: null,
  lastSpokenAt: -Infinity,
  wasAllGood: false,
};

/** A changed cue still waits this long, so back-to-back changes don't stack. */
export const MIN_GAP_MS = 1800;

/** An unchanged cue repeats only this often — time to actually adjust. */
export const REPEAT_GAP_MS = 6500;

export type Announcement = {
  /** Text to speak, or null for silence. */
  speak: string | null;
  /** Rising tone: setup just came good. */
  chime: boolean;
  /** Haptic pulse, same moment as the chime. */
  vibrate: boolean;
  next: AnnouncerState;
};

export function decideAnnouncement(
  state: AnnouncerState,
  cue: string | null,
  allGood: boolean,
  now: number,
): Announcement {
  const becameGood = allGood && !state.wasAllGood;
  const base = { ...state, wasAllGood: allGood };

  // The success chime replaces speech rather than layering under it — two
  // sounds at the same instant read as a glitch.
  if (becameGood) {
    return {
      speak: null,
      chime: true,
      vibrate: true,
      next: { ...base, lastCue: cue, lastSpokenAt: now },
    };
  }

  if (!cue || allGood) {
    return { speak: null, chime: false, vibrate: false, next: base };
  }

  const changed = cue !== state.lastCue;
  const elapsed = now - state.lastSpokenAt;
  const due = changed ? elapsed >= MIN_GAP_MS : elapsed >= REPEAT_GAP_MS;

  if (!due) {
    return { speak: null, chime: false, vibrate: false, next: base };
  }

  return {
    speak: cue,
    chime: false,
    vibrate: false,
    next: { ...base, lastCue: cue, lastSpokenAt: now },
  };
}
