import { Controller, Get, Query } from "@nestjs/common";
import { z } from "zod";
import type { Schemas } from "@argos/contract";
import { parse } from "../common/validate.js";
import { OpenItemsService } from "./open-items.service.js";

const querySchema = z.object({
  status: z.enum(["open", "closed"]).default("open"),
  closedSince: z.iso.date().optional(),
  siteId: z.uuid().optional(),
});

@Controller("open-items")
export class OpenItemsController {
  constructor(private readonly openItems: OpenItemsService) {}

  @Get()
  list(@Query() query: Record<string, string | undefined>): Promise<{ items: Schemas["OpenItem"][] }> {
    const q = parse(querySchema, query);
    return this.openItems.list(q.status, q.closedSince, q.siteId);
  }
}
