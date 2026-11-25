import { Inject, Injectable, Logger } from "@nestjs/common";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { validateReport } from "@argos/rdo-schema";
import type { Schemas } from "@argos/contract";
import { ProblemException } from "../common/problem.js";
import { DB, type Database } from "../database/database.module.js";
import { entries, equipment, media, questions, reports, sites } from "../database/schema.js";
import { SitesService } from "../sites/sites.service.js";
import { uuid } from "../sites/sites.schemas.js";
import { StorageService } from "../storage/storage.service.js";

type ReportRow = typeof reports.$inferSelect;
type Content = Omit<
  Schemas["Report"],
  "id" | "siteId" | "number" | "status" | "entriesCount" | "questions" | "missingFields" | "photoRequirements" | "approval" | "history" | "pdfUrl"
>;

const MIN_PHOTOS = 3;
const MAX_PHOTOS = 20;

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly sitesService: SitesService,
    private readonly storage: StorageService,
  ) {}

  private async assemble(site: typeof sites.$inferSelect, localDate: string, dayEntries: (typeof entries.$inferSelect)[]): Promise<Content> {
    const equipmentRows = await this.db.select().from(equipment).where(eq(equipment.siteId, site.id)).orderBy(asc(equipment.createdAt));
    const photoIds = dayEntries.flatMap((e) => e.photoMediaIds);
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

  async generate(siteId: string, localDate: string) {
    const site = await this.sitesService.requireSite(siteId);
    const [existing] = await this.db.select().from(reports).where(and(eq(reports.siteId, siteId), eq(reports.localDate, localDate)));
    if (existing?.status === "approved") throw new ProblemException(409, "REPORT_ALREADY_APPROVED", "The report of the day is already approved.");
    const dayEntries = await this.db.select().from(entries).where(and(eq(entries.siteId, siteId), eq(entries.localDate, localDate))).orderBy(asc(entries.capturedAt));
    if (dayEntries.length === 0) throw new ProblemException(409, "NO_ENTRIES", "The day has no entries.");
    const previous = await this.db.execute<{ local_date: string }>(sql`
      select distinct e.local_date::text as local_date from entries e
      where e.site_id = ${siteId} and e.local_date < ${localDate}
        and not exists (select 1 from reports r where r.site_id = e.site_id and r.local_date = e.local_date and r.status = 'approved')
      order by 1`);
    if (previous.rows.length > 0) {
      throw new ProblemException(409, "PREVIOUS_DAY_PENDING", "A previous day has no approved report.", previous.rows.map((r) => ({ field: r.local_date, code: "REPORT_NOT_APPROVED" })));
    }
    const content = await this.assemble(site, localDate, dayEntries);
    const values = { content: content as unknown as Record<string, unknown>, siteSnapshot: content.site as unknown as Record<string, unknown>, status: "draft", updatedAt: new Date() };
    const [row] = existing
      ? await this.db.update(reports).set(values).where(eq(reports.id, existing.id)).returning()
      : await this.db.insert(reports).values({ siteId, localDate, ...values }).returning();
    return row!;
  }

  async find(reportId: string) {
    const [row] = uuid.safeParse(reportId).success ? await this.db.select().from(reports).where(eq(reports.id, reportId)) : [];
    if (!row) throw new ProblemException(404, "NOT_FOUND", "Report not found.");
    return row;
  }

  async view(row: ReportRow): Promise<Schemas["Report"]> {
    const content = row.content as unknown as Content;
    const [site] = await this.db.select({ type: sites.type }).from(sites).where(eq(sites.id, row.siteId));
    const [{ count }] = (await this.db.execute<{ count: number }>(sql`select count(*)::int as count from entries where site_id = ${row.siteId} and local_date = ${row.localDate}`)).rows as [{ count: number }];
    let number = row.number;
    if (number === null) {
      const [{ next }] = (await this.db.execute<{ next: number }>(sql`select coalesce(max(number), 0)::int + 1 as next from reports where site_id = ${row.siteId}`)).rows as [{ next: number }];
      number = next;
    }
    const validation = validateReport(content, { siteType: (site?.type ?? "private") as Schemas["SiteType"], minPhotosPerReport: MIN_PHOTOS, maxPhotosPerReport: MAX_PHOTOS });
    if (validation.structuralErrors.length > 0) {
      this.logger.error(`Report ${row.id} is structurally invalid: ${JSON.stringify(validation.structuralErrors)}`);
      throw new ProblemException(500, "UNAVAILABLE", "The report could not be built.");
    }
    const questionRows = await this.db.select().from(questions).where(eq(questions.reportId, row.id)).orderBy(asc(questions.createdAt));
    const history: Schemas["Report"]["history"] = [{ at: row.updatedAt.toISOString(), actor: "agent", description: `RDO montado a partir dos ${count} registros do dia` }];
    if (row.approvedAt) history.push({ at: row.approvedAt.toISOString(), actor: "engineer", description: "RDO aprovado" });
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
      photoRequirements: [],
      approval: row.approvedAt && row.approvedBy ? { approvedBy: row.approvedBy, approvedAt: row.approvedAt.toISOString() } : null,
      history,
      pdfUrl: null,
    };
  }
}
