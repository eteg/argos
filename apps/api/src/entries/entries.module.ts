import { Module } from "@nestjs/common";
import { SitesModule } from "../sites/sites.module.js";
import { EntriesController } from "./entries.controller.js";

@Module({ imports: [SitesModule], controllers: [EntriesController] })
export class EntriesModule {}
