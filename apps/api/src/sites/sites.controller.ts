import { Body, Controller, Delete, Get, Headers, HttpCode, NotFoundException, Param, ParseUUIDPipe, Patch, Post, Put, Query } from "@nestjs/common";
import { and, count, desc, eq, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "../db/db";
import { entries, openItems, reports, sites } from "../db/schema";
import { deleteMedia, removeFiles } from "../media/media.controller";
import { toOpenItem } from "../open-items/open-items";
import { ProblemException } from "../problem.filter";
import { locationSchema, parse, todayIn } from "../validation";

const siteStatus = z.enum(["not_started", "in_progress", "paused", "completed"]);
const party = z.object({ name: z.string().min(1), taxId: z.string().nullable().optional().transform((v) => v ?? null) });

const siteInput = z
  .object({
    name: z.string().min(1),
    type: z.enum(["private", "public", "financed"]),
    address: z.string().nullable().optional(),
    location: locationSchema.nullable().optional(),
    client: party.nullable().optional(),
    contractor: party.nullable().optional(),
    technicalManager: z
      .object({ name: z.string().min(1), artNumber: z.string().nullable().optional().transform((v) => v ?? null) })
      .nullable()
      .optional(),
    publicContract: z
      .object({
        number: z.string().min(1),
        commitmentOrAgreement: z.string().nullable().optional().transform((v) => v ?? null),
        inspectorName: z.string().nullable().optional().transform((v) => v ?? null),
        serviceOrderDate: z.iso.date(),
        durationDays: z.number().int().positive(),
        amendments: z
          .array(z.object({ id: z.string(), description: z.string(), addedDays: z.number().int(), signedOn: z.iso.date() }))
          .default([]),
      })
      .nullable()
      .optional(),
    equipment: z
      .array(z.object({ name: z.string().min(1), identifier: z.string().nullable().optional() }))
      .default([]),
  })
  .refine((s) => s.type === "private" || s.publicContract, {
    path: ["publicContract"],
    message: "Required for public and financed sites",
  });

type SiteRow = typeof sites.$inferSelect;

const daysBetween = (from: string, to: string) => Math.floor((Date.parse(to) - Date.parse(from)) / 86_400_000);

function toSite(row: SiteRow, today: string) {
  const pc = row.publicContract;
  const publicContract =
    row.type === "private" || !pc
      ? null
      : {
          ...pc,
          elapsedDays: Math.max(0, daysBetween(pc.serviceOrderDate, today)),
          remainingDays:
            pc.durationDays + pc.amendments.reduce((s, a) => s + a.addedDays, 0) - Math.max(0, daysBetween(pc.serviceOrderDate, today)),
        };
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    status: row.status,
    statusChangedOn: row.statusChangedOn,
    address: row.address ?? null,
    location: row.location ?? null,
    client: row.client ?? null,
    contractor: row.contractor ?? null,
    technicalManager: row.technicalManager ?? null,
    publicContract,
    servicesCount: 0,
    servicesFileName: null,
    equipment: row.equipment,
    documents: [],
    createdAt: row.createdAt.toISOString(),
  };
}

// Distância em metros entre dois pontos (haversine).
function distance(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = Math.PI / 180;
  const h =
    Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(((b.lng - a.lng) * rad) / 2) ** 2;
  return Math.round(2 * 6_371_000 * Math.asin(Math.sqrt(h)));
}

export async function todayOf(siteIds: string[], today: string) {
  if (siteIds.length === 0) return new Map<string, number>();
  const rows = await db
    .select({ siteId: entries.siteId, n: count() })
    .from(entries)
    .where(and(inArray(entries.siteId, siteIds), eq(entries.localDate, today)))
    .groupBy(entries.siteId);
  return new Map(rows.map((r) => [r.siteId, r.n]));
}

const todaySummary = (entriesCount: number, localDate: string) => ({
  localDate,
  state: entriesCount > 0 ? "in_progress" : "no_entries",
  entriesCount,
  reportId: null,
});

async function recentReports(siteId: string) {
  const approved = await db
    .select()
    .from(reports)
    .where(and(eq(reports.siteId, siteId), eq(reports.status, "approved")))
    .orderBy(desc(reports.localDate));
  return {
    recentReports: approved.slice(0, 3).map((r) => ({
      id: r.id,
      number: r.number,
      localDate: r.localDate,
      approvedAt: r.approval?.approvedAt ?? null,
      occurrencesCount: r.content?.occurrences.length ?? 0,
    })),
    approvedReportsCount: approved.length,
  };
}

export async function findSite(siteId: string) {
  const [row] = await db.select().from(sites).where(eq(sites.id, siteId));
  if (!row) throw new NotFoundException("Site not found");
  return row;
}

