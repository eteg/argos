import { boolean, date, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

// Nomes e formatos de docs/contratos/recursos.md. Os objetos da obra ficam em jsonb enquanto o contrato é rascunho.
export type Location = { lat: number; lng: number; accuracyMeters: number | null };
export type Party = { name: string; taxId: string | null };
export type TechnicalManager = { name: string; artNumber: string | null };
export type PublicContract = {
  number: string;
  commitmentOrAgreement: string | null;
  inspectorName: string | null;
  serviceOrderDate: string;
  durationDays: number;
  amendments: { id: string; description: string; addedDays: number; signedOn: string }[];
};
export type SiteEquipment = { id: string; name: string; identifier: string | null };

export const sites = pgTable("sites", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  status: text("status").notNull(),
  statusChangedOn: date("status_changed_on").notNull(),
  address: text("address"),
  location: jsonb("location").$type<Location>(),
  client: jsonb("client").$type<Party>(),
  contractor: jsonb("contractor").$type<Party>(),
  technicalManager: jsonb("technical_manager").$type<TechnicalManager>(),
  publicContract: jsonb("public_contract").$type<PublicContract>(),
  equipment: jsonb("equipment").$type<SiteEquipment[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const media = pgTable("media", {
  id: uuid("id").primaryKey(),
  kind: text("kind").notNull(),
  source: text("source").notNull(),
  capturedAt: timestamp("captured_at", { withTimezone: true }).notNull(),
  location: jsonb("location").$type<Location>(),
  durationSeconds: integer("duration_seconds"),
  contentType: text("content_type").notNull(),
  path: text("path").notNull(),
});

export const entries = pgTable("entries", {
  id: uuid("id").primaryKey(),
  siteId: uuid("site_id")
    .notNull()
    .references(() => sites.id),
  capturedAt: timestamp("captured_at", { withTimezone: true }).notNull(),
  localDate: date("local_date").notNull(),
  timezone: text("timezone").notNull(),
  location: jsonb("location").$type<Location>(),
  offline: boolean("offline").notNull().default(false),
  audioMediaId: uuid("audio_media_id").references(() => media.id),
  photoMediaIds: jsonb("photo_media_ids").$type<string[]>().notNull().default([]),
  status: text("status").notNull(),
  transcript: text("transcript"),
  title: text("title"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
