import { Inject, Injectable } from "@nestjs/common";
import { and, asc, desc, eq, gte, inArray, sql } from "drizzle-orm";
import type { Schemas } from "@argos/contract";
import { DB, type Database } from "../database/database.module.js";
import { entries, openItems } from "../database/schema.js";

type Row = typeof openItems.$inferSelect;
export type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

interface Review {
  openItemId: string;
  outcome: "close" | "keep" | "update" | null;
  note: string | null;
}
interface NewItem {
  title: string | null;
  kind: string | null;
  track: boolean | null;
}

@Injectable()
export class OpenItemsService {
  constructor(@Inject(DB) private readonly db: Database) {}

  toApi(row: Row, mentionedToday: Schemas["OpenItem"]["mentionedToday"] = null): Schemas["OpenItem"] {
    return {
      id: row.id,
      siteId: row.siteId,
      title: row.title,
      kind: row.kind as Schemas["OpenItemKind"],
      status: row.status as Schemas["OpenItemStatus"],
      openedOn: row.openedOn,
      openedInReportId: row.openedInReportId,
      lastUpdate: row.lastUpdate,
      closedOn: row.closedOn,
      closingNote: row.closingNote,
      mentionedToday,
    };
  }

  async openForSite(siteId: string, before?: string) {
    const rows = await this.db
      .select()
      .from(openItems)
      .where(and(eq(openItems.siteId, siteId), eq(openItems.status, "open")))
      .orderBy(asc(openItems.openedOn), asc(openItems.createdAt));
    return before ? rows.filter((r) => r.openedOn < before) : rows;
  }

  async listForSite(siteId: string, localDate: string): Promise<Schemas["OpenItem"][]> {
    const rows = await this.openForSite(siteId);
    const dayEntries = await this.db
      .select({ id: entries.id, capturedAt: entries.capturedAt, openItemIds: entries.openItemIds })
      .from(entries)
      .where(and(eq(entries.siteId, siteId), eq(entries.localDate, localDate)))
      .orderBy(asc(entries.capturedAt));
    return rows.map((row) => {
      const hit = dayEntries.find((e) => e.openItemIds.includes(row.id));
      return this.toApi(row, hit ? { entryId: hit.id, capturedAt: hit.capturedAt.toISOString() } : null);
    });
  }

  async countOpen(siteIds: string[]) {
    if (siteIds.length === 0) return new Map<string, number>();
    const rows = await this.db
      .select({ siteId: openItems.siteId, count: sql<number>`count(*)::int` })
      .from(openItems)
      .where(and(inArray(openItems.siteId, siteIds), eq(openItems.status, "open")))
      .groupBy(openItems.siteId);
    return new Map(rows.map((r) => [r.siteId, r.count]));
  }

  async list(status: "open" | "closed", closedSince: string | undefined, siteId: string | undefined): Promise<{ items: Schemas["OpenItem"][] }> {
    const rows = await this.db
      .select()
      .from(openItems)
      .where(
        and(
          eq(openItems.status, status),
          siteId ? eq(openItems.siteId, siteId) : undefined,
          status === "closed" && closedSince ? gte(openItems.closedOn, closedSince) : undefined,
        ),
      )
      .orderBy(status === "open" ? asc(openItems.openedOn) : desc(openItems.closedOn), asc(openItems.createdAt));
    return { items: rows.map((r) => this.toApi(r)) };
  }

  async applyApproval(tx: Tx, input: { siteId: string; reportId: string; localDate: string; reviews: Review[]; newItems: NewItem[] }) {
    for (const review of input.reviews) {
      if (review.outcome === null) continue;
      const [item] = await tx
        .select()
        .from(openItems)
        .where(and(eq(openItems.id, review.openItemId), eq(openItems.siteId, input.siteId), eq(openItems.status, "open")));
      if (!item) continue;
      const note = review.note?.trim() ? review.note.trim() : null;
      if (review.outcome === "close") {
        await tx
          .update(openItems)
          .set({ status: "closed", closedOn: input.localDate, closingNote: note, lastUpdate: { localDate: input.localDate, note: note ?? "fechado" } })
          .where(eq(openItems.id, item.id));
      } else if (review.outcome === "update" || note) {
        await tx.update(openItems).set({ lastUpdate: { localDate: input.localDate, note: note ?? "atualizado" } }).where(eq(openItems.id, item.id));
      }
    }
    const fresh = input.newItems.filter((n) => n.track === true && n.title && n.kind);
    if (fresh.length > 0) {
      await tx.insert(openItems).values(
        fresh.map((n) => ({ siteId: input.siteId, title: n.title ?? "", kind: n.kind ?? "declared_pending", openedOn: input.localDate, openedInReportId: input.reportId })),
      );
    }
  }
}
