import { Controller, Get } from "@nestjs/common";
import { Public } from "./public.decorator";

@Controller("health")
export class HealthController {
  @Public()
  @Get()
  getHealth() {
    return { status: "ok" };
  }
}
