import { z } from "zod";

export const siteTypeSchema = z.enum(["private", "public", "financed"]);
export const mediaKindSchema = z.enum(["audio", "photo"]);
export const mediaSourceSchema = z.enum(["camera", "gallery", "microphone"]);
export const reportStatusSchema = z.enum(["generating", "draft", "approved"]);
export const shiftSchema = z.enum(["morning", "afternoon"]);
export const weatherSchema = z.enum(["good", "cloudy", "light_rain", "heavy_rain"]);
export const workConditionSchema = z.enum(["workable", "partially_workable", "unworkable"]);
export const employmentSchema = z.enum(["own", "third_party"]);
export const laborCategorySchema = z.enum(["direct", "indirect"]);
export const equipmentStatusSchema = z.enum(["operating", "stopped", "under_maintenance"]);
export const activityStatusSchema = z.enum(["started", "in_progress", "completed", "stopped"]);
export const occurrenceTypeSchema = z.enum([
  "stoppage",
  "accident",
  "material_shortage",
  "equipment_failure",
  "inspection_order",
  "visit",
  "external_interference",
  "other",
]);
export const occurrenceStatusSchema = z.enum(["open", "closed"]);
export const safetyTypeSchema = z.enum(["accident", "incident"]);
export const openItemKindSchema = z.enum([
  "declared_pending",
  "unresolved_occurrence",
  "unfinished_service",
]);
export const openItemOutcomeSchema = z.enum(["close", "keep", "update"]);
export const questionKindSchema = z.enum(["missing_field", "open_item", "service_match", "safety"]);
export const questionStatusSchema = z.enum(["open", "answered"]);
export const historyActorSchema = z.enum(["agent", "engineer"]);

export type SiteType = z.infer<typeof siteTypeSchema>;
