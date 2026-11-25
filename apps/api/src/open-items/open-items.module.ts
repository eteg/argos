import { Global, Module } from "@nestjs/common";
import { OpenItemsController } from "./open-items.controller.js";
import { OpenItemsService } from "./open-items.service.js";

@Global()
@Module({ controllers: [OpenItemsController], providers: [OpenItemsService], exports: [OpenItemsService] })
export class OpenItemsModule {}
