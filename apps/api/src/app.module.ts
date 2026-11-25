import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ApiKeyGuard } from "./common/api-key.guard.js";
import { AiModule } from "./ai/ai.module.js";
import { DatabaseModule } from "./database/database.module.js";
import { DiagnosticsModule } from "./diagnostics/diagnostics.module.js";
import { HealthModule } from "./health/health.module.js";

@Module({
  imports: [AiModule, DatabaseModule, DiagnosticsModule, HealthModule],
  providers: [{ provide: APP_GUARD, useClass: ApiKeyGuard }],
})
export class AppModule {}
