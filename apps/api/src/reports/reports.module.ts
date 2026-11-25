import { Module } from "@nestjs/common";
import { SitesModule } from "../sites/sites.module.js";
import { ReportExportController } from "./report-export.controller.js";
import { ReportExportService } from "./report-export.service.js";
import { ReportsController } from "./reports.controller.js";
import { ReportsService } from "./reports.service.js";

@Module({
  imports: [SitesModule],
  controllers: [ReportsController, ReportExportController],
  providers: [ReportsService, ReportExportService],
})
export class ReportsModule {}
