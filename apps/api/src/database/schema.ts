import { date, doublePrecision, integer, jsonb, pgTable, text, timestamp, uuid, boolean, index } from "drizzle-orm/pg-core";

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
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("entries_site_day_idx").on(t.siteId, t.localDate)],
);
