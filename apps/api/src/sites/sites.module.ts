import { Module } from "@nestjs/common";
import { PendingDaysController } from "./pending-days.controller.js";
import { SitesController } from "./sites.controller.js";
import { SitesService } from "./sites.service.js";

@Module({ controllers: [SitesController, PendingDaysController], providers: [SitesService], exports: [SitesService] })
export class SitesModule {}
