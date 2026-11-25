import { randomUUID } from "node:crypto";
import {
  Body, Controller, Delete, Get, Headers, HttpCode, Param, Patch, Post, Put, Query, Res, UploadedFile, UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { and, eq } from "drizzle-orm";
import type { Response } from "express";
import type { Schemas } from "@argos/contract";
import { parseDeviceLocation, timezoneOf } from "../common/locale.js";
import { ProblemException } from "../common/problem.js";
import { parse } from "../common/validate.js";
import { documents, equipment, services, sites } from "../database/schema.js";
import { StorageService } from "../storage/storage.service.js";
import { readServices } from "./spreadsheet.js";
import { SitesService } from "./sites.service.js";
import {
  changeStatusSchema, documentType, equipmentSchema, updateDocumentSchema, updateEquipmentSchema, uuid,
} from "./sites.schemas.js";

const MB = 1024 * 1024;
const upload = { limits: { fileSize: 50 * MB } };
const spreadsheetTypes = [".xlsx", ".csv"];
const documentMimes = ["application/pdf", "image/jpeg", "image/png", "image/heic"];

function requireFile(file: Express.Multer.File | undefined) {
  if (!file) throw new ProblemException(400, "VALIDATION", "File is required.", [{ field: "file", code: "REQUIRED" }]);
  return file;
}

@Controller("sites")
export class SitesController {
  constructor(
    private readonly sitesService: SitesService,
    private readonly storage: StorageService,
  ) {}

  private get db() {
    return this.sitesService.db;
  }

  @Get()
  list(
    @Headers("x-timezone") tz: string | undefined,
    @Headers("x-device-location") device: string | undefined,
    @Query("status") status?: string,
    @Query("search") search?: string,
  ) {
    return this.sitesService.list(timezoneOf(tz), parseDeviceLocation(device), status, search);
  }

  @Post()
  async create(@Body() body: unknown, @Headers("x-timezone") tz: string | undefined, @Res({ passthrough: true }) res: Response) {
    res.status(201);
    return this.sitesService.create(body, timezoneOf(tz));
  }

  @Get(":siteId")
  async get(@Param("siteId") siteId: string, @Headers("x-timezone") tz: string | undefined) {
    return this.sitesService.detail(await this.sitesService.requireSite(siteId), timezoneOf(tz));
  }

  @Patch(":siteId")
  update(@Param("siteId") siteId: string, @Body() body: unknown, @Headers("x-timezone") tz: string | undefined) {
    return this.sitesService.update(siteId, body, timezoneOf(tz));
  }

  @Put(":siteId/status")
  changeStatus(@Param("siteId") siteId: string, @Body() body: unknown, @Headers("x-timezone") tz: string | undefined) {
    const { status } = parse(changeStatusSchema, body);
    return this.sitesService.changeStatus(siteId, status, timezoneOf(tz));
  }

  @Put(":siteId/services")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 10 * MB } }))
  async importServices(@Param("siteId") siteId: string, @UploadedFile() upload: Express.Multer.File | undefined): Promise<Schemas["ImportServicesResult"]> {
    await this.sitesService.requireSite(siteId);
    const file = requireFile(upload);
    const fileName = Buffer.from(file.originalname, "latin1").toString("utf8");
    if (!spreadsheetTypes.some((ext) => fileName.toLowerCase().endsWith(ext))) {
      throw new ProblemException(415, "UNSUPPORTED_FILE", "Only .xlsx and .csv are accepted.");
    }
    const rows = await readServices(file.buffer, fileName);
    await this.db.transaction(async (tx) => {
      await tx.delete(services).where(eq(services.siteId, siteId));
      for (let i = 0; i < rows.length; i += 500) {
        await tx.insert(services).values(rows.slice(i, i + 500).map((r) => ({ ...r, siteId })));
      }
      await tx.update(sites).set({ servicesFileName: fileName }).where(eq(sites.id, siteId));
    });
    return { servicesCount: rows.length, servicesFileName: fileName };
  }

  @Post(":siteId/equipment")
  async addEquipment(@Param("siteId") siteId: string, @Body() body: unknown, @Res({ passthrough: true }) res: Response): Promise<Schemas["Equipment"]> {
    await this.sitesService.requireSite(siteId);
    const input = parse(equipmentSchema, body);
    const [row] = await this.db.insert(equipment).values({ siteId, name: input.name, identifier: input.identifier ?? null }).returning();
    res.status(201);
    return { id: row!.id, name: row!.name, identifier: row!.identifier };
  }

  private async requireChild<T extends typeof equipment | typeof documents>(table: T, siteId: string, id: string): Promise<T["$inferSelect"]> {
    await this.sitesService.requireSite(siteId);
    const [row] = uuid.safeParse(id).success
      ? await this.db.select().from(table as typeof equipment).where(and(eq(table.id, id), eq(table.siteId, siteId)))
      : [];
    if (!row) throw new ProblemException(404, "NOT_FOUND", "Not found.");
    return row;
  }

  @Patch(":siteId/equipment/:equipmentId")
  async updateEquipment(@Param("siteId") siteId: string, @Param("equipmentId") id: string, @Body() body: unknown): Promise<Schemas["Equipment"]> {
    await this.requireChild(equipment, siteId, id);
    const input = parse(updateEquipmentSchema, body);
    const [row] = await this.db
      .update(equipment)
      .set({ ...(input.name !== undefined && { name: input.name }), ...(input.identifier !== undefined && { identifier: input.identifier }) })
      .where(eq(equipment.id, id))
      .returning();
    return { id: row!.id, name: row!.name, identifier: row!.identifier };
  }

  @Delete(":siteId/equipment/:equipmentId")
  @HttpCode(204)
  async removeEquipment(@Param("siteId") siteId: string, @Param("equipmentId") id: string) {
    await this.requireChild(equipment, siteId, id);
    await this.db.delete(equipment).where(eq(equipment.id, id));
  }

  @Post(":siteId/documents")
  @UseInterceptors(FileInterceptor("file", upload))
  async uploadDocument(
    @Param("siteId") siteId: string,
    @UploadedFile() uploaded: Express.Multer.File | undefined,
    @Body() body: unknown,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Schemas["SiteDocument"]> {
    await this.sitesService.requireSite(siteId);
    const file = requireFile(uploaded);
    const { type } = parse(updateDocumentSchema, body);
    if (!documentMimes.includes(file.mimetype)) throw new ProblemException(415, "UNSUPPORTED_FILE", "Only PDF and images are accepted.");
    const id = randomUUID();
    const fileName = Buffer.from(file.originalname, "latin1").toString("utf8");
    await this.storage.save("documents", id, file.buffer);
    await this.db.insert(documents).values({ id, siteId, fileName, type, mimeType: file.mimetype });
    res.status(201);
    return { id, fileName, type, url: this.storage.url("documents", id) };
  }

  @Patch(":siteId/documents/:documentId")
  async updateDocument(@Param("siteId") siteId: string, @Param("documentId") id: string, @Body() body: unknown): Promise<Schemas["SiteDocument"]> {
    await this.requireChild(documents, siteId, id);
    const { type } = parse(updateDocumentSchema, body);
    const [row] = await this.db.update(documents).set({ type }).where(eq(documents.id, id)).returning();
    return { id, fileName: row!.fileName, type: documentType.parse(row!.type), url: this.storage.url("documents", id) };
  }

  @Delete(":siteId/documents/:documentId")
  @HttpCode(204)
  async removeDocument(@Param("siteId") siteId: string, @Param("documentId") id: string) {
    await this.requireChild(documents, siteId, id);
    await this.db.delete(documents).where(eq(documents.id, id));
    await this.storage.remove("documents", id);
  }
}
