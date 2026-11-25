import { call, db } from "./lib.mts";
const pg = await db();
const r = await pg.query("select s.id as site, e.local_date::text as d, sum(cardinality(e.photo_media_ids))::int as n from entries e join sites s on s.id = e.site_id where s.name like 'Fotos %' group by 1,2 having sum(cardinality(e.photo_media_ids)) > 20");
for (const row of r.rows) {
  const day = await call("GET", `/v1/sites/${row.site}/days/${row.d}`);
  console.log("fotos no dia:", row.n, "| getDay:", day.status, "report:", JSON.stringify(day.json?.report));
  if (day.json?.report) {
    const rep = await call("GET", `/v1/reports/${day.json.report.id}`);
    console.log("getReport:", rep.status, rep.json?.code);
    const p = await call("PATCH", `/v1/reports/${day.json.report.id}`, { laborNotes: "x" });
    console.log("updateReport:", p.status, p.json?.code, JSON.stringify(p.json?.errors));
  }
  const st = await call("PUT", `/v1/sites/${row.site}/status`, { status: "completed" });
  console.log("concluir obra:", st.status, st.json?.code);
}
await pg.end();
