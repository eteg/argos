import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { AiModule } from "./ai/ai.module";
import { ApiKeyGuard } from "./api-key.guard";
import { HealthController } from "./health.controller";

@Module({
  imports: [AiModule],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ApiKeyGuard }],
})
export class AppModule {}
