CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"local_date" date NOT NULL,
	"number" integer NOT NULL,
	"status" text NOT NULL,
	"site" jsonb NOT NULL,
	"content" jsonb,
	"questions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"history" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"approval" jsonb,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reports_site_id_local_date_unique" UNIQUE("site_id","local_date")
);
--> statement-breakpoint
ALTER TABLE "entries" ADD COLUMN "tags" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;