import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { AiModule } from "./ai/ai.module";
import { ApiKeyGuard } from "./api-key.guard";
import { EntriesController } from "./entries/entries.controller";
import { HealthController } from "./health.controller";
import { MeController } from "./me.controller";
import { MediaController } from "./media/media.controller";
import { SitesController } from "./sites/sites.controller";

@Module({
  imports: [AiModule],
  controllers: [HealthController, MeController, SitesController, MediaController, EntriesController],
  providers: [{ provide: APP_GUARD, useClass: ApiKeyGuard }],
})
export class AppModule {}
