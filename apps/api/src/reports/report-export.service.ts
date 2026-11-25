import { Inject, Injectable } from "@nestjs/common";
import { and, asc, desc, eq, lt, or } from "drizzle-orm";
import type { Schemas } from "@argos/contract";
import { z } from "zod";
import { ProblemException } from "../common/problem.js";
import { DB, type Database } from "../database/database.module.js";
import { entries, reports } from "../database/schema.js";
import { SitesService } from "../sites/sites.service.js";
import { StorageService } from "../storage/storage.service.js";
import { buildReportPdf, reportFileName } from "./report-pdf.js";
import { ReportsService } from "./reports.service.js";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const DEFAULT_TIMEZONE = "America/Sao_Paulo";

interface Cursor {
  d: string;
  id: string;
}

const cursorSchema = z.object({ d: z.iso.date(), id: z.uuid() });

function decodeCursor(value: string | undefined): Cursor | null {
  if (!value) return null;
  let decoded: unknown = null;
  try {
    decoded = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
  } catch {
    decoded = null;
  }
  const parsed = cursorSchema.safeParse(decoded);
  if (!parsed.success) throw new ProblemException(400, "VALIDATION", "Invalid cursor.", [{ field: "cursor", code: "INVALID" }]);
  return parsed.data;
}

@Injectable()
export class ReportExportService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly sites: SitesService,
    private readonly storage: StorageService,
    private readonly reportsService: ReportsService,
  ) {}

  async list(siteId: string, query: { status?: string; limit?: string; cursor?: string }): Promise<{ items: Schemas["ReportListItem"][]; nextCursor: string | null }> {
    await this.sites.requireSite(siteId);
    if (query.status !== undefined && query.status !== "approved") {
      throw new ProblemException(400, "VALIDATION", "Only status=approved is supported.", [{ field: "status", code: "INVALID" }]);
    }
    const parsedLimit = query.limit === undefined ? DEFAULT_LIMIT : Number(query.limit);
    if (!Number.isInteger(parsedLimit) || parsedLimit < 1) {
      throw new ProblemException(400, "VALIDATION", "Invalid limit.", [{ field: "limit", code: "INVALID" }]);
    }
    const limit = Math.min(parsedLimit, MAX_LIMIT);
    const cursor = decodeCursor(query.cursor);
    const rows = await this.db
      .select()
      .from(reports)
      .where(
        and(
          eq(reports.siteId, siteId),
          eq(reports.status, "approved"),
          cursor ? or(lt(reports.localDate, cursor.d), and(eq(reports.localDate, cursor.d), lt(reports.id, cursor.id))) : undefined,
        ),
      )
      .orderBy(desc(reports.localDate), desc(reports.id))
      .limit(limit + 1);
    const page = rows.slice(0, limit);
    const last = page.at(-1);
    return {
      items: page.map((r) => ({
        id: r.id,
        number: r.number ?? 0,
        localDate: r.localDate,
        status: r.status as Schemas["ReportStatus"],
        approvedAt: (r.approvedAt ?? r.updatedAt).toISOString(),
        occurrencesCount: Array.isArray(r.content.occurrences) ? r.content.occurrences.length : 0,
      })),
      nextCursor: rows.length > limit && last ? Buffer.from(JSON.stringify({ d: last.localDate, id: last.id } satisfies Cursor)).toString("base64url") : null,
    };
  }

  async pdf(reportId: string) {
    const row = await this.reportsService.find(reportId);
    if (row.status !== "approved") throw new ProblemException(409, "REPORT_NOT_APPROVED", "Only approved reports have a PDF.");
    const report = await this.reportsService.view(row);
    const [first] = await this.db
      .select({ timezone: entries.timezone })
      .from(entries)
      .where(and(eq(entries.siteId, row.siteId), eq(entries.localDate, row.localDate)))
      .orderBy(asc(entries.capturedAt))
      .limit(1);
    const bytes = await buildReportPdf(report, first?.timezone ?? DEFAULT_TIMEZONE, async (mediaId) => {
      const data = await this.storage.read("media", mediaId).catch(() => null);
      return data ? { bytes: data } : null;
    });
    return { bytes, fileName: reportFileName(report) };
  }
}
