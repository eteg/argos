CREATE TABLE "questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entry_id" uuid,
	"report_id" uuid,
	"kind" text NOT NULL,
	"text" text NOT NULL,
	"field" text,
	"open_item_id" uuid,
	"options" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"answer" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"local_date" date NOT NULL,
	"number" integer,
	"status" text DEFAULT 'generating' NOT NULL,
	"content" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"site_snapshot" jsonb,
	"approved_by" text,
	"approved_at" timestamp with time zone,
	"approval_key" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_entry_id_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "questions_report_idx" ON "questions" USING btree ("report_id");--> statement-breakpoint
CREATE INDEX "questions_entry_idx" ON "questions" USING btree ("entry_id");--> statement-breakpoint
CREATE UNIQUE INDEX "reports_site_day_idx" ON "reports" USING btree ("site_id","local_date");--> statement-breakpoint
CREATE UNIQUE INDEX "reports_site_number_idx" ON "reports" USING btree ("site_id","number");