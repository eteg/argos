import { LIMITS, blockingFields, findMissingFields, reportContentSchema, type SiteType } from "@argos/rdo-schema";
import { Body, Controller, Get, HttpCode, Inject, NotFoundException, Param, ParseUUIDPipe, Patch, Post } from "@nestjs/common";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/db";
import { entries, reports } from "../db/schema";
import { MeController } from "../me.controller";
import { ProblemException } from "../problem.filter";
import { findSite } from "../sites/sites.controller";
import { parse } from "../validation";
import { RdoService } from "./rdo.service";

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
  if (photoIds.length < LIMITS.minPhotosPerReport) missingFields.push({ field: "photos", questionId: null });
  return {
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
    const questions = report.questions.map((q) => (q.status === "open" && q.field && !filled.has(q.field) ? { ...q, status: "answered" as const } : q));
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
    const { text } = parse(z.object({ text: z.string().min(1) }), body);
    const [report] = await db
      .select()
      .from(reports)
      .where(sql`${reports.questions} @> ${JSON.stringify([{ id: questionId }])}::jsonb`);
    if (!report) throw new NotFoundException("Question not found");
    if (report.status === "approved") throw new ProblemException(409, "REPORT_ALREADY_APPROVED", "Report already approved");
    await this.rdo.applyAnswer(report.id, questionId, text);
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
    return toReport(row!);
  }
}
