import { sql } from "drizzle-orm";
import type { Database } from "./database.module.js";

type Executor = Pick<Database, "execute">;

export async function lockDay(tx: Executor, siteId: string, localDate: string) {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${siteId}), hashtext(${localDate}))`);
}

export async function pendingDaysBefore(tx: Executor, siteId: string, localDate: string) {
  const result = await tx.execute<{ local_date: string }>(sql`
    select distinct e.local_date::text as local_date from entries e
    where e.site_id = ${siteId} and e.local_date < ${localDate}
      and not exists (select 1 from reports r where r.site_id = e.site_id and r.local_date = e.local_date and r.status = 'approved')
    order by 1`);
  return result.rows.map((r) => r.local_date);
}
