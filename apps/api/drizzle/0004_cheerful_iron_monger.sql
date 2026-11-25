ALTER TABLE "entries" ADD COLUMN "transcript" text;--> statement-breakpoint
ALTER TABLE "entries" ADD COLUMN "title" text;--> statement-breakpoint
ALTER TABLE "entries" ADD COLUMN "tags" jsonb DEFAULT '[]'::jsonb NOT NULL;