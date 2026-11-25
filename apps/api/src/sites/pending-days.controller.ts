import { Controller, Get, Headers } from "@nestjs/common";
import type { Schemas } from "@argos/contract";
import { parseDeviceLocation, timezoneOf } from "../common/locale.js";
import { SitesService } from "./sites.service.js";

@Controller("pending-days")
export class PendingDaysController {
  constructor(private readonly sites: SitesService) {}

  @Get()
  list(
    @Headers("x-timezone") tz: string | undefined,
    @Headers("x-device-location") device: string | undefined,
  ): Promise<{ items: Schemas["PendingDaysGroup"][] }> {
    return this.sites.pendingDays(timezoneOf(tz), parseDeviceLocation(device));
  }
}
