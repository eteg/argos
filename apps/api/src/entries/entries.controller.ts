import { Body, Controller, Get, Headers, Inject, Param, Post, Put, Res, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type { Response } from "express";
import { z } from "zod";
import type { Schemas } from "@argos/contract";
import { timezoneOf } from "../common/locale.js";
import { ProblemException } from "../common/problem.js";
import { parse } from "../common/validate.js";
import { DB, type Database } from "../database/database.module.js";
import { entries, media, reports } from "../database/schema.js";
import { SitesService } from "../sites/sites.service.js";
import { uuid } from "../sites/sites.schemas.js";
import { StorageService } from "../storage/storage.service.js";

const MB = 1024 * 1024;
export const MAX_PHOTOS_PER_ENTRY = 3;
export const MAX_PHOTOS_PER_REPORT = 20;

const mediaRules = {
  audio: { mimes: ["audio/webm", "audio/mp4", "audio/mpeg"], maxBytes: 10 * MB },
  photo: { mimes: ["image/jpeg", "image/png", "image/heic"], maxBytes: 15 * MB },
};

const locationInput = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180), accuracyMeters: z.number().optional() });

const mediaForm = z.object({
  kind: z.enum(["audio", "photo"]),
  source: z.enum(["camera", "microphone"]),
  capturedAt: z.iso.datetime(),
  location: z.string().optional(),
  durationSeconds: z.coerce.number().int().min(0).optional(),
});

const entrySchema = z.object({
  id: z.uuid(),
  capturedAt: z.iso.datetime(),
  localDate: z.iso.date(),
  timezone: z.string().min(1),
  location: locationInput.optional(),
  offline: z.boolean().optional(),
  audioMediaId: z.uuid(),
  photoMediaIds: z.array(z.uuid()).optional(),
});

type MediaRow = typeof media.$inferSelect;
type EntryRow = typeof entries.$inferSelect;

