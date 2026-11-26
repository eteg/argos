import { Inject, Injectable, Logger } from "@nestjs/common";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { fieldTypeAt, reportContentSchema, validateReport, type FieldType } from "@argos/rdo-schema";
import { z } from "zod";
import { parse } from "../common/validate.js";
import type { Schemas } from "@argos/contract";
import { ProblemException } from "../common/problem.js";
import { DB, type Database } from "../database/database.module.js";
import { aiEnabled, env } from "../config/env.js";
import { lockDay, lockSite, pendingDaysBefore } from "../database/locks.js";
import { OpenItemsService, type Tx } from "../open-items/open-items.service.js";
import { dropDanglingLinks, editedKeys, keepEdited, keepPhotoEdits, mergeEdited } from "./report-edits.js";
import { ProcessingService, setPath } from "../processing/processing.service.js";
import { entries, equipment, media, questions, reports, services, sites } from "../database/schema.js";
import { SitesService } from "../sites/sites.service.js";
import { uuid } from "../sites/sites.schemas.js";
import { StorageService } from "../storage/storage.service.js";

type ReportRow = typeof reports.$inferSelect;
type Content = Omit<
  Schemas["Report"],
  "id" | "siteId" | "number" | "status" | "entriesCount" | "questions" | "missingFields" | "photoRequirements" | "approval" | "history" | "pdfUrl"
>;

const editableSchema = reportContentSchema
  .omit({ site: true, localDate: true, photos: true })
  .partial()
  .extend({
    photos: z
      .array(
        z.strictObject({
          id: z.string(),
          caption: z.string().nullable().optional(),
          linkedTo: z.strictObject({ type: z.enum(["activity", "occurrence"]), id: z.string() }).nullable().optional(),
        }),
      )
      .optional(),
  });

const fieldLabels: Record<string, string> = {
  workday: "jornada",
  weather: "clima",
  weatherStoppage: "horas paradas por clima",
  rainfallMm: "pluviometria",
  labor: "efetivo",
  laborNotes: "observações do efetivo",
  equipment: "equipamentos",
  activities: "atividades",
  occurrences: "ocorrências",
  openItemReviews: "itens em aberto dos dias anteriores",
  newOpenItems: "novos itens em aberto",
  photos: "fotos",
};

const NULLABLE_FIELDS = ["rainfallMm", "laborNotes", "weatherStoppage"];

const MIN_PHOTOS = 3;
const MAX_PHOTOS = 20;

function textValue(text: string, path: string, type: FieldType | undefined): unknown {
  const trimmed = text.trim();
  if ((type === "number" || type === "integer") && /^-?\d+([.,]\d+)?$/.test(trimmed)) return Number(trimmed.replace(",", "."));
  if (type === "boolean" && (trimmed === "true" || trimmed === "false")) return trimmed === "true";
  if (type === "string" && /Time$/.test(path)) {
    const m = /(\d{1,2})\s*(?:[:h]\s*(\d{2})?)/i.exec(trimmed);
    return m ? `${m[1]!.padStart(2, "0")}:${m[2] ?? "00"}` : trimmed;
  }
  return text;
}

const checkReport = (content: unknown) => validateReport(content, { minPhotosPerReport: MIN_PHOTOS, maxPhotosPerReport: MAX_PHOTOS });

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly sitesService: SitesService,
    private readonly storage: StorageService,
    private readonly processing: ProcessingService,
    private readonly openItemsService: OpenItemsService,
  ) {}

  private async assemble(site: typeof sites.$inferSelect, localDate: string, dayEntries: (typeof entries.$inferSelect)[]): Promise<Content> {
    const equipmentRows = await this.db.select().from(equipment).where(eq(equipment.siteId, site.id)).orderBy(asc(equipment.createdAt));
    const photoIds = [...new Set(dayEntries.flatMap((e) => e.photoMediaIds))].slice(0, MAX_PHOTOS);
    const photoRows = photoIds.length ? await this.db.select().from(media).where(inArray(media.id, photoIds)) : [];
    const byId = new Map(photoRows.map((m) => [m.id, m]));
    const photos = photoIds.flatMap((id) => {
      const m = byId.get(id);
      if (!m) return [];
      return [{
        id: m.id,
        kind: m.kind as Schemas["MediaKind"],
        source: m.source as Schemas["MediaSource"],
        capturedAt: m.capturedAt.toISOString(),
        location: m.lat === null || m.lng === null ? null : { lat: m.lat, lng: m.lng, accuracyMeters: m.accuracyMeters },
        durationSeconds: null,
        url: this.storage.url("media", m.id),
        caption: null,
        linkedTo: null,
      }];
    });
    return {
      localDate,
      site: {
        name: site.name,
        type: site.type as Schemas["SiteType"],
        address: site.address,
        client: { name: site.clientName, taxId: site.clientTaxId },
        contractor: { name: site.contractorName, taxId: site.contractorTaxId },
        technicalManager: { name: site.technicalManagerName, artNumber: site.technicalManagerArtNumber },
        publicContract: this.sitesService.publicContract(site.publicContract, localDate),
      },
      workday: { startTime: null, endTime: null, breakMinutes: null },
      weather: [
        { shift: "morning", weather: null, condition: null },
        { shift: "afternoon", weather: null, condition: null },
      ],
      weatherStoppage: null,
      rainfallMm: null,
      labor: [],
      laborNotes: null,
      equipment: equipmentRows.map((e) => ({ equipmentId: e.id, name: e.name, identifier: e.identifier, status: null, operatingHours: null })),
      activities: [],
      occurrences: [],
      openItemReviews: [],
      newOpenItems: [],
      photos,
    };
  }

  private async lockReport(tx: Tx, reportId: string) {
    const [row] = await tx.select().from(reports).where(eq(reports.id, reportId)).for("update");
    if (!row) throw new ProblemException(404, "NOT_FOUND", "Report not found.");
    return row;
  }

  private contentOf(row: ReportRow): Content {
    const content = row.content as unknown as Content;
    return content.photos.length > MAX_PHOTOS ? { ...content, photos: content.photos.slice(0, MAX_PHOTOS) } : content;
  }

  async update(reportId: string, body: unknown) {
    await this.find(reportId);
    return this.db.transaction(async (tx) => {
      const row = await this.lockReport(tx, reportId);
      if (row.status === "approved") throw new ProblemException(409, "REPORT_ALREADY_APPROVED", "The report is already approved.");
      this.requireReady(row);
      const { photos, ...fields } = parse(editableSchema, body);
      const changed = [...Object.keys(fields), ...(photos ? ["photos"] : [])];
      if (changed.length === 0) throw new ProblemException(400, "VALIDATION", "Nothing to update.", [{ field: "body", code: "REQUIRED" }]);
      const cleared = Object.entries(fields).filter(([key, value]) => value === null && !NULLABLE_FIELDS.includes(key));
      if (cleared.length > 0) throw new ProblemException(400, "VALIDATION", "Invalid data.", cleared.map(([key]) => ({ field: key, code: "INVALID_TYPE" })));
      const merged: Record<string, unknown> = { ...this.contentOf(row), ...fields };
      const content = merged as unknown as Content;
      if (photos) {
        const known = new Set(content.photos.map((p) => p.id));
        const unknown = photos.filter((p) => !known.has(p.id));
        if (unknown.length > 0) throw new ProblemException(400, "VALIDATION", "Unknown photo.", unknown.map((p) => ({ field: `photos.${p.id}`, code: "INVALID" })));
        const patch = new Map(photos.map((p) => [p.id, p]));
        merged.photos = content.photos.map((p) => {
          const edit = patch.get(p.id);
          return edit ? { ...p, ...(edit.caption !== undefined && { caption: edit.caption }), ...(edit.linkedTo !== undefined && { linkedTo: edit.linkedTo }) } : p;
        });
      }
      const check = checkReport(content);
      if (check.structuralErrors.length > 0) {
        throw new ProblemException(400, "VALIDATION", "Invalid data.", check.structuralErrors.map((e) => ({ field: e.path, code: e.code })));
      }
      const description = `Corrigiu ${changed.map((k) => fieldLabels[k] ?? k).join(", ")}`;
      const editedPaths = mergeEdited(row.editedPaths, editedKeys(this.contentOf(row), merged));
      const [updated] = await tx
        .update(reports)
        .set({ content: merged, editedPaths, history: [...row.history, { at: new Date().toISOString(), actor: "engineer", description }], updatedAt: new Date() })
        .where(eq(reports.id, row.id))
        .returning();
      return updated!;
    });
  }

  async generate(siteId: string, localDate: string) {
    const site = await this.sitesService.requireSite(siteId);
    const useAi = aiEnabled();
    const { row, build } = await this.db.transaction(async (tx) => {
      await lockDay(tx, siteId, localDate);
      const [existing] = await tx.select().from(reports).where(and(eq(reports.siteId, siteId), eq(reports.localDate, localDate)));
      if (existing?.status === "approved") throw new ProblemException(409, "REPORT_ALREADY_APPROVED", "The report of the day is already approved.");
      if (existing?.status === "generating" && !this.processing.isStale(existing.updatedAt)) return { row: existing, build: false };
      const dayEntries = await tx.select().from(entries).where(and(eq(entries.siteId, siteId), eq(entries.localDate, localDate))).orderBy(asc(entries.capturedAt));
      if (dayEntries.length === 0) throw new ProblemException(409, "NO_ENTRIES", "The day has no entries.");
      const previous = await pendingDaysBefore(tx, siteId, localDate);
      if (previous.length > 0) {
        throw new ProblemException(409, "PREVIOUS_DAY_PENDING", "A previous day has no approved report.", previous.map((d) => ({ field: d, code: "REPORT_NOT_APPROVED" })));
      }
      const fresh = await this.assemble(site, localDate, dayEntries);
      const content = existing ? dropDanglingLinks(keepPhotoEdits(keepEdited(fresh, existing.content, existing.editedPaths), existing.content)) : fresh;
      const photosCount = new Set(dayEntries.flatMap((e) => e.photoMediaIds)).size;
      const leftOut = photosCount > MAX_PHOTOS ? `; ${photosCount - MAX_PHOTOS} foto(s) ficaram de fora porque o RDO leva no máximo ${MAX_PHOTOS}` : "";
      const history = [
        ...(existing?.history ?? []),
        { at: new Date().toISOString(), actor: "agent" as const, description: `RDO ${existing ? "remontado" : "montado"} a partir dos ${dayEntries.length} registros do dia${leftOut}` },
      ];
      const values = { content: content as unknown as Record<string, unknown>, siteSnapshot: content.site as unknown as Record<string, unknown>, status: useAi ? "generating" : "draft", history, updatedAt: new Date() };
      const [saved] = await tx
        .insert(reports)
        .values({ siteId, localDate, ...values })
        .onConflictDoUpdate({ target: [reports.siteId, reports.localDate], set: values })
        .returning();
      return { row: saved!, build: useAi };
    });
    if (build) void this.processing.buildReport(row.id);
    return row;
  }

  private requireReady(row: ReportRow) {
    if (row.status === "generating" && !this.processing.isStale(row.updatedAt)) {
      throw new ProblemException(409, "REPORT_NOT_READY", "The report is still being built.");
    }
  }

  async voiceCorrect(reportId: string, body: unknown) {
    const input = parse(z.strictObject({ audioMediaId: z.uuid(), section: z.string().min(1).optional() }), body);
    const row = await this.find(reportId);
    if (row.status === "approved") throw new ProblemException(409, "REPORT_ALREADY_APPROVED", "The report is already approved.");
    this.requireReady(row);
    await this.requireAudio(input.audioMediaId);
    this.requireAi();
    const [updated] = await this.db.update(reports).set({ status: "generating", updatedAt: new Date() }).where(eq(reports.id, row.id)).returning();
    void this.processing.voiceCorrection(row.id, input.audioMediaId, input.section ?? null);
    return updated!;
  }

  private async requireAudio(mediaId: string) {
    const audio = (await this.processing.mediaIds([mediaId]))[0];
    if (audio?.kind !== "audio") throw new ProblemException(400, "VALIDATION", "Audio not found.", [{ field: "audioMediaId", code: "INVALID" }]);
  }

  private requireAi() {
    if (!aiEnabled()) throw new ProblemException(409, "AI_DISABLED", "The AI is turned off in this environment.");
  }

  async find(reportId: string) {
    const [row] = uuid.safeParse(reportId).success ? await this.db.select().from(reports).where(eq(reports.id, reportId)) : [];
    if (!row) throw new ProblemException(404, "NOT_FOUND", "Report not found.");
    return row;
  }

  private validate(row: ReportRow) {
    const content = this.contentOf(row);
    const validation = checkReport(content);
    if (validation.structuralErrors.length > 0) {
      this.logger.error(`Report ${row.id} is structurally invalid: ${JSON.stringify(validation.structuralErrors)}`);
      throw new ProblemException(500, "UNAVAILABLE", "The report could not be built.");
    }
    return { content, validation };
  }

  private async reportOfQuestion(tx: Tx, q: typeof questions.$inferSelect) {
    let reportId = q.reportId;
    if (!reportId && q.entryId) {
      const [entry] = await tx.select({ siteId: entries.siteId, localDate: entries.localDate }).from(entries).where(eq(entries.id, q.entryId));
      const [day] = entry ? await tx.select({ id: reports.id }).from(reports).where(and(eq(reports.siteId, entry.siteId), eq(reports.localDate, entry.localDate))) : [];
      reportId = day?.id ?? null;
    }
    if (!reportId) return undefined;
    return (await tx.select().from(reports).where(eq(reports.id, reportId)).for("update"))[0];
  }

  private async applyAnswer(tx: Tx, q: typeof questions.$inferSelect, input: { optionId?: string; text?: string }) {
    const typed = input.optionId ?? input.text;
    if (typed === undefined || q.kind === "safety") return;
    const target = await this.reportOfQuestion(tx, q);
    if (!target || target.status === "approved") return;
    const before = this.contentOf(target) as unknown as Record<string, unknown>;
    const content = structuredClone(before);
    let description: string;
    if (q.kind === "open_item" && q.openItemId) {
      if (target.status !== "draft") return;
      const outcome = input.optionId ? (input.optionId as "close" | "keep" | "update") : "update";
      const reviews = ((content.openItemReviews as { openItemId: string; outcome: string; note: string | null }[] | undefined) ?? []).filter((r) => r.openItemId !== q.openItemId);
      reviews.push({ openItemId: q.openItemId, outcome, note: input.text ?? null });
      content.openItemReviews = reviews;
      description = `Respondeu sobre um item em aberto: ${q.text}`;
    } else if (q.reportId && q.field) {
      const serviceId = q.field.endsWith(".service") ? input.optionId : undefined;
      const type = fieldTypeAt(q.field);
      if (serviceId === undefined && (type === "object" || type === "array")) return;
      let value: unknown = typed;
      if (serviceId !== undefined) {
        const [svc] = uuid.safeParse(serviceId).success ? await tx.select().from(services).where(eq(services.id, serviceId)) : [];
        if (!svc) throw new ProblemException(400, "VALIDATION", "Unknown service.", [{ field: "optionId", code: "INVALID" }]);
        value = { id: svc.id, code: svc.code, description: svc.description, unit: svc.unit };
      } else if (input.text !== undefined) {
        value = textValue(input.text, q.field, type);
      }
      if (!setPath(content, q.field, value)) throw new ProblemException(400, "VALIDATION", "The answer does not fit the field.", [{ field: "optionId", code: "INVALID" }]);
      const check = checkReport(content);
      if (check.structuralErrors.length > 0) {
        throw new ProblemException(400, "VALIDATION", "The answer does not fit the field.", [{ field: input.optionId ? "optionId" : "text", code: "INVALID" }]);
      }
      description = `Respondeu: ${q.text}`;
    } else return;
    await tx
      .update(reports)
      .set({ content, editedPaths: mergeEdited(target.editedPaths, editedKeys(before, content)), history: [...target.history, { at: new Date().toISOString(), actor: "engineer", description }], updatedAt: new Date() })
      .where(eq(reports.id, target.id));
  }

  async answer(questionId: string, body: unknown) {
    const [row] = uuid.safeParse(questionId).success ? await this.db.select().from(questions).where(eq(questions.id, questionId)) : [];
    if (!row) throw new ProblemException(404, "NOT_FOUND", "Question not found.");
    const input = parse(
      z.strictObject({ optionId: z.string().optional(), text: z.string().min(1).optional(), audioMediaId: z.uuid().optional() }).refine((v) => Object.keys(v).length === 1, "One answer only."),
      body,
    );
    if (input.optionId && !row.options.some((o) => o.id === input.optionId)) {
      throw new ProblemException(400, "VALIDATION", "Unknown option.", [{ field: "optionId", code: "INVALID" }]);
    }
    if (input.audioMediaId) {
      await this.requireAudio(input.audioMediaId);
      this.requireAi();
    }
    const answer = { optionId: input.optionId ?? null, text: input.text ?? null, audioMediaId: input.audioMediaId ?? null, answeredAt: new Date().toISOString() };
    const updated = await this.db.transaction(async (tx) => {
      await this.applyAnswer(tx, row, input);
      const [q] = await tx.update(questions).set({ answer, status: "answered" }).where(eq(questions.id, row.id)).returning();
      return q;
    });
    if (input.audioMediaId) void this.processing.answerSpoken(row.id, input.audioMediaId);
    return {
      spoken: input.audioMediaId !== undefined,
      question: { id: updated!.id, kind: updated!.kind as Schemas["QuestionKind"], text: updated!.text, field: updated!.field, openItemId: updated!.openItemId, options: updated!.options, status: updated!.status as Schemas["QuestionStatus"], answer: updated!.answer },
    };
  }

  async approve(reportId: string, key: string | undefined) {
    if (!uuid.safeParse(key).success) {
      throw new ProblemException(400, "VALIDATION", "Idempotency-Key must be a UUID.", [{ field: "Idempotency-Key", code: key ? "INVALID" : "REQUIRED" }]);
    }
    const found = await this.find(reportId);
    return this.db.transaction(async (tx) => {
      await lockSite(tx, found.siteId);
      await lockDay(tx, found.siteId, found.localDate);
      const row = await this.lockReport(tx, reportId);
      if (row.status === "approved") {
        if (row.approvalKey === key) return row;
        throw new ProblemException(409, "REPORT_ALREADY_APPROVED", "The report is already approved.");
      }
      this.requireReady(row);
      const previous = await pendingDaysBefore(tx, row.siteId, row.localDate);
      if (previous.length > 0) {
        throw new ProblemException(409, "PREVIOUS_DAY_PENDING", "A previous day has no approved report.", previous.map((d) => ({ field: d, code: "REPORT_NOT_APPROVED" })));
      }
      const { content, validation } = this.validate(row);
      if (validation.missingFields.length > 0) {
        throw new ProblemException(409, "REPORT_INCOMPLETE", `${validation.missingFields.length} required field(s) are missing.`, validation.missingFields.map((m) => ({ field: m.path, code: m.code })));
      }
      const [{ next }] = (await tx.execute<{ next: number }>(sql`select coalesce(max(number), 0)::int + 1 as next from reports where site_id = ${row.siteId}`)).rows as [{ next: number }];
      const [approved] = await tx
        .update(reports)
        .set({
          status: "approved",
          number: next,
          content,
          approvedBy: env.ENGINEER_NAME,
          approvedAt: new Date(),
          approvalKey: key,
          history: [...row.history, { at: new Date().toISOString(), actor: "engineer", description: "RDO aprovado" }],
          updatedAt: new Date(),
        })
        .where(eq(reports.id, row.id))
        .returning();
      await this.openItemsService.applyApproval(tx, { siteId: row.siteId, reportId: row.id, localDate: row.localDate, reviews: content.openItemReviews, newItems: content.newOpenItems });
      return approved!;
    });
  }

  async view(row: ReportRow): Promise<Schemas["Report"]> {
    const { content, validation } = this.validate(row);
    const [{ count }] = (await this.db.execute<{ count: number }>(sql`select count(*)::int as count from entries where site_id = ${row.siteId} and local_date = ${row.localDate}`)).rows as [{ count: number }];
    let number = row.number;
    if (number === null) {
      const [{ next }] = (await this.db.execute<{ next: number }>(sql`select coalesce(max(number), 0)::int + 1 as next from reports where site_id = ${row.siteId}`)).rows as [{ next: number }];
      number = next;
    }
    const questionRows = await this.db.select().from(questions).where(eq(questions.reportId, row.id)).orderBy(asc(questions.createdAt));
    const history = row.history;
    return {
      ...content,
      id: row.id,
      siteId: row.siteId,
      number,
      status: row.status as Schemas["ReportStatus"],
      entriesCount: count,
      questions: questionRows.map((q) => ({
        id: q.id,
        kind: q.kind as Schemas["QuestionKind"],
        text: q.text,
        field: q.field,
        openItemId: q.openItemId,
        options: q.options,
        status: q.status as Schemas["QuestionStatus"],
        answer: q.answer,
      })),
      missingFields: validation.missingFields.map((m) => ({ field: m.path, questionId: null })),
      photoRequirements: validation.missingFields.flatMap((m): Schemas["Report"]["photoRequirements"] => {
        const [kind, index] = m.path.split(".");
        if (m.code !== "PHOTO_REQUIRED" || index === undefined) return [];
        if (kind === "activities") {
          const a = content.activities[Number(index)];
          return a ? [{ linkedTo: { type: "activity" as const, id: a.id }, label: a.description }] : [];
        }
        const o = content.occurrences[Number(index)];
        return o ? [{ linkedTo: { type: "occurrence" as const, id: o.id }, label: o.description }] : [];
      }),
      approval: row.approvedAt && row.approvedBy ? { approvedBy: row.approvedBy, approvedAt: row.approvedAt.toISOString() } : null,
      history,
      pdfUrl: row.status === "approved" ? `${env.API_PUBLIC_URL}/v1/reports/${row.id}/pdf` : null,
    };
  }
}
