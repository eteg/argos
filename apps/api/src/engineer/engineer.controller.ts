import { Controller, Get } from "@nestjs/common";
import type { Schemas } from "@argos/contract";
import { env } from "../config/env.js";

@Controller()
export class EngineerController {
  @Get("me")
  getMe(): Schemas["Engineer"] {
    return { id: env.ENGINEER_ID, name: env.ENGINEER_NAME, title: env.ENGINEER_TITLE, company: env.ENGINEER_COMPANY };
  }

  @Get("config")
  getConfig(): Schemas["Config"] {
    return { maxPhotosPerEntry: 3, minPhotosPerReport: 3, maxPhotosPerReport: 20, openItemHighlightDays: 4, geofenceRadiusMeters: 150 };
  }
}
