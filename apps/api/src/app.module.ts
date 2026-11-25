import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { AiModule } from "./ai/ai.module";
import { ApiKeyGuard } from "./api-key.guard";
import { HealthController } from "./health.controller";
import { MeController } from "./me.controller";
import { MediaController } from "./media/media.controller";
import { OpenItemsController } from "./open-items/open-items";
import { RdoModule } from "./rdo/rdo.module";
import { SitesController } from "./sites/sites.controller";

@Module({
  imports: [AiModule, RdoModule],
  controllers: [HealthController, MeController, SitesController, MediaController, OpenItemsController],
  providers: [{ provide: APP_GUARD, useClass: ApiKeyGuard }],
})
export class AppModule {}
