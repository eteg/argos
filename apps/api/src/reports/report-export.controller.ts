import { Controller, Get, Param, Query, Res } from "@nestjs/common";
import type { Response } from "express";
import type { Schemas } from "@argos/contract";
import { ReportExportService } from "./report-export.service.js";

@Controller()
export class ReportExportController {
  constructor(private readonly exports: ReportExportService) {}

  @Get("sites/:siteId/reports")
  list(
    @Param("siteId") siteId: string,
    @Query("status") status?: string,
    @Query("limit") limit?: string,
    @Query("cursor") cursor?: string,
  ): Promise<{ items: Schemas["ReportListItem"][]; nextCursor: string | null }> {
    return this.exports.list(siteId, { status, limit, cursor });
  }

  @Get("reports/:reportId/pdf")
  async pdf(@Param("reportId") reportId: string, @Res() res: Response) {
    const { bytes, fileName } = await this.exports.pdf(reportId);
    res
      .status(200)
      .type("application/pdf")
      .setHeader("Content-Disposition", `attachment; filename="${fileName}"`)
      .setHeader("Access-Control-Expose-Headers", "Content-Disposition")
      .send(Buffer.from(bytes));
  }
}