@Controller("sites")
export class SitesController {
  @Get()
  async listSites(
    @Query("status") status: string | undefined,
    @Query("search") search: string | undefined,
    @Headers("x-timezone") tz = "America/Sao_Paulo",
    @Headers("x-device-location") deviceLocation?: string,
  ) {
    const wanted = status ? parse(z.array(siteStatus), status.split(",")) : ["in_progress"];
    const rows = await db.select().from(sites).where(inArray(sites.status, wanted)).orderBy(desc(sites.createdAt));
    const filtered = search ? rows.filter((r) => r.name.toLowerCase().includes(search.toLowerCase())) : rows;
    const today = todayIn(tz);
    const counts = await todayOf(
      filtered.map((r) => r.id),
      today,
    );
    const openCounts = new Map(
      (
        await db
          .select({ siteId: openItems.siteId, n: count() })
          .from(openItems)
          .where(eq(openItems.status, "open"))
          .groupBy(openItems.siteId)
      ).map((r) => [r.siteId, r.n]),
    );
    const [lat, lng] = (deviceLocation ?? "").split(",").map(Number);
    const here = deviceLocation && Number.isFinite(lat) && Number.isFinite(lng) ? { lat: lat!, lng: lng! } : null;
    const items = filtered.map((r) => ({
      ...toSite(r, today),
      distanceMeters: here && r.location ? distance(here, r.location) : null,
      today: todaySummary(counts.get(r.id) ?? 0, today),
      pendingDays: [],
      openItemsCount: openCounts.get(r.id) ?? 0,
    }));
    if (here) items.sort((a, b) => (a.distanceMeters ?? Infinity) - (b.distanceMeters ?? Infinity));
    return { items };
  }

  @Post()
  async createSite(@Body() body: unknown, @Headers("x-timezone") tz = "America/Sao_Paulo") {
    const input = parse(siteInput, body);
    const today = todayIn(tz);
    // D02: a obra nasce em andamento.
    const [row] = await db
      .insert(sites)
      .values({
        name: input.name,
        type: input.type,
        status: "in_progress",
        statusChangedOn: today,
        address: input.address ?? null,
        location: input.location ?? null,
        client: input.client ?? null,
        contractor: input.contractor ?? null,
        technicalManager: input.technicalManager ?? null,
        publicContract: input.type === "private" ? null : (input.publicContract ?? null),
        equipment: input.equipment.map((e) => ({ id: randomUUID(), name: e.name, identifier: e.identifier ?? null })),
      })
      .returning();
    return toSite(row!, today);
  }

  @Get(":siteId")
  async getSite(@Param("siteId", ParseUUIDPipe) siteId: string, @Headers("x-timezone") tz = "America/Sao_Paulo") {
    const row = await findSite(siteId);
    const today = todayIn(tz);
    const counts = await todayOf([siteId], today);
    return {
      ...toSite(row, today),
      today: todaySummary(counts.get(siteId) ?? 0, today),
      pendingDays: [],
      openItems: (await db.select().from(openItems).where(and(eq(openItems.siteId, siteId), eq(openItems.status, "open")))).map(toOpenItem),
      ...(await recentReports(siteId)),
    };
  }

  @Patch(":siteId")
  async updateSite(
    @Param("siteId", ParseUUIDPipe) siteId: string,
    @Body() body: unknown,
    @Headers("x-timezone") tz = "America/Sao_Paulo",
  ) {
    const current = await findSite(siteId);
    const input = parse(siteInput, { ...toSite(current, todayIn(tz)), ...(body as object) });
    const [row] = await db
      .update(sites)
      .set({
        name: input.name,
        type: input.type,
        address: input.address ?? null,
        location: input.location ?? null,
        client: input.client ?? null,
        contractor: input.contractor ?? null,
        technicalManager: input.technicalManager ?? null,
        publicContract: input.type === "private" ? null : (input.publicContract ?? null),
      })
      .where(eq(sites.id, siteId))
      .returning();
    return toSite(row!, todayIn(tz));
  }

  // Apaga a obra com tudo o que é dela: registros, áudios, fotos, RDOs e itens em aberto. Não tem volta.
  @Delete(":siteId")
  @HttpCode(204)
  async deleteSite(@Param("siteId", ParseUUIDPipe) siteId: string) {
    await findSite(siteId);
    const files = await db.transaction(async (tx) => {
      const rows = await tx.delete(entries).where(eq(entries.siteId, siteId)).returning();
      await tx.delete(openItems).where(eq(openItems.siteId, siteId));
      await tx.delete(reports).where(eq(reports.siteId, siteId));
      const paths = await deleteMedia(
        rows.flatMap((r) => [...(r.audioMediaId ? [r.audioMediaId] : []), ...r.photoMediaIds]),
        tx,
      );
      await tx.delete(sites).where(eq(sites.id, siteId));
      return paths;
    });
    removeFiles(files);
  }

  @Put(":siteId/status")
  async changeSiteStatus(
    @Param("siteId", ParseUUIDPipe) siteId: string,
    @Body() body: unknown,
    @Headers("x-timezone") tz = "America/Sao_Paulo",
  ) {
    const { status } = parse(z.object({ status: siteStatus }), body);
    await findSite(siteId);
    // RG08: a obra não é concluída com RDO em aberto: todo dia com registro precisa de RDO aprovado.
    if (status === "completed") {
      const withEntries = await db.selectDistinct({ localDate: entries.localDate }).from(entries).where(eq(entries.siteId, siteId));
      const approved = new Set(
        (
          await db
            .select({ localDate: reports.localDate })
            .from(reports)
            .where(and(eq(reports.siteId, siteId), eq(reports.status, "approved")))
        ).map((r) => r.localDate),
      );
      const days = withEntries.filter((d) => !approved.has(d.localDate));
      if (days.length > 0) {
        throw new ProblemException(409, "SITE_HAS_OPEN_REPORTS", "Site has days without an approved report", {
          days: days.map((d) => d.localDate),
        });
      }
    }
    const today = todayIn(tz);
    const [row] = await db.update(sites).set({ status, statusChangedOn: today }).where(eq(sites.id, siteId)).returning();
    return toSite(row!, today);
  }
}
