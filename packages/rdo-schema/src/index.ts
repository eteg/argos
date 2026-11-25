import { z } from "zod";

// Schema do RDO (RG06). Os nomes seguem docs/contratos/recursos.md, que segue a matriz de campos do guia.
// O conteúdo é o que a IA preenche e o engenheiro revisa. Campo que a IA não sabe fica null, e ela pergunta (RG05).

export const LIMITS = {
  photosPerEntry: 3,
  minPhotosPerReport: 3,
  maxPhotosPerReport: 20,
} as const;

export const siteTypeSchema = z.enum(["private", "public", "financed"]);
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
export const openItemKindSchema = z.enum(["declared_pending", "unresolved_occurrence", "unfinished_service"]);
export const openItemOutcomeSchema = z.enum(["close", "keep", "update"]);

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "HH:mm");

export const workdaySchema = z.object({
  startTime: time.nullable(),
  endTime: time.nullable(),
  breakMinutes: z.number().int().min(0).nullable(),
});

export const weatherEntrySchema = z.object({
  shift: shiftSchema,
  weather: weatherSchema.nullable(),
  condition: workConditionSchema.nullable(),
});

export const weatherStoppageSchema = z.object({
  hours: z.number().min(0).nullable(),
  serviceIds: z.array(z.string()),
});

export const laborSchema = z.object({
  role: z.string(),
  count: z.number().int().min(0).nullable(),
  employment: employmentSchema.nullable(),
  company: z.string().nullable(),
  category: laborCategorySchema.nullable(),
});

export const equipmentSchema = z.object({
  equipmentId: z.string(),
  name: z.string(),
  identifier: z.string().nullable(),
  status: equipmentStatusSchema.nullable(),
  operatingHours: z.number().min(0).nullable(),
});

export const activitySchema = z.object({
  id: z.string(),
  description: z.string(),
  serviceId: z.string().nullable(),
  location: z.string().nullable(),
  status: activityStatusSchema.nullable(),
  quantity: z.number().min(0).nullable(),
  unit: z.string().nullable(),
  cumulativeProgressPercent: z.number().min(0).max(100).nullable(),
  executor: z.string().nullable(),
});

export const safetySchema = z.object({
  type: safetyTypeSchema,
  dds: z.boolean().nullable(),
  ppeInUse: z.boolean().nullable(),
});

export const occurrenceSchema = z.object({
  id: z.string(),
  type: occurrenceTypeSchema,
  description: z.string(),
  startTime: time.nullable(),
  endTime: time.nullable(),
  status: occurrenceStatusSchema.nullable(),
  affectedServiceIds: z.array(z.string()),
  source: z.object({ origin: z.string(), document: z.string().nullable() }).nullable(),
  materials: z.string().nullable(),
  safety: safetySchema.nullable(),
});

export const openItemReviewSchema = z.object({
  openItemId: z.string(),
  outcome: openItemOutcomeSchema,
  note: z.string().nullable(),
});

export const newOpenItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  kind: openItemKindSchema,
  track: z.boolean(),
});

export const reportContentSchema = z.object({
  workday: workdaySchema,
  weather: z.array(weatherEntrySchema),
  weatherStoppage: weatherStoppageSchema.nullable(),
  rainfallMm: z.number().min(0).nullable(),
  labor: z.array(laborSchema),
  laborNotes: z.string().nullable(),
  equipment: z.array(equipmentSchema),
  activities: z.array(activitySchema),
  occurrences: z.array(occurrenceSchema),
  openItemReviews: z.array(openItemReviewSchema),
  newOpenItems: z.array(newOpenItemSchema),
});

export type SiteType = z.infer<typeof siteTypeSchema>;
export type ReportContent = z.infer<typeof reportContentSchema>;

// JSON Schema do conteúdo, pra saída estruturada da IA e pra quem não fala Zod.
export const reportContentJsonSchema = z.toJSONSchema(reportContentSchema);

export type FieldLevel = "universal" | "public" | "recommended";

