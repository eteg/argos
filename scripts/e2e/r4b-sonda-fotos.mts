import { approve, call, check, complete, db, done, entry, media, randomUUID, site, today, TZ } from "./lib.mts";

// Simula um dia que passou de 20 fotos antes da trava (registros gravados direto no banco).
const pg = await db();
const s = await site("Fotos " + randomUUID().slice(0, 6));
for (let i = 0; i < 6; i++) await entry(s.id, today, 3);
for (let i = 0; i < 2; i++) {
  const photos = [await media("photo"), await media("photo")];
  await pg.query(
    "insert into entries (id, site_id, captured_at, local_date, timezone, audio_media_id, photo_media_ids) values ($1, $2, now(), $3, $4, $5, $6)",
    [randomUUID(), s.id, today, TZ, await media("audio"), photos],
  );
}
const total = (await pg.query("select sum(cardinality(photo_media_ids))::int as n from entries where site_id = $1", [s.id])).rows[0].n;
check("dia com 22 fotos no banco", total === 22, total);

const day = await call("GET", `/v1/sites/${s.id}/days/${today}`);
check("getDay 200", day.status === 200, day.status);
const g = await call("POST", `/v1/sites/${s.id}/days/${today}/report`);
check("generate 202 com 20 fotos", g.status === 202 && g.json.photos.length === 20, [g.status, g.json?.code, g.json?.photos?.length]);
check("history avisa as fotos de fora", g.json?.history?.at(-1)?.description.includes("2 foto(s) ficaram de fora"), g.json?.history?.at(-1));
const rep = await call("GET", `/v1/reports/${g.json.id}`);
check("getReport 200", rep.status === 200, [rep.status, rep.json?.code]);

// RDO gravado com 22 fotos no conteúdo (antes do teto na montagem) também abre e aprova
const content = (await pg.query("select content from reports where id = $1", [g.json.id])).rows[0].content;
const extra = await Promise.all([media("photo"), media("photo")]);
content.photos.push(...extra.map((id) => ({ ...content.photos[0], id })));
await pg.query("update reports set content = $2 where id = $1", [g.json.id, JSON.stringify(content)]);
const legacy = await call("GET", `/v1/reports/${g.json.id}`);
check("getReport de conteúdo com 22 fotos 200 e mostra 20", legacy.status === 200 && legacy.json.photos.length === 20, [legacy.status, legacy.json?.photos?.length]);
const p = await call("PATCH", `/v1/reports/${g.json.id}`, complete());
check("updateReport 200", p.status === 200, [p.status, p.json?.code, p.json?.errors]);
const a = await approve(g.json.id);
check("aprova 200", a.status === 200 && a.json.photos.length === 20, [a.status, a.json?.code]);
const st = await call("PUT", `/v1/sites/${s.id}/status`, { status: "completed" });
check("conclui a obra 200", st.status === 200, [st.status, st.json?.code]);
await pg.end();
done();
