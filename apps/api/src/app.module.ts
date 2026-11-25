import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ApiKeyGuard } from "./common/api-key.guard.js";
import { AiModule } from "./ai/ai.module.js";
import { DatabaseModule } from "./database/database.module.js";
import { DiagnosticsModule } from "./diagnostics/diagnostics.module.js";
import { EngineerModule } from "./engineer/engineer.module.js";
import { EntriesModule } from "./entries/entries.module.js";
import { SitesModule } from "./sites/sites.module.js";
import { StorageModule } from "./storage/storage.module.js";
import { HealthModule } from "./health/health.module.js";

@Module({
  imports: [AiModule, DatabaseModule, DiagnosticsModule, EngineerModule, EntriesModule, HealthModule, SitesModule, StorageModule],
  providers: [{ provide: APP_GUARD, useClass: ApiKeyGuard }],
})
export class AppModule {}
