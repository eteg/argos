CREATE TABLE "entries" (
	"id" uuid PRIMARY KEY NOT NULL,
	"site_id" uuid NOT NULL,
	"captured_at" timestamp with time zone NOT NULL,
	"local_date" date NOT NULL,
	"timezone" text NOT NULL,
	"location" jsonb,
	"offline" boolean DEFAULT false NOT NULL,
	"audio_media_id" uuid,
	"photo_media_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text NOT NULL,
	"transcript" text,
	"title" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media" (
	"id" uuid PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"source" text NOT NULL,
	"captured_at" timestamp with time zone NOT NULL,
	"location" jsonb,
	"duration_seconds" integer,
	"content_type" text NOT NULL,
	"path" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"status" text NOT NULL,
	"status_changed_on" date NOT NULL,
	"address" text,
	"location" jsonb,
	"client" jsonb,
	"contractor" jsonb,
	"technical_manager" jsonb,
	"public_contract" jsonb,
	"equipment" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "entries" ADD CONSTRAINT "entries_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entries" ADD CONSTRAINT "entries_audio_media_id_media_id_fk" FOREIGN KEY ("audio_media_id") REFERENCES "public"."media"("id") ON DELETE no action ON UPDATE no action;