import { Controller, Get, Query } from "@nestjs/common";
import { and, asc, eq, gte, inArray, lt } from "drizzle-orm";
import { db } from "../db/db";
import { entries, openItems, sites } from "../db/schema";

type OpenItemRow = typeof openItems.$inferSelect;

export function toOpenItem(row: OpenItemRow) {
  return {
    id: row.id,
    siteId: row.siteId,
    title: row.title,
    kind: row.kind,
    status: row.status,
    openedOn: row.openedOn,
    openedInReportId: row.openedInReportId,
    lastUpdate: row.lastUpdate ?? null,
    closedOn: row.closedOn ?? null,
    closingNote: row.closingNote ?? null,
  };
}

// F1RN07: os itens que vieram dos dias anteriores ao dia do RDO.
export function openItemsBefore(siteId: string, localDate: string) {
  return db
    .select()
    .from(openItems)
    .where(and(eq(openItems.siteId, siteId), eq(openItems.status, "open"), lt(openItems.openedOn, localDate)))
    .orderBy(asc(openItems.openedOn));
}

// Os itens de antes do dia, com o registro que citou cada um (F1RN08).
export async function openItemsOfDay(siteId: string, localDate: string) {
  const items = await openItemsBefore(siteId, localDate);
  const dayEntries = await db
    .select({ id: entries.id, capturedAt: entries.capturedAt, openItemIds: entries.openItemIds })
    .from(entries)
    .where(and(eq(entries.siteId, siteId), eq(entries.localDate, localDate)))
    .orderBy(asc(entries.capturedAt));
  return items.map((item) => {
    const entry = dayEntries.find((e) => e.openItemIds.includes(item.id));
    return {
      ...toOpenItem(item),
      mentionedToday: entry ? { entryId: entry.id, capturedAt: entry.capturedAt.toISOString() } : null,
    };
  });
}

@Controller("open-items")
export class OpenItemsController {
  // 2.8: sem status, só os abertos. Agrupar por obra é da web.
  @Get()
  async listOpenItems(@Query("status") status = "open", @Query("closedSince") closedSince?: string) {
    const conditions = [inArray(openItems.status, status.split(","))];
    if (closedSince) conditions.push(gte(openItems.closedOn, closedSince));
    const rows = await db
      .select({ item: openItems, siteName: sites.name })
      .from(openItems)
      .innerJoin(sites, eq(sites.id, openItems.siteId))
      .where(and(...conditions))
      .orderBy(asc(openItems.openedOn));
    return { items: rows.map((r) => ({ ...toOpenItem(r.item), site: { id: r.item.siteId, name: r.siteName } })) };
  }
}
