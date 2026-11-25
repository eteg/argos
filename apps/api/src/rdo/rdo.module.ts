import { Module } from "@nestjs/common";
import { AiModule } from "../ai/ai.module";
import { RdoService } from "./rdo.service";
import { EntriesController } from "../entries/entries.controller";
import { ReportsController } from "./reports.controller";

@Module({
  imports: [AiModule],
  controllers: [ReportsController, EntriesController],
  providers: [RdoService],
  exports: [RdoService],
})
export class RdoModule {}
