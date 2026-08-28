import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const swingStatusEnum = pgEnum("swing_status", [
  "QUEUED",
  "PROCESSING",
  "COMPLETE",
  "FAILED",
  "REJECTED",
]);

export const cameraViewEnum = pgEnum("camera_view", [
  "face_on",
  "down_the_line",
  "unknown",
]);

/**
 * How the swing entered the pipeline.
 *
 * `upload` is a clip the golfer actually sent. `demo` is a canned run from
 * the "Try a demo" buttons — same pipeline, placeholder video, not their
 * swing. The admin ledger splits on this so a demo click is never counted
 * as a submitted video.
 */
export const swingSourceEnum = pgEnum("swing_source", ["upload", "demo"]);

export const users = pgTable("users", {
  id: text("id").primaryKey(), // Clerk user id
  email: text("email").notNull(),
  handicap: real("handicap"),
  heightCm: real("height_cm"),
  /**
   * Fingertip-to-floor, standing straight. The measurement club fitters
   * actually use for shaft length — height alone gets it wrong for anyone
   * whose arm length is not average for their height, which is most of the
   * people who need a fitting in the first place. Optional: the engine
   * falls back to height and says that it did.
   */
  wristToFloorCm: real("wrist_to_floor_cm"),
  /** BCP-47. Drives UI copy and the language coaching is written in. */
  locale: text("locale").notNull().default("en"),
  /**
   * Speed units for display only. The pipeline measures and stores mph
   * throughout — converting at the boundary keeps one unit in the database
   * and avoids the class of bug where a stored number's unit depends on who
   * happened to record it.
   */
  speedUnit: text("speed_unit").notNull().default("mph"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const swings = pgTable(
  "swings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    blobUrl: text("blob_url").notNull(),
    thumbnailUrl: text("thumbnail_url"),
    keypointsUrl: text("keypoints_url"),
    view: cameraViewEnum("view").notNull().default("unknown"),
    club: text("club"),
    source: swingSourceEnum("source").notNull().default("upload"),
    fps: real("fps"),
    durationMs: integer("duration_ms"),
    frameCount: integer("frame_count"),
    status: swingStatusEnum("status").notNull().default("QUEUED"),
    rejectionReason: text("rejection_reason"),
    qualityWarnings: jsonb("quality_warnings").$type<string[]>().default([]),
    /**
     * The pipeline's `club` block — whether the clubhead was tracked, the
     * pixels-per-metre scale, and why speed or ball speed is absent when
     * they are. Stored so the result page can tell the golfer "film face-on"
     * instead of just showing a gap where a number should be.
     */
    clubTracking: jsonb("club_tracking").$type<{
      tracked: boolean;
      scalePxPerM: number | null;
      speedUnavailableReason: string | null;
      ballUnavailableReason: string | null;
    } | null>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    analyzedAt: timestamp("analyzed_at", { withTimezone: true }),
  },
  (t) => [
    index("swings_user_created_idx").on(t.userId, t.createdAt),
    index("swings_source_created_idx").on(t.source, t.createdAt),
  ],
);

export const swingEvents = pgTable("swing_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  swingId: uuid("swing_id")
    .notNull()
    .references(() => swings.id, { onDelete: "cascade" }),
  event: text("event").notNull(),
  frame: integer("frame").notNull(),
  timestampMs: real("timestamp_ms").notNull(),
  confidence: real("confidence").notNull(),
});

export const swingMetrics = pgTable(
  "swing_metrics",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    swingId: uuid("swing_id")
      .notNull()
      .references(() => swings.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    value: real("value").notNull(),
    unit: text("unit").notNull(),
    phase: text("phase").notNull(),
    confidence: real("confidence").notNull(),
    targetMin: real("target_min"),
    targetMax: real("target_max"),
  },
  (t) => [index("swing_metrics_swing_key_idx").on(t.swingId, t.key)],
);

export const swingFaults = pgTable("swing_faults", {
  id: uuid("id").defaultRandom().primaryKey(),
  swingId: uuid("swing_id")
    .notNull()
    .references(() => swings.id, { onDelete: "cascade" }),
  code: text("code").notNull(),
  severity: real("severity").notNull(),
  phase: text("phase").notNull(),
  detectedFrom: jsonb("detected_from").$type<string[]>().notNull(),
  confidence: real("confidence").notNull(),
});

export const swingScores = pgTable("swing_scores", {
  id: uuid("id").defaultRandom().primaryKey(),
  swingId: uuid("swing_id")
    .notNull()
    .references(() => swings.id, { onDelete: "cascade" }),
  overall: real("overall").notNull(),
  setup: real("setup").notNull(),
  backswing: real("backswing").notNull(),
  top: real("top").notNull(),
  downswing: real("downswing").notNull(),
  impact: real("impact").notNull(),
  finish: real("finish").notNull(),
  rubricVersion: text("rubric_version").notNull(),
});

export const feedback = pgTable("feedback", {
  id: uuid("id").defaultRandom().primaryKey(),
  swingId: uuid("swing_id")
    .notNull()
    .references(() => swings.id, { onDelete: "cascade" }),
  headline: text("headline").notNull(),
  primaryFaultCode: text("primary_fault_code"),
  body: text("body").notNull(),
  drills: jsonb("drills").$type<unknown[]>().notNull().default([]),
  model: text("model").notNull(),
  promptVersion: text("prompt_version").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const drills = pgTable("drills", {
  id: uuid("id").defaultRandom().primaryKey(),
  faultCode: text("fault_code").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  cue: text("cue").notNull(),
  difficulty: text("difficulty").notNull(),
  videoUrl: text("video_url"),
});
