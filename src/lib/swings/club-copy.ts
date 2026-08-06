/**
 * Plain-language explanations for a missing speed number.
 *
 * A gap where a number should be reads as a broken product. Every one of
 * these says what happened and, where the golfer can do something about
 * it, what to change next time. The two most common reasons — wrong camera
 * angle and too few frames — are both fixable on the next swing, which is
 * why they lead with the instruction rather than the limitation.
 */

export type ClubSpeedReason =
  | "not_tracked"
  | "not_tracked_at_impact"
  | "needs_face_on"
  | "needs_high_fps"
  | "needs_3d_pose"
  | "implausible_result"
  | "tracking_failed";

export type BallSpeedReason =
  | "needs_120fps"
  | "not_detected"
  | "needs_clubhead_speed";

export const CLUB_SPEED_COPY: Record<
  ClubSpeedReason,
  { headline: string; detail: string; actionable: boolean }
> = {
  needs_face_on: {
    headline: "Film face-on to measure speed",
    detail:
      "A down-the-line camera looks straight down the target line, so the clubhead is moving almost directly at the lens through impact. One camera cannot measure motion along its own axis — the same swing can read 2–3× slow. This is physics, not clip quality.",
    actionable: true,
  },
  needs_high_fps: {
    headline: "Film in slow motion for speed",
    detail:
      "At 30fps a 100mph clubhead travels about 1.5 metres between frames — further than the club is long. There is nothing to track. Your phone's native slow-motion mode (120fps or higher) captures the frames this needs.",
    actionable: true,
  },
  not_tracked: {
    headline: "Couldn't follow the clubhead",
    detail:
      "The club never separated cleanly from the background. A plainer backdrop, more light, and keeping the whole club in frame through the finish all help.",
    actionable: true,
  },
  not_tracked_at_impact: {
    headline: "Lost the club through impact",
    detail:
      "The clubhead was tracked through most of the swing but not across the strike itself, which is the only part speed can be measured from.",
    actionable: true,
  },
  needs_3d_pose: {
    headline: "Re-analyse to enable speed",
    detail:
      "This swing was analysed before 3D body tracking existed. Speed needs it to convert pixels into real distance. Upload the swing again to measure it.",
    actionable: true,
  },
  implausible_result: {
    headline: "Measurement failed a sanity check",
    detail:
      "A number came out, but outside the range a golf swing can physically produce — so it was discarded rather than shown. Usually something else in frame was moving fast enough to be mistaken for the club.",
    actionable: false,
  },
  tracking_failed: {
    headline: "Club tracking didn't complete",
    detail:
      "Everything else on this page was measured normally — only the club tracking stage failed.",
    actionable: false,
  },
};

export const BALL_SPEED_COPY: Record<BallSpeedReason, string> = {
  needs_120fps:
    "Ball speed needs 120fps or higher — a struck ball clears the frame in roughly one frame at 30fps.",
  not_detected:
    "The ball couldn't be picked out at address. It needs to be visible and reasonably still before the strike.",
  needs_clubhead_speed:
    "Ball speed is reported alongside clubhead speed, which wasn't available for this swing.",
};
