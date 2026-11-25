import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Put,
  Res,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { eq, inArray } from "drizzle-orm";
import type { Response } from "express";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { z } from "zod";
import { db } from "../db/db";
import { media } from "../db/schema";
import { ProblemException } from "../problem.filter";
import { Public } from "../public.decorator";
import { locationSchema, parse } from "../validation";

const UPLOAD_DIR = resolve(process.env.UPLOAD_DIR ?? "uploads");
const MAX_BYTES = 20 * 1024 * 1024;
const TYPES = {
  audio: ["audio/webm", "audio/mp4", "audio/mpeg", "audio/ogg"],
  photo: ["image/jpeg", "image/png", "image/heic", "image/webp"],
};

const mediaInput = z.object({
  kind: z.enum(["audio", "photo"]),
  source: z.enum(["camera", "gallery", "microphone"]),
  capturedAt: z.iso.datetime(),
  location: z
    .string()
    .optional()
    .transform((v) => (v ? JSON.parse(v) : null))
    .pipe(locationSchema.nullable()),
  durationSeconds: z.coerce.number().int().min(0).optional(),
});

type MediaRow = typeof media.$inferSelect;

export function toMedia(row: MediaRow) {
  return {
    id: row.id,
    kind: row.kind,
    source: row.source,
    capturedAt: row.capturedAt.toISOString(),
    location: row.location ?? null,
    durationSeconds: row.durationSeconds ?? null,
    // Link sem a chave da API, pra <img> e <audio> abrirem. O UUID não é adivinhável.
    url: `/v1/media/${row.id}/file`,
  };
}

export async function findMedia(ids: string[]) {
  if (ids.length === 0) return new Map<string, MediaRow>();
  const rows = await db.select().from(media).where(inArray(media.id, ids));
  return new Map(rows.map((r) => [r.id, r]));
}

@Controller("media")
export class MediaController {
  // Sem internet, o mesmo id pode chegar de novo: devolve o que já foi gravado.
  @Put(":mediaId")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_BYTES } }))
  async uploadMedia(
    @Param("mediaId", ParseUUIDPipe) mediaId: string,
    @UploadedFile() file: { buffer: Buffer; mimetype: string } | undefined,
    @Body() body: unknown,
  ) {
    const [existing] = await db.select().from(media).where(eq(media.id, mediaId));
    if (existing) return toMedia(existing);
    const input = parse(mediaInput, body);
    if (!file) throw new ProblemException(400, "VALIDATION", "File is required", { errors: [{ field: "file", code: "REQUIRED" }] });
    const contentType = file.mimetype.split(";")[0]!;
    if (!TYPES[input.kind].includes(contentType)) {
      throw new ProblemException(415, "UNSUPPORTED_FILE", `Accepted: ${TYPES[input.kind].join(", ")}`);
    }
    mkdirSync(UPLOAD_DIR, { recursive: true });
    const path = join(UPLOAD_DIR, mediaId);
    writeFileSync(path, file.buffer);
    const [row] = await db
      .insert(media)
      .values({
        id: mediaId,
        kind: input.kind,
        source: input.source,
        capturedAt: new Date(input.capturedAt),
        location: input.location,
        durationSeconds: input.durationSeconds ?? null,
        contentType,
        path,
      })
      .returning();
    return toMedia(row!);
  }

  @Public()
  @Get(":mediaId/file")
  async getFile(@Param("mediaId", ParseUUIDPipe) mediaId: string, @Res() res: Response) {
    const [row] = await db.select().from(media).where(eq(media.id, mediaId));
    if (!row) throw new NotFoundException("Media not found");
    res.type(row.contentType).sendFile(row.path);
  }
}
