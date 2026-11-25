import { Controller, Get, Param, Post, Res } from "@nestjs/common";
import type { Response } from "express";
import { z } from "zod";
import type { Schemas } from "@argos/contract";
import { ProblemException } from "../common/problem.js";
import { ReportsService } from "./reports.service.js";

@Controller()
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Post("sites/:siteId/days/:localDate/report")
  async generate(@Param("siteId") siteId: string, @Param("localDate") localDate: string, @Res({ passthrough: true }) res: Response): Promise<Schemas["Report"]> {
    if (!z.iso.date().safeParse(localDate).success) {
      throw new ProblemException(400, "VALIDATION", "Invalid localDate.", [{ field: "localDate", code: "INVALID" }]);
    }
    const row = await this.reports.generate(siteId, localDate);
    res.status(202).setHeader("Location", `/v1/reports/${row.id}`).setHeader("Retry-After", "1");
    return this.reports.view(row);
  }

  @Get("reports/:reportId")
  async get(@Param("reportId") reportId: string): Promise<Schemas["Report"]> {
    return this.reports.view(await this.reports.find(reportId));
  }
}