export interface MissingField {
  // Caminho do campo, como "weather.0.condition" ou "activities.1.quantity".
  field: string;
  level: FieldLevel;
}

const isPublic = (siteType: SiteType) => siteType !== "private";
const empty = (v: unknown) => v === null || v === undefined || v === "";

// Campos vazios por nível (RG02, RG06, F1RN04). O RDO só é aprovado sem nenhum "universal" e,
// em obra pública ou financiada, sem nenhum "public". Os "recommended" só aparecem como aviso.
export function findMissingFields(
  content: ReportContent,
  siteType: SiteType,
  // Sem planilha de serviços importada, não há serviço pra escolher.
  { hasServices = true }: { hasServices?: boolean } = {},
): MissingField[] {
  const missing: MissingField[] = [];
  const check = (field: string, value: unknown, level: FieldLevel) => {
    if (level === "public" && !isPublic(siteType)) return;
    if (empty(value)) missing.push({ field, level });
  };

  check("workday.startTime", content.workday.startTime, "universal");
  check("workday.endTime", content.workday.endTime, "universal");
  check("workday.breakMinutes", content.workday.breakMinutes, "universal");

  for (const shift of shiftSchema.options) {
    const i = content.weather.findIndex((w) => w.shift === shift);
    if (i < 0) {
      missing.push({ field: `weather.${shift}`, level: "universal" });
      continue;
    }
    check(`weather.${i}.weather`, content.weather[i]!.weather, "universal");
    check(`weather.${i}.condition`, content.weather[i]!.condition, "universal");
  }
  if (isPublic(siteType)) {
    check("weatherStoppage", content.weatherStoppage, "public");
    if (content.weatherStoppage) check("weatherStoppage.hours", content.weatherStoppage.hours, "public");
  }
  check("rainfallMm", content.rainfallMm, "recommended");

  if (content.labor.length === 0) missing.push({ field: "labor", level: "universal" });
  content.labor.forEach((l, i) => {
    check(`labor.${i}.count`, l.count, "universal");
    check(`labor.${i}.employment`, l.employment, "universal");
    if (l.employment === "third_party") check(`labor.${i}.company`, l.company, "universal");
    check(`labor.${i}.category`, l.category, "recommended");
  });
  check("laborNotes", content.laborNotes, "recommended");

  content.equipment.forEach((e, i) => check(`equipment.${i}.status`, e.status, "universal"));

  if (content.activities.length === 0) missing.push({ field: "activities", level: "universal" });
  content.activities.forEach((a, i) => {
    if (hasServices) check(`activities.${i}.serviceId`, a.serviceId, "universal");
    check(`activities.${i}.location`, a.location, "universal");
    check(`activities.${i}.status`, a.status, "universal");
    check(`activities.${i}.quantity`, a.quantity, "public");
    check(`activities.${i}.unit`, a.unit, "public");
    check(`activities.${i}.executor`, a.executor, "recommended");
  });

  content.occurrences.forEach((o, i) => {
    check(`occurrences.${i}.startTime`, o.startTime, "universal");
    check(`occurrences.${i}.status`, o.status, "universal");
    if (o.status === "closed") check(`occurrences.${i}.endTime`, o.endTime, "universal");
    if (isPublic(siteType) && o.affectedServiceIds.length === 0) {
      missing.push({ field: `occurrences.${i}.affectedServiceIds`, level: "public" });
    }
    check(`occurrences.${i}.source`, o.source, "public");
    // Segurança obrigatória quando há acidente (F1RN04).
    if (o.type === "accident") {
      check(`occurrences.${i}.safety`, o.safety, "universal");
      if (o.safety) {
        check(`occurrences.${i}.safety.dds`, o.safety.dds, "universal");
        check(`occurrences.${i}.safety.ppeInUse`, o.safety.ppeInUse, "universal");
      }
    }
  });

  return missing;
}

// Só os que impedem a aprovação.
export function blockingFields(
  content: ReportContent,
  siteType: SiteType,
  options?: { hasServices?: boolean },
): MissingField[] {
  return findMissingFields(content, siteType, options).filter((f) => f.level !== "recommended");
}
