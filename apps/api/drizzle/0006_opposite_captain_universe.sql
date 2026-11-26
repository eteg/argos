ALTER TABLE "reports" ADD COLUMN "edited_paths" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
UPDATE "reports" SET "edited_paths" = (
  SELECT coalesce(jsonb_agg(e.key), '[]'::jsonb) FROM jsonb_each("reports"."content") AS e
  WHERE e.key IN ('workday', 'weather', 'weatherStoppage', 'rainfallMm', 'labor', 'laborNotes', 'equipment', 'activities', 'occurrences', 'openItemReviews', 'newOpenItems')
    AND e.value <> 'null'::jsonb AND e.value <> '[]'::jsonb
) WHERE "status" <> 'approved' AND "history" @> '[{"actor": "engineer"}]'::jsonb;