@Controller()
export class EntriesController {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly sites: SitesService,
    private readonly storage: StorageService,
  ) {}

  private location(row: { lat: number | null; lng: number | null; accuracyMeters: number | null }): Schemas["Location"] | null {
    return row.lat === null || row.lng === null ? null : { lat: row.lat, lng: row.lng, accuracyMeters: row.accuracyMeters };
  }

  private toMedia(row: MediaRow): Schemas["Media"] {
    return {
      id: row.id,
      kind: row.kind as Schemas["MediaKind"],
      source: row.source as Schemas["MediaSource"],
      capturedAt: row.capturedAt.toISOString(),
      location: this.location(row),
      durationSeconds: row.durationSeconds,
      url: this.storage.url("media", row.id),
    };
  }

  private async toEntries(rows: EntryRow[]): Promise<Schemas["Entry"][]> {
    const ids = [...new Set(rows.flatMap((r) => [r.audioMediaId, ...r.photoMediaIds]))];
    const mediaRows = ids.length ? await this.db.select().from(media).where(inArray(media.id, ids)) : [];
    const byId = new Map(mediaRows.map((m) => [m.id, this.toMedia(m)]));
    return rows.map((row) => ({
      id: row.id,
      siteId: row.siteId,
      capturedAt: row.capturedAt.toISOString(),
      localDate: row.localDate,
      timezone: row.timezone,
      location: this.location(row),
      offline: row.offline,
      audio: byId.get(row.audioMediaId) ?? null,
      photos: row.photoMediaIds.flatMap((id) => byId.get(id) ?? []),
      status: row.status as Schemas["EntryStatus"],
      transcript: null,
      title: null,
      tags: [],
      openItemIds: [],
      questions: [],
    }));
  }

  @Put("media/:mediaId")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 50 * MB } }))
  async uploadMedia(
    @Param("mediaId") mediaId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: unknown,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Schemas["Media"]> {
    if (!uuid.safeParse(mediaId).success) throw new ProblemException(400, "VALIDATION", "Invalid mediaId.", [{ field: "mediaId", code: "INVALID" }]);
    const [existing] = await this.db.select().from(media).where(eq(media.id, mediaId));
    if (existing) return this.toMedia(existing);
    if (!file) throw new ProblemException(400, "VALIDATION", "File is required.", [{ field: "file", code: "REQUIRED" }]);
    const form = parse(mediaForm, body);
    const rules = mediaRules[form.kind];
    const mimeType = file.mimetype.split(";")[0]!.trim();
    if (!rules.mimes.includes(mimeType)) throw new ProblemException(415, "UNSUPPORTED_FILE", `Accepted types: ${rules.mimes.join(", ")}.`);
    if (file.size > rules.maxBytes) throw new ProblemException(413, "FILE_TOO_LARGE", `The limit is ${rules.maxBytes / MB} MB.`);
    let location: z.infer<typeof locationInput> | undefined;
    if (form.location) {
      try {
        location = parse(locationInput, JSON.parse(form.location));
      } catch (error) {
        if (error instanceof ProblemException) throw error;
        throw new ProblemException(400, "VALIDATION", "Invalid location.", [{ field: "location", code: "INVALID" }]);
      }
    }
    await this.storage.save("media", mediaId, file.buffer);
    const [row] = await this.db
      .insert(media)
      .values({
        id: mediaId,
        kind: form.kind,
        source: form.source,
        mimeType,
        capturedAt: new Date(form.capturedAt),
        lat: location?.lat ?? null,
        lng: location?.lng ?? null,
        accuracyMeters: location?.accuracyMeters ?? null,
        durationSeconds: form.kind === "audio" ? (form.durationSeconds ?? null) : null,
      })
      .returning();
    res.status(201);
    return this.toMedia(row!);
  }

  @Post("sites/:siteId/entries")
  async createEntry(@Param("siteId") siteId: string, @Body() body: unknown, @Res({ passthrough: true }) res: Response): Promise<Schemas["Entry"]> {
    const site = await this.sites.requireSite(siteId);
    const input = parse(entrySchema, body);
    timezoneOf(input.timezone);
    const [existing] = await this.db.select().from(entries).where(eq(entries.id, input.id));
    if (existing) {
      if (existing.siteId !== siteId) throw new ProblemException(409, "ENTRY_ID_IN_USE", "The id belongs to another site.");
      res.status(200);
      return (await this.toEntries([existing]))[0]!;
    }
    const [approved] = await this.db.select({ id: reports.id }).from(reports).where(and(eq(reports.siteId, siteId), eq(reports.localDate, input.localDate), eq(reports.status, "approved")));
    if (approved) throw new ProblemException(409, "REPORT_ALREADY_APPROVED", "The report of the day is already approved.");
    if (site.status !== "in_progress") throw new ProblemException(409, "SITE_NOT_IN_PROGRESS", "Only sites in progress accept entries.");
    const photoIds = [...new Set(input.photoMediaIds ?? [])];
    if (photoIds.length > MAX_PHOTOS_PER_ENTRY) throw new ProblemException(409, "PHOTO_LIMIT_ENTRY", `An entry takes at most ${MAX_PHOTOS_PER_ENTRY} photos.`);
    const found = await this.db.select().from(media).where(inArray(media.id, [input.audioMediaId, ...photoIds]));
    const foundById = new Map(found.map((m) => [m.id, m]));
    if (foundById.get(input.audioMediaId)?.kind !== "audio") {
      throw new ProblemException(400, "VALIDATION", "Audio not found.", [{ field: "audioMediaId", code: "INVALID" }]);
    }
    if (photoIds.some((id) => foundById.get(id)?.kind !== "photo")) {
      throw new ProblemException(400, "VALIDATION", "Photo not found.", [{ field: "photoMediaIds", code: "INVALID" }]);
    }
    const [{ photos }] = (
      await this.db.execute<{ photos: number }>(
        sql`select coalesce(sum(cardinality(photo_media_ids)), 0)::int as photos from entries where site_id = ${siteId} and local_date = ${input.localDate}`,
      )
    ).rows as [{ photos: number }];
    if (photos + photoIds.length > MAX_PHOTOS_PER_REPORT) {
      throw new ProblemException(409, "PHOTO_LIMIT_REPORT", `The day would go over ${MAX_PHOTOS_PER_REPORT} photos.`);
    }
    const [row] = await this.db
      .insert(entries)
      .values({
        id: input.id,
        siteId,
        capturedAt: new Date(input.capturedAt),
        localDate: input.localDate,
        timezone: input.timezone,
        lat: input.location?.lat ?? null,
        lng: input.location?.lng ?? null,
        accuracyMeters: input.location?.accuracyMeters ?? null,
        offline: input.offline ?? false,
        audioMediaId: input.audioMediaId,
        photoMediaIds: photoIds,
      })
      .returning();
    res.status(201);
    return (await this.toEntries([row!]))[0]!;
  }

  @Get("sites/:siteId/days/:localDate")
  async getDay(
    @Param("siteId") siteId: string,
    @Param("localDate") localDate: string,
    @Headers("x-timezone") tz: string | undefined,
  ): Promise<Schemas["Day"]> {
    const site = await this.sites.requireSite(siteId);
    if (!z.iso.date().safeParse(localDate).success) {
      throw new ProblemException(400, "VALIDATION", "Invalid localDate.", [{ field: "localDate", code: "INVALID" }]);
    }
    const rows = await this.db
      .select()
      .from(entries)
      .where(and(eq(entries.siteId, siteId), eq(entries.localDate, localDate)))
      .orderBy(desc(entries.capturedAt));
    const [report] = await this.db.select({ id: reports.id, status: reports.status }).from(reports).where(and(eq(reports.siteId, siteId), eq(reports.localDate, localDate)));
    return {
      site: await this.sites.summaryOf(site, timezoneOf(tz)),
      localDate,
      openItems: [],
      entries: await this.toEntries(rows),
      report: report ? { id: report.id, status: report.status as Schemas["ReportStatus"] } : null,
    };
  }
}
