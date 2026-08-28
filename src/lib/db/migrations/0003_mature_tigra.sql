CREATE TYPE "public"."swing_source" AS ENUM('upload', 'demo');--> statement-breakpoint
ALTER TABLE "swings" ADD COLUMN "source" "swing_source" DEFAULT 'upload' NOT NULL;--> statement-breakpoint
UPDATE "swings" SET "source" = 'demo' WHERE "blob_url" = 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4';--> statement-breakpoint
CREATE INDEX "swings_source_created_idx" ON "swings" USING btree ("source","created_at");