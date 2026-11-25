import { Module } from "@nestjs/common";
import { SitesModule } from "../sites/sites.module.js";
import { ReportsController } from "./reports.controller.js";
import { ReportsService } from "./reports.service.js";

@Module({ imports: [SitesModule], controllers: [ReportsController], providers: [ReportsService] })
export class ReportsModule {}
