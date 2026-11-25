import { date, doublePrecision, integer, jsonb, pgTable, text, timestamp, uuid, boolean, index, uniqueIndex } from "drizzle-orm/pg-core";

export const appMeta = pgTable("app_meta", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export interface PublicContractRow {
  number: string;
  commitmentOrAgreement: string;
  inspectorName: string;
  serviceOrderDate: string;
  durationDays: number;
  amendments: { id: string; description: string; addedDays: number; signedOn: string }[];
}

export const sites = pgTable("sites", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  status: text("status").notNull().default("in_progress"),
  statusChangedOn: date("status_changed_on"),
  address: text("address").notNull(),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  accuracyMeters: doublePrecision("accuracy_meters"),
  clientName: text("client_name").notNull(),
  clientTaxId: text("client_tax_id").notNull(),
  contractorName: text("contractor_name").notNull(),
  contractorTaxId: text("contractor_tax_id").notNull(),
  technicalManagerName: text("technical_manager_name").notNull(),
  technicalManagerArtNumber: text("technical_manager_art_number").notNull(),
  publicContract: jsonb("public_contract").$type<PublicContractRow>(),
  servicesFileName: text("services_file_name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const equipment = pgTable("equipment", {
  id: uuid("id").primaryKey().defaultRandom(),
  siteId: uuid("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  identifier: text("identifier"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const documents = pgTable("documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  siteId: uuid("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  type: text("type").notNull(),
  mimeType: text("mime_type").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const services = pgTable("services", {
  id: uuid("id").primaryKey().defaultRandom(),
  siteId: uuid("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
  code: text("code").notNull(),
  description: text("description").notNull(),
  unit: text("unit"),
});

export const media = pgTable("media", {
  id: uuid("id").primaryKey(),
  kind: text("kind").notNull(),
  source: text("source").notNull(),
  mimeType: text("mime_type").notNull(),
  capturedAt: timestamp("captured_at", { withTimezone: true }).notNull(),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  accuracyMeters: doublePrecision("accuracy_meters"),
  durationSeconds: integer("duration_seconds"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const entries = pgTable(
  "entries",
  {
    id: uuid("id").primaryKey(),
    siteId: uuid("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
    capturedAt: timestamp("captured_at", { withTimezone: true }).notNull(),
    localDate: date("local_date").notNull(),
    timezone: text("timezone").notNull(),
    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),
    accuracyMeters: doublePrecision("accuracy_meters"),
    offline: boolean("offline").notNull().default(false),
    audioMediaId: uuid("audio_media_id").notNull().references(() => media.id),
    photoMediaIds: uuid("photo_media_ids").array().notNull().default([]),
    status: text("status").notNull().default("processed"),
    transcript: text("transcript"),
    title: text("title"),
    tags: jsonb("tags").$type<{ kind: string; label: string }[]>().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("entries_site_day_idx").on(t.siteId, t.localDate)],
);

export const reports = pgTable(
  "reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: uuid("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
    localDate: date("local_date").notNull(),
    number: integer("number"),
    status: text("status").notNull().default("generating"),
    content: jsonb("content").$type<Record<string, unknown>>().notNull().default({}),
    siteSnapshot: jsonb("site_snapshot").$type<Record<string, unknown>>(),
    approvedBy: text("approved_by"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    approvalKey: uuid("approval_key"),
    history: jsonb("history").$type<{ at: string; actor: "agent" | "engineer"; description: string }[]>().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("reports_site_day_idx").on(t.siteId, t.localDate), uniqueIndex("reports_site_number_idx").on(t.siteId, t.number)],
);

export const questions = pgTable(
  "questions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entryId: uuid("entry_id").references(() => entries.id, { onDelete: "cascade" }),
    reportId: uuid("report_id").references(() => reports.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    text: text("text").notNull(),
    field: text("field"),
    openItemId: uuid("open_item_id"),
    options: jsonb("options").$type<{ id: string; label: string }[]>().notNull().default([]),
    status: text("status").notNull().default("open"),
    answer: jsonb("answer").$type<{ optionId: string | null; text: string | null; audioMediaId: string | null; answeredAt: string }>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("questions_report_idx").on(t.reportId), index("questions_entry_idx").on(t.entryId)],
);
