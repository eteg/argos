import { Controller, Get } from "@nestjs/common";
import { LIMITS } from "@argos/rdo-schema";

// Sem login, a API atende um engenheiro só, configurado no ambiente (RG01).
@Controller()
export class MeController {
  @Get("me")
  getMe() {
    const name = process.env.ENGINEER_NAME ?? "Rafael Lima";
    return {
      id: "engineer",
      name,
      title: process.env.ENGINEER_TITLE ?? `Eng. ${name}`,
      company: process.env.ENGINEER_COMPANY ?? "Construtora Horizonte",
    };
  }

  @Get("config")
  getConfig() {
    return {
      maxPhotosPerEntry: LIMITS.photosPerEntry,
      minPhotosPerReport: LIMITS.minPhotosPerReport,
      maxPhotosPerReport: LIMITS.maxPhotosPerReport,
      openItemHighlightDays: 4,
      geofenceRadiusMeters: 150,
    };
  }
}
