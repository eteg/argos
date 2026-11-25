CREATE TABLE "open_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"title" text NOT NULL,
	"kind" text NOT NULL,
	"status" text NOT NULL,
	"opened_on" date NOT NULL,
	"opened_in_report_id" uuid NOT NULL,
	"last_update" jsonb,
	"closed_on" date,
	"closing_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "entries" ADD COLUMN "open_item_ids" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "open_items" ADD CONSTRAINT "open_items_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "open_items" ADD CONSTRAINT "open_items_opened_in_report_id_reports_id_fk" FOREIGN KEY ("opened_in_report_id") REFERENCES "public"."reports"("id") ON DELETE no action ON UPDATE no action;