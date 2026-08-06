ALTER TABLE "swings" ADD COLUMN "club_tracking" jsonb;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "wrist_to_floor_cm" real;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "locale" text DEFAULT 'en' NOT NULL;