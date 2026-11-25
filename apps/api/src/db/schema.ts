import type { ReportContent } from "@argos/rdo-schema";
import { boolean, date, integer, jsonb, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

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
  tags: jsonb("tags").$type<EntryTag[]>().notNull().default([]),
  openItemIds: jsonb("open_item_ids").$type<string[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type EntryTag = { kind: "activity" | "occurrence" | "labor" | "equipment" | "weather" | "safety"; label: string };
export type Question = {
  id: string;
  kind: "missing_field" | "open_item" | "service_match" | "safety";
  text: string;
  field: string | null;
  openItemId: string | null;
  options: { id: string; label: string }[];
  status: "open" | "answered";
  answer: { optionId: string | null; text: string | null; audioMediaId: string | null; answeredAt: string } | null;
};
export type HistoryLine = { at: string; actor: "agent" | "engineer"; description: string };

// Um RDO por obra e por dia. O conteúdo segue o schema de @argos/rdo-schema.
export const reports = pgTable(
  "reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id),
    localDate: date("local_date").notNull(),
    number: integer("number").notNull(),
    status: text("status").notNull(),
    site: jsonb("site").$type<Record<string, unknown>>().notNull(),
    content: jsonb("content").$type<ReportContent>(),
    questions: jsonb("questions").$type<Question[]>().notNull().default([]),
    history: jsonb("history").$type<HistoryLine[]>().notNull().default([]),
    approval: jsonb("approval").$type<{ approvedBy: string; approvedAt: string }>(),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.siteId, t.localDate)],
);

// O que ficou pendente num RDO aprovado (F1RN06). Só nasce e muda na aprovação (F1RN11).
export const openItems = pgTable("open_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  siteId: uuid("site_id")
    .notNull()
    .references(() => sites.id),
  title: text("title").notNull(),
  kind: text("kind").notNull(),
  status: text("status").notNull(),
  openedOn: date("opened_on").notNull(),
  openedInReportId: uuid("opened_in_report_id")
    .notNull()
    .references(() => reports.id),
  lastUpdate: jsonb("last_update").$type<{ localDate: string; note: string }>(),
  closedOn: date("closed_on"),
  closingNote: text("closing_note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
