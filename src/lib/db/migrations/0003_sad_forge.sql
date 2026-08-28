CREATE TABLE "coach_review_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"code_hash" text NOT NULL,
	"code_hint" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coach_review_invites_code_hash_unique" UNIQUE("code_hash")
);
--> statement-breakpoint
CREATE TABLE "coach_review_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invite_id" uuid NOT NULL,
	"sample_id" text NOT NULL,
	"overall_score" integer NOT NULL,
	"primary_fault" text NOT NULL,
	"faults" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coach_review_submissions_invite_id_unique" UNIQUE("invite_id")
);
--> statement-breakpoint
ALTER TABLE "coach_review_submissions" ADD CONSTRAINT "coach_review_submissions_invite_id_coach_review_invites_id_fk" FOREIGN KEY ("invite_id") REFERENCES "public"."coach_review_invites"("id") ON DELETE cascade ON UPDATE no action;