import { LIMITS, blockingFields, findMissingFields, reportContentSchema, type SiteType } from "@argos/rdo-schema";
import { Body, Controller, Get, HttpCode, Inject, NotFoundException, Param, ParseUUIDPipe, Patch, Post } from "@nestjs/common";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/db";
import { entries, openItems, reports } from "../db/schema";
import { openItemsBefore, openItemsOfDay } from "../open-items/open-items";
import { MeController } from "../me.controller";
import { ProblemException } from "../problem.filter";
import { findSite } from "../sites/sites.controller";
import { parse } from "../validation";
import { OPEN_ITEM_OPTIONS, RdoService } from "./rdo.service";

type ReportRow = typeof reports.$inferSelect;

async function findReport(reportId: string) {
  const [row] = await db.select().from(reports).where(eq(reports.id, reportId));
  if (!row) throw new NotFoundException("Report not found");
  return row;
}

async function dayPhotos(report: ReportRow) {
  const rows = await db
    .select({ photoMediaIds: entries.photoMediaIds, id: entries.id })
    .from(entries)
    .where(and(eq(entries.siteId, report.siteId), eq(entries.localDate, report.localDate)));
  return { entriesCount: rows.length, photoIds: rows.flatMap((r) => r.photoMediaIds) };
}

async function toReport(row: ReportRow) {
  const { entriesCount, photoIds } = await dayPhotos(row);
  const siteType = row.site.type as SiteType;
  const missingFields = row.content
    ? findMissingFields(row.content, siteType, { hasServices: false })
        .filter((f) => f.level !== "recommended")
        .map((f) => ({ field: f.field, questionId: row.questions.find((q) => q.field === f.field && q.status === "open")?.id ?? null }))
    : [];
  // F1RN09: todo item que veio dos dias anteriores precisa de desfecho antes de aprovar.
  const previous = row.status === "approved" ? [] : await openItemsOfDay(row.siteId, row.localDate);
  if (row.content) {
    for (const item of previous) {
      if (row.content.openItemReviews.some((r) => r.openItemId === item.id)) continue;
      missingFields.push({
        field: `openItemReviews.${item.id}`,
        questionId: row.questions.find((q) => q.openItemId === item.id && q.status === "open")?.id ?? null,
      });
    }
  }
  if (photoIds.length < LIMITS.minPhotosPerReport) missingFields.push({ field: "photos", questionId: null });
  return {
    openItems: previous,
    id: row.id,
    siteId: row.siteId,
    number: row.number,
    localDate: row.localDate,
    status: row.status,
    entriesCount,
    site: row.site,
    ...(row.content ?? {}),
    photos: photoIds.map((id) => ({ id, url: `/v1/media/${id}/file` })),
    photoRequirements: [],
    questions: row.questions.filter((q) => q.status === "open"),
    missingFields,
    approval: row.approval ?? null,
    history: row.history,
    error: row.error,
    pdfUrl: null,
  };
}

@Controller()
export class ReportsController {
  constructor(@Inject(RdoService) private readonly rdo: RdoService) {}

  @Post("sites/:siteId/days/:localDate/report")
  @HttpCode(202)
  async generateReport(@Param("siteId", ParseUUIDPipe) siteId: string, @Param("localDate") localDate: string) {
    parse(z.iso.date(), localDate);
    const site = await findSite(siteId);
    const [existing] = await db
      .select()
      .from(reports)
      .where(and(eq(reports.siteId, siteId), eq(reports.localDate, localDate)));
    if (existing?.status === "approved") throw new ProblemException(409, "REPORT_ALREADY_APPROVED", "Report already approved");
    const [{ n } = { n: 0 }] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(entries)
      .where(and(eq(entries.siteId, siteId), eq(entries.localDate, localDate)));
    if (n === 0) throw new ProblemException(409, "NO_ENTRIES", "The day has no entries");
    const id = await this.rdo.startReport(site, localDate);
    return { id, status: "generating" };
  }

  @Get("reports/:reportId")
  async getReport(@Param("reportId", ParseUUIDPipe) reportId: string) {
    return toReport(await findReport(reportId));
  }

  // Correção à mão: troca blocos inteiros do conteúdo e entra no histórico.
  @Patch("reports/:reportId")
  async updateReport(@Param("reportId", ParseUUIDPipe) reportId: string, @Body() body: unknown) {
    const report = await findReport(reportId);
    if (report.status === "approved") throw new ProblemException(409, "REPORT_ALREADY_APPROVED", "Report already approved");
    if (!report.content) throw new ProblemException(409, "REPORT_NOT_READY", "Report is still being generated");
    const patch = parse(reportContentSchema.partial(), body);
    const content = parse(reportContentSchema, { ...report.content, ...patch });
    const filled = new Set(
      findMissingFields(content, report.site.type as SiteType, { hasServices: false }).map((f) => f.field),
    );
    const reviewed = new Set(content.openItemReviews.map((r) => r.openItemId));
    const questions = report.questions.map((q) =>
      q.status === "open" && (q.openItemId ? reviewed.has(q.openItemId) : q.field && !filled.has(q.field))
        ? { ...q, status: "answered" as const }
        : q,
    );
    const [row] = await db
      .update(reports)
      .set({
        content,
        questions,
        history: [...report.history, { at: new Date().toISOString(), actor: "engineer", description: `Corrigiu ${Object.keys(patch).join(", ")}` }],
      })
      .where(eq(reports.id, reportId))
      .returning();
    return toReport(row!);
  }

  @Post("questions/:questionId/answer")
  async answerQuestion(@Param("questionId", ParseUUIDPipe) questionId: string, @Body() body: unknown) {
    const { text, optionId } = parse(
      z.object({ text: z.string().min(1).optional(), optionId: z.enum(["close", "keep"]).optional() }).refine((b) => b.text || b.optionId, {
        message: "text or optionId is required",
      }),
      body,
    );
    const [report] = await db
      .select()
      .from(reports)
      .where(sql`${reports.questions} @> ${JSON.stringify([{ id: questionId }])}::jsonb`);
    if (!report) throw new NotFoundException("Question not found");
    if (report.status === "approved") throw new ProblemException(409, "REPORT_ALREADY_APPROVED", "Report already approved");
    const question = report.questions.find((q) => q.id === questionId)!;
    if (optionId && question.openItemId && report.content) {
      // Resposta pronta não precisa da IA: vira o desfecho do item.
      const label = OPEN_ITEM_OPTIONS.find((o) => o.id === optionId)!.label;
      const now = new Date().toISOString();
      await db
        .update(reports)
        .set({
          content: {
            ...report.content,
            openItemReviews: [
              ...report.content.openItemReviews.filter((r) => r.openItemId !== question.openItemId),
              { openItemId: question.openItemId, outcome: optionId, note: label },
            ],
          },
          questions: report.questions.map((q) =>
            q.id === questionId ? { ...q, status: "answered" as const, answer: { optionId, text: null, audioMediaId: null, answeredAt: now } } : q,
          ),
          history: [...report.history, { at: now, actor: "engineer", description: `Respondeu: ${question.text} → ${label}` }],
        })
        .where(eq(reports.id, report.id));
    } else {
      await this.rdo.applyAnswer(report.id, questionId, text ?? optionId!);
    }
    return toReport(await findReport(report.id));
  }

  // RG04, RG06, F1RN05: só aprova sem campo obrigatório vazio, com responsável, data e hora.
  @Post("reports/:reportId/approve")
  async approveReport(@Param("reportId", ParseUUIDPipe) reportId: string) {
    const report = await findReport(reportId);
    if (report.status === "approved") return toReport(report);
    if (!report.content) throw new ProblemException(409, "REPORT_NOT_READY", "Report is still being generated");
    const errors = blockingFields(report.content, report.site.type as SiteType, { hasServices: false }).map((f) => ({
      field: f.field,
      code: "REQUIRED",
    }));
    const { photoIds } = await dayPhotos(report);
    if (photoIds.length < LIMITS.minPhotosPerReport) errors.push({ field: "photos", code: "MIN_PHOTOS" });
    const previous = await openItemsBefore(report.siteId, report.localDate);
    const reviews = new Map(report.content.openItemReviews.map((r) => [r.openItemId, r]));
    for (const item of previous) {
      if (!reviews.has(item.id)) errors.push({ field: `openItemReviews.${item.id}`, code: "OUTCOME_REQUIRED" });
    }
    if (errors.length > 0) throw new ProblemException(409, "REPORT_INCOMPLETE", "Report has missing fields", { errors });
    const approvedBy = new MeController().getMe().title;
    const approvedAt = new Date().toISOString();
    const [row] = await db
      .update(reports)
      .set({
        status: "approved",
        approval: { approvedBy, approvedAt },
        history: [...report.history, { at: approvedAt, actor: "engineer", description: `Aprovado por ${approvedBy}` }],
      })
      .where(eq(reports.id, reportId))
      .returning();
    // F1RN09, F1RN11: os desfechos e os itens novos só entram na memória agora.
    for (const item of previous) {
      const review = reviews.get(item.id)!;
      const note = review.note ?? "";
      if (review.outcome === "close") {
        await db
          .update(openItems)
          .set({ status: "closed", closedOn: report.localDate, closingNote: note })
          .where(eq(openItems.id, item.id));
      } else if (review.outcome === "update" || note) {
        await db.update(openItems).set({ lastUpdate: { localDate: report.localDate, note } }).where(eq(openItems.id, item.id));
      }
    }
    const tracked = report.content.newOpenItems.filter((n) => n.track);
    if (tracked.length > 0) {
      await db.insert(openItems).values(
        tracked.map((n) => ({
          siteId: report.siteId,
          title: n.title,
          kind: n.kind,
          status: "open",
          openedOn: report.localDate,
          openedInReportId: report.id,
        })),
      );
    }
    return toReport(row!);
  }
}
