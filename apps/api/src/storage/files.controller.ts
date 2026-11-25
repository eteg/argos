import { Controller, Get, Inject, Param, Query, Res } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import type { Response } from "express";
import { Public } from "../common/public.decorator.js";
import { ProblemException } from "../common/problem.js";
import { DB, type Database } from "../database/database.module.js";
import { documents, media } from "../database/schema.js";
import { StorageService } from "./storage.service.js";

@Controller("files")
export class FilesController {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly storage: StorageService,
  ) {}

  @Public()
  @Get(":scope/:id")
  async download(
    @Param("scope") scope: string,
    @Param("id") id: string,
    @Query("exp") exp: string,
    @Query("sig") sig: string,
    @Res() res: Response,
  ) {
    const table = scope === "media" ? media : scope === "documents" ? documents : null;
    if (!table || !this.storage.verify(scope, id, exp, sig)) throw new ProblemException(404, "NOT_FOUND", "File not found.");
    const [row] = await this.db.select({ mimeType: table.mimeType }).from(table).where(and(eq(table.id, id)));
    if (!row) throw new ProblemException(404, "NOT_FOUND", "File not found.");
    const data = await this.storage.read(scope, id).catch(() => null);
    if (!data) throw new ProblemException(404, "NOT_FOUND", "File not found.");
    res.type(row.mimeType).send(data);
  }
}
