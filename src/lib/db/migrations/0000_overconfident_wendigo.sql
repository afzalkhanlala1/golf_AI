CREATE TYPE "public"."camera_view" AS ENUM('face_on', 'down_the_line', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."swing_status" AS ENUM('QUEUED', 'PROCESSING', 'COMPLETE', 'FAILED', 'REJECTED');--> statement-breakpoint
CREATE TABLE "drills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fault_code" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"cue" text NOT NULL,
	"difficulty" text NOT NULL,
	"video_url" text
);
--> statement-breakpoint
CREATE TABLE "feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"swing_id" uuid NOT NULL,
	"headline" text NOT NULL,
	"primary_fault_code" text,
	"body" text NOT NULL,
	"drills" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"model" text NOT NULL,
	"prompt_version" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "swing_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"swing_id" uuid NOT NULL,
	"event" text NOT NULL,
	"frame" integer NOT NULL,
	"timestamp_ms" real NOT NULL,
	"confidence" real NOT NULL
);
--> statement-breakpoint
CREATE TABLE "swing_faults" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"swing_id" uuid NOT NULL,
	"code" text NOT NULL,
	"severity" real NOT NULL,
	"phase" text NOT NULL,
	"detected_from" jsonb NOT NULL,
	"confidence" real NOT NULL
);
--> statement-breakpoint
CREATE TABLE "swing_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"swing_id" uuid NOT NULL,
	"key" text NOT NULL,
	"value" real NOT NULL,
	"unit" text NOT NULL,
	"phase" text NOT NULL,
	"confidence" real NOT NULL,
	"target_min" real,
	"target_max" real
);
--> statement-breakpoint
CREATE TABLE "swing_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"swing_id" uuid NOT NULL,
	"overall" real NOT NULL,
	"setup" real NOT NULL,
	"backswing" real NOT NULL,
	"top" real NOT NULL,
	"downswing" real NOT NULL,
	"impact" real NOT NULL,
	"finish" real NOT NULL,
	"rubric_version" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "swings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"blob_url" text NOT NULL,
	"thumbnail_url" text,
	"keypoints_url" text,
	"view" "camera_view" DEFAULT 'unknown' NOT NULL,
	"club" text,
	"fps" real,
	"duration_ms" integer,
	"frame_count" integer,
	"status" "swing_status" DEFAULT 'QUEUED' NOT NULL,
	"rejection_reason" text,
	"quality_warnings" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"analyzed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"handicap" real,
	"height_cm" real,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_swing_id_swings_id_fk" FOREIGN KEY ("swing_id") REFERENCES "public"."swings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "swing_events" ADD CONSTRAINT "swing_events_swing_id_swings_id_fk" FOREIGN KEY ("swing_id") REFERENCES "public"."swings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "swing_faults" ADD CONSTRAINT "swing_faults_swing_id_swings_id_fk" FOREIGN KEY ("swing_id") REFERENCES "public"."swings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "swing_metrics" ADD CONSTRAINT "swing_metrics_swing_id_swings_id_fk" FOREIGN KEY ("swing_id") REFERENCES "public"."swings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "swing_scores" ADD CONSTRAINT "swing_scores_swing_id_swings_id_fk" FOREIGN KEY ("swing_id") REFERENCES "public"."swings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "swings" ADD CONSTRAINT "swings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "swing_metrics_swing_key_idx" ON "swing_metrics" USING btree ("swing_id","key");--> statement-breakpoint
CREATE INDEX "swings_user_created_idx" ON "swings" USING btree ("user_id","created_at");