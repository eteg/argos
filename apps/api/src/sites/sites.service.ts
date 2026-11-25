import { randomUUID } from "node:crypto";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import type { Schemas } from "@argos/contract";
import { daysBetween, distanceMeters, localDateOf } from "../common/locale.js";
import { ProblemException } from "../common/problem.js";
import { parse } from "../common/validate.js";
import { DB, type Database } from "../database/database.module.js";
import { documents, entries, equipment, reports, sites, type PublicContractRow } from "../database/schema.js";
import { StorageService } from "../storage/storage.service.js";
import { createSiteSchema, siteStatus, updateSiteSchema, uuid } from "./sites.schemas.js";
import type { z } from "zod";

type SiteRow = typeof sites.$inferSelect;
type DeviceLocation = { lat: number; lng: number } | null;

@Injectable()
export class SitesService {
  private readonly logger = new Logger(SitesService.name);

  constructor(
    @Inject(DB) readonly db: Database,
    private readonly storage: StorageService,
  ) {}

  async requireSite(siteId: string) {
    const [row] = uuid.safeParse(siteId).success ? await this.db.select().from(sites).where(eq(sites.id, siteId)) : [];
    if (!row) throw new ProblemException(404, "NOT_FOUND", "Site not found.");
    return row;
  }

  private location(row: { lat: number | null; lng: number | null; accuracyMeters: number | null }): Schemas["Location"] | null {
    return row.lat === null || row.lng === null ? null : { lat: row.lat, lng: row.lng, accuracyMeters: row.accuracyMeters };
  }

  publicContract(contract: PublicContractRow | null, today: string): Schemas["PublicContract"] | null {
    if (!contract) return null;
    const added = contract.amendments.reduce((sum, a) => sum + a.addedDays, 0);
    const elapsedDays = Math.max(0, daysBetween(contract.serviceOrderDate, today));
    return { ...contract, elapsedDays, remainingDays: contract.durationDays + added - elapsedDays };
  }

  async toSite(row: SiteRow, timezone: string): Promise<Schemas["Site"]> {
    const [equipmentRows, documentRows] = await Promise.all([
      this.db.select().from(equipment).where(eq(equipment.siteId, row.id)).orderBy(asc(equipment.createdAt)),
      this.db.select().from(documents).where(eq(documents.siteId, row.id)).orderBy(asc(documents.createdAt)),
    ]);
    return {
      id: row.id,
      name: row.name,
      type: row.type as Schemas["SiteType"],
      status: row.status as Schemas["SiteStatus"],
      statusChangedOn: row.statusChangedOn,
      address: row.address,
      location: this.location(row),
      client: { name: row.clientName, taxId: row.clientTaxId },
      contractor: { name: row.contractorName, taxId: row.contractorTaxId },
      technicalManager: { name: row.technicalManagerName, artNumber: row.technicalManagerArtNumber },
      publicContract: this.publicContract(row.publicContract, localDateOf(new Date(), timezone)),
      servicesCount: await this.servicesCount(row.id),
      servicesFileName: row.servicesFileName,
      equipment: equipmentRows.map((e) => ({ id: e.id, name: e.name, identifier: e.identifier })),
      documents: documentRows.map((d) => ({
        id: d.id,
        fileName: d.fileName,
        type: d.type as Schemas["DocumentType"],
        url: this.storage.url("documents", d.id),
      })),
      createdAt: row.createdAt.toISOString(),
    };
  }

  private async servicesCount(siteId: string) {
    const result = await this.db.execute<{ count: number }>(sql`select count(*)::int as count from services where site_id = ${siteId}`);
    return result.rows[0]?.count ?? 0;
  }

  async dayStats(siteIds: string[], timezone: string) {
    const today = localDateOf(new Date(), timezone);
    const rows = siteIds.length
      ? await this.db
          .select({
            siteId: entries.siteId,
            localDate: entries.localDate,
            count: sql<number>`count(*)::int`,
            offline: sql<boolean>`bool_or(${entries.offline})`,
          })
          .from(entries)
          .where(inArray(entries.siteId, siteIds))
          .groupBy(entries.siteId, entries.localDate)
      : [];
    const reportRows = siteIds.length
      ? await this.db
          .select({ siteId: reports.siteId, localDate: reports.localDate, id: reports.id, status: reports.status })
          .from(reports)
          .where(inArray(reports.siteId, siteIds))
      : [];
    const approved = new Set(reportRows.filter((r) => r.status === "approved").map((r) => `${r.siteId}|${r.localDate}`));
    return { today, rows, openRows: rows.filter((r) => !approved.has(`${r.siteId}|${r.localDate}`)), reports: reportRows };
  }

  summarize(
    row: SiteRow,
    stats: Awaited<ReturnType<SitesService["dayStats"]>>,
    servicesCount: number,
    device: DeviceLocation,
  ): Schemas["SiteSummary"] {
    const mine = stats.rows.filter((r) => r.siteId === row.id);
    const todayRow = mine.find((r) => r.localDate === stats.today);
    const todayReport = stats.reports.find((r) => r.siteId === row.id && r.localDate === stats.today);
    const entriesCount = todayRow?.count ?? 0;
    const dayState: Schemas["DayState"] =
      todayReport?.status === "approved" ? "approved" : todayReport?.status === "draft" ? "draft" : entriesCount > 0 ? "in_progress" : "no_entries";
    const location = this.location(row);
    return {
      id: row.id,
      name: row.name,
      type: row.type as Schemas["SiteType"],
      status: row.status as Schemas["SiteStatus"],
      statusChangedOn: row.statusChangedOn,
      address: row.address,
      location,
      servicesCount,
      distanceMeters: device && location ? distanceMeters(device, location) : null,
      today: {
        localDate: stats.today,
        state: dayState,
        entriesCount,
        reportId: todayReport?.id ?? null,
      },
      pendingDays: stats.openRows
        .filter((r) => r.siteId === row.id)
        .filter((r) => r.offline && r.localDate < stats.today)
        .sort((a, b) => a.localDate.localeCompare(b.localDate))
        .map((r) => ({ localDate: r.localDate, entriesCount: r.count })),
      openItemsCount: 0,
    };
  }

  async list(timezone: string, device: DeviceLocation, statusParam?: string, search?: string): Promise<{ items: Schemas["SiteSummary"][] }> {
    const statuses = (statusParam ?? "in_progress").split(",").map((s) => s.trim());
    parse(siteStatus.array().min(1), statuses);
    const rows = await this.db
      .select()
      .from(sites)
      .where(
        and(
          inArray(sites.status, statuses),
          search ? sql`${sites.name} ilike ${"%" + search.replaceAll(/[%_\\]/g, "\\$&") + "%"}` : undefined,
        ),
      );
    const stats = await this.dayStats(rows.map((r) => r.id), timezone);
    const counts = await this.db.execute<{ site_id: string; count: number }>(
      sql`select site_id, count(*)::int as count from services group by site_id`,
    );
    const countBySite = new Map(counts.rows.map((r) => [r.site_id, r.count]));
    const items = rows.map((row) => this.summarize(row, stats, countBySite.get(row.id) ?? 0, device));
    items.sort((a, b) => (a.distanceMeters ?? Infinity) - (b.distanceMeters ?? Infinity) || a.name.localeCompare(b.name));
    return { items };
  }

  async summaryOf(row: SiteRow, timezone: string, device: DeviceLocation = null) {
    const stats = await this.dayStats([row.id], timezone);
    return this.summarize(row, stats, await this.servicesCount(row.id), device);
  }

  private async approvedReports(siteId: string): Promise<Pick<Schemas["SiteDetail"], "recentReports" | "approvedReportsCount">> {
    const approved = and(eq(reports.siteId, siteId), eq(reports.status, "approved"));
    const recent = await this.db.select().from(reports).where(approved).orderBy(desc(reports.localDate)).limit(3);
    const [{ count }] = (await this.db.execute<{ count: number }>(sql`select count(*)::int as count from reports where site_id = ${siteId} and status = 'approved'`)).rows as [{ count: number }];
    return {
      recentReports: recent.map((r) => ({
        id: r.id,
        number: r.number ?? 0,
        localDate: r.localDate,
        approvedAt: (r.approvedAt ?? r.updatedAt).toISOString(),
        occurrencesCount: Array.isArray(r.content.occurrences) ? r.content.occurrences.length : 0,
      })),
      approvedReportsCount: count,
    };
  }

  async detail(row: SiteRow, timezone: string): Promise<Schemas["SiteDetail"]> {
    const summary = await this.summaryOf(row, timezone);
    return {
      ...(await this.toSite(row, timezone)),
      today: summary.today,
      pendingDays: summary.pendingDays,
      openItems: [],
      ...(await this.approvedReports(row.id)),
    };
  }

  private contractRow(input: z.infer<typeof createSiteSchema>["publicContract"]): PublicContractRow | null {
    if (!input) return null;
    return {
      ...input,
      amendments: (input.amendments ?? []).map((a) => ({ id: randomUUID(), ...a })),
    };
  }

  private requirePublicContract(type: string, contract: unknown) {
    if (type !== "private" && !contract) {
      throw new ProblemException(400, "VALIDATION", "Public contract is required.", [{ field: "publicContract", code: "REQUIRED" }]);
    }
  }

  private async geocode(address: string): Promise<{ lat: number; lng: number } | null> {
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(address)}`, {
        headers: { "User-Agent": "argos-api" },
        signal: AbortSignal.timeout(4000),
      });
      const [hit] = (await response.json()) as { lat: string; lon: string }[];
      return hit ? { lat: Number(hit.lat), lng: Number(hit.lon) } : null;
    } catch (error) {
      this.logger.warn(`Geocoding failed: ${String(error)}`);
      return null;
    }
  }

  async create(body: unknown, timezone: string) {
    const input = parse(createSiteSchema, body);
    this.requirePublicContract(input.type, input.publicContract);
    const point = input.location ?? (await this.geocode(input.address));
    const [row] = await this.db
      .insert(sites)
      .values({
        name: input.name,
        type: input.type,
        address: input.address,
        lat: point?.lat ?? null,
        lng: point?.lng ?? null,
        accuracyMeters: input.location?.accuracyMeters ?? null,
        clientName: input.client.name,
        clientTaxId: input.client.taxId,
        contractorName: input.contractor.name,
        contractorTaxId: input.contractor.taxId,
        technicalManagerName: input.technicalManager.name,
        technicalManagerArtNumber: input.technicalManager.artNumber,
        publicContract: input.type === "private" ? null : this.contractRow(input.publicContract),
        statusChangedOn: localDateOf(new Date(), timezone),
      })
      .returning();
    return this.toSite(row!, timezone);
  }

  async update(siteId: string, body: unknown, timezone: string) {
    const current = await this.requireSite(siteId);
    const input = parse(updateSiteSchema, body);
    const type = input.type ?? current.type;
    this.requirePublicContract(type, input.publicContract ?? current.publicContract);
    const addressChanged = input.address !== undefined && input.address !== current.address;
    const point = input.location ?? (addressChanged && !input.location ? await this.geocode(input.address!) : null);
    const [row] = await this.db
      .update(sites)
      .set({
        ...(input.name !== undefined && { name: input.name }),
        ...(input.type !== undefined && { type: input.type }),
        ...(input.address !== undefined && { address: input.address }),
        ...(point && { lat: point.lat, lng: point.lng, accuracyMeters: input.location?.accuracyMeters ?? null }),
        ...(input.client && { clientName: input.client.name, clientTaxId: input.client.taxId }),
        ...(input.contractor && { contractorName: input.contractor.name, contractorTaxId: input.contractor.taxId }),
        ...(input.technicalManager && {
          technicalManagerName: input.technicalManager.name,
          technicalManagerArtNumber: input.technicalManager.artNumber,
        }),
        ...(type === "private"
          ? { publicContract: null }
          : input.publicContract
            ? { publicContract: this.contractRow(input.publicContract) }
            : {}),
      })
      .where(eq(sites.id, siteId))
      .returning();
    return this.toSite(row!, timezone);
  }

  async changeStatus(siteId: string, status: Schemas["SiteStatus"], timezone: string) {
    const current = await this.requireSite(siteId);
    if (status === "completed") {
      const stats = await this.dayStats([siteId], timezone);
      if (stats.openRows.length > 0) {
        const days = stats.openRows.map((r) => r.localDate).sort();
        throw new ProblemException(
          409,
          "SITE_HAS_OPEN_REPORTS",
          `${days.length} day(s) have no approved report.`,
          days.map((d) => ({ field: d, code: "REPORT_NOT_APPROVED" })),
        );
      }
    }
    const changed = current.status !== status;
    const [row] = await this.db
      .update(sites)
      .set({ status, ...(changed && { statusChangedOn: localDateOf(new Date(), timezone) }) })
      .where(eq(sites.id, siteId))
      .returning();
    return this.toSite(row!, timezone);
  }
}
