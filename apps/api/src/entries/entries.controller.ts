import { Body, Controller, Get, HttpCode, Inject, NotFoundException, Param, ParseUUIDPipe, Post } from "@nestjs/common";
import { and, desc, eq } from "drizzle-orm";
import { LIMITS } from "@argos/rdo-schema";
import { z } from "zod";
import { db } from "../db/db";
import { entries, reports } from "../db/schema";
import { findMedia, toMedia } from "../media/media.controller";
import { ProblemException } from "../problem.filter";
import { openItemsOfDay } from "../open-items/open-items";
import { RdoService } from "../rdo/rdo.service";
import { findSite } from "../sites/sites.controller";
import { locationSchema, parse } from "../validation";

const entryInput = z.object({
  id: z.uuid(),
  capturedAt: z.iso.datetime(),
  localDate: z.iso.date(),
  timezone: z.string().min(1),
  location: locationSchema.nullable().optional(),
  offline: z.boolean().default(false),
  audioMediaId: z.uuid().nullable().optional(),
  photoMediaIds: z.array(z.uuid()).default([]),
});

type EntryRow = typeof entries.$inferSelect;

async function toEntries(rows: EntryRow[]) {
  const ids = rows.flatMap((r) => [...(r.audioMediaId ? [r.audioMediaId] : []), ...r.photoMediaIds]);
  const found = await findMedia(ids);
  return rows.map((r) => ({
    id: r.id,
    siteId: r.siteId,
    capturedAt: r.capturedAt.toISOString(),
    localDate: r.localDate,
    timezone: r.timezone,
    location: r.location ?? null,
    offline: r.offline,
    audio: r.audioMediaId && found.get(r.audioMediaId) ? toMedia(found.get(r.audioMediaId)!) : null,
    photos: r.photoMediaIds.flatMap((id) => (found.get(id) ? [toMedia(found.get(id)!)] : [])),
    status: r.status,
    transcript: r.transcript ?? null,
    title: r.title ?? null,
    tags: r.tags,
    openItemIds: r.openItemIds,
    questions: [],
  }));
}

@Controller()
export class EntriesController {
  constructor(@Inject(RdoService) private readonly rdo: RdoService) {}

  // 202: a IA transcreve e interpreta em segundo plano, e a web consulta getEntry.
  @Post("sites/:siteId/entries")
  @HttpCode(202)
  async createEntry(@Param("siteId", ParseUUIDPipe) siteId: string, @Body() body: unknown) {
    const input = parse(entryInput, body);
    const [existing] = await db.select().from(entries).where(eq(entries.id, input.id));
    if (existing) return (await toEntries([existing]))[0];

    const site = await findSite(siteId);
    if (site.status !== "in_progress") throw new ProblemException(409, "SITE_NOT_IN_PROGRESS", "Site is not in progress");
    if (!input.audioMediaId && input.photoMediaIds.length === 0) {
      throw new ProblemException(400, "VALIDATION", "An entry needs audio or photos", { errors: [{ field: "audioMediaId", code: "REQUIRED" }] });
    }
    if (input.photoMediaIds.length > LIMITS.photosPerEntry) {
      throw new ProblemException(409, "PHOTO_LIMIT_ENTRY", `At most ${LIMITS.photosPerEntry} photos per entry`);
    }
    const day = await db
      .select({ photoMediaIds: entries.photoMediaIds })
      .from(entries)
      .where(and(eq(entries.siteId, siteId), eq(entries.localDate, input.localDate)));
    const [dayReport] = await db
      .select({ status: reports.status })
      .from(reports)
      .where(and(eq(reports.siteId, siteId), eq(reports.localDate, input.localDate)));
    if (dayReport?.status === "approved") throw new ProblemException(409, "REPORT_ALREADY_APPROVED", "The day's report is approved");
    const dayPhotos = day.reduce((n, e) => n + e.photoMediaIds.length, 0);
    if (dayPhotos + input.photoMediaIds.length > LIMITS.maxPhotosPerReport) {
      throw new ProblemException(409, "PHOTO_LIMIT_REPORT", `At most ${LIMITS.maxPhotosPerReport} photos per report`);
    }
    const mediaIds = [...(input.audioMediaId ? [input.audioMediaId] : []), ...input.photoMediaIds];
    const found = await findMedia(mediaIds);
    const missing = mediaIds.filter((id) => !found.has(id));
    if (missing.length > 0) {
      throw new ProblemException(400, "VALIDATION", "Media not uploaded", {
        errors: missing.map((id) => ({ field: id, code: "MEDIA_NOT_FOUND" })),
      });
    }

    const [row] = await db
      .insert(entries)
      .values({
        id: input.id,
        siteId,
        capturedAt: new Date(input.capturedAt),
        localDate: input.localDate,
        timezone: input.timezone,
        location: input.location ?? null,
        offline: input.offline,
        audioMediaId: input.audioMediaId ?? null,
        photoMediaIds: input.photoMediaIds,
        status: "processing",
      })
      .returning();
    void this.rdo.interpretEntry(row!.id);
    return (await toEntries([row!]))[0];
  }

  @Get("entries/:entryId")
  async getEntry(@Param("entryId", ParseUUIDPipe) entryId: string) {
    const [row] = await db.select().from(entries).where(eq(entries.id, entryId));
    if (!row) throw new NotFoundException("Entry not found");
    return (await toEntries([row]))[0];
  }

  @Get("sites/:siteId/days/:localDate")
  async getDay(@Param("siteId", ParseUUIDPipe) siteId: string, @Param("localDate") localDate: string) {
    parse(z.iso.date(), localDate);
    const site = await findSite(siteId);
    const rows = await db
      .select()
      .from(entries)
      .where(and(eq(entries.siteId, siteId), eq(entries.localDate, localDate)))
      .orderBy(desc(entries.capturedAt));
    return {
      site: { id: site.id, name: site.name, type: site.type, status: site.status, address: site.address ?? null },
      localDate,
      openItems: await openItemsOfDay(siteId, localDate),
      entries: await toEntries(rows),
      report: await db
        .select({ id: reports.id, status: reports.status, number: reports.number })
        .from(reports)
        .where(and(eq(reports.siteId, siteId), eq(reports.localDate, localDate)))
        .then((r) => r[0] ?? null),
    };
  }
}
