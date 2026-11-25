CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"file_name" text NOT NULL,
	"type" text NOT NULL,
	"mime_type" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entries" (
	"id" uuid PRIMARY KEY NOT NULL,
	"site_id" uuid NOT NULL,
	"captured_at" timestamp with time zone NOT NULL,
	"local_date" date NOT NULL,
	"timezone" text NOT NULL,
	"lat" double precision,
	"lng" double precision,
	"accuracy_meters" double precision,
	"offline" boolean DEFAULT false NOT NULL,
	"audio_media_id" uuid NOT NULL,
	"photo_media_ids" uuid[] DEFAULT '{}' NOT NULL,
	"status" text DEFAULT 'processed' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "equipment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"name" text NOT NULL,
	"identifier" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media" (
	"id" uuid PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"source" text NOT NULL,
	"mime_type" text NOT NULL,
	"captured_at" timestamp with time zone NOT NULL,
	"lat" double precision,
	"lng" double precision,
	"accuracy_meters" double precision,
	"duration_seconds" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"code" text NOT NULL,
	"description" text NOT NULL,
	"unit" text
);
--> statement-breakpoint
CREATE TABLE "sites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"status" text DEFAULT 'in_progress' NOT NULL,
	"status_changed_on" date,
	"address" text NOT NULL,
	"lat" double precision,
	"lng" double precision,
	"accuracy_meters" double precision,
	"client_name" text NOT NULL,
	"client_tax_id" text NOT NULL,
	"contractor_name" text NOT NULL,
	"contractor_tax_id" text NOT NULL,
	"technical_manager_name" text NOT NULL,
	"technical_manager_art_number" text NOT NULL,
	"public_contract" jsonb,
	"services_file_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entries" ADD CONSTRAINT "entries_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entries" ADD CONSTRAINT "entries_audio_media_id_media_id_fk" FOREIGN KEY ("audio_media_id") REFERENCES "public"."media"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "entries_site_day_idx" ON "entries" USING btree ("site_id","local_date");