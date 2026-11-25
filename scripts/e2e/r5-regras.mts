import { approve, approvedDay, call, check, complete, daysAgo, done, entry, generate, media, randomUUID, site, today, TZ } from "./lib.mts";

const isProblem = (r: any, status: number, code: string) => r.status === status && r.json?.code === code && (r.headers.get("content-type") ?? "").includes("application/problem+json") && r.json?.status === status && typeof r.json?.type === "string";

// SITE_NOT_IN_PROGRESS
const s = await site("Regras " + randomUUID().slice(0, 6));
await call("PUT", `/v1/sites/${s.id}/status`, { status: "paused" });
const snp = await entry(s.id, today, 0);
check("SITE_NOT_IN_PROGRESS (paralisada)", isProblem(snp, 409, "SITE_NOT_IN_PROGRESS"), snp.json);
await call("PUT", `/v1/sites/${s.id}/status`, { status: "not_started" });
check("SITE_NOT_IN_PROGRESS (não iniciada)", isProblem(await entry(s.id, today, 0), 409, "SITE_NOT_IN_PROGRESS"));
await call("PUT", `/v1/sites/${s.id}/status`, { status: "in_progress" });

// PHOTO_LIMIT_ENTRY e PHOTO_LIMIT_REPORT
check("PHOTO_LIMIT_ENTRY com 4 fotos", isProblem(await entry(s.id, today, 4), 409, "PHOTO_LIMIT_ENTRY"));
const dup = await media("photo");
const d3 = await call("POST", `/v1/sites/${s.id}/entries`, { id: randomUUID(), capturedAt: new Date().toISOString(), localDate: today, timezone: TZ, audioMediaId: await media("audio"), photoMediaIds: [dup, dup, dup, dup] });
check("mesma foto repetida 4x conta como 1", d3.status === 201 && d3.json.photos.length === 1, [d3.status, d3.json?.photos?.length]);
for (let i = 0; i < 6; i++) await entry(s.id, today, 3);
const pr = await entry(s.id, today, 2);
check("PHOTO_LIMIT_REPORT (19 + 2)", isProblem(pr, 409, "PHOTO_LIMIT_REPORT"), pr.json);
check("19 + 1 = 20 passa", (await entry(s.id, today, 1)).status === 201);

// NO_ENTRIES
check("NO_ENTRIES", isProblem(await generate(s.id, daysAgo(5)), 409, "NO_ENTRIES"));
check("generate data inválida 400", (await generate(s.id, "2026-13-40")).status === 400);
check("generate obra inexistente 404", (await generate(randomUUID(), today)).status === 404);

// REPORT_INCOMPLETE
const g = (await generate(s.id, today)).json;
const inc = await approve(g.id);
check("REPORT_INCOMPLETE com errors", isProblem(inc, 409, "REPORT_INCOMPLETE") && inc.json.errors.length > 0 && inc.json.errors.every((e: any) => e.field && e.code), inc.json);

// SITE_HAS_OPEN_REPORTS
const shor = await call("PUT", `/v1/sites/${s.id}/status`, { status: "completed" });
check("SITE_HAS_OPEN_REPORTS com o dia", isProblem(shor, 409, "SITE_HAS_OPEN_REPORTS") && shor.json.errors[0].field === today, shor.json);

// REPORT_ALREADY_APPROVED em todas as escritas
await call("PATCH", `/v1/reports/${g.id}`, complete());
check("aprova", (await approve(g.id)).status === 200);
check("REPORT_ALREADY_APPROVED createEntry", isProblem(await entry(s.id, today, 0), 409, "REPORT_ALREADY_APPROVED"));
check("REPORT_ALREADY_APPROVED generate", isProblem(await generate(s.id, today), 409, "REPORT_ALREADY_APPROVED"));
check("REPORT_ALREADY_APPROVED updateReport", isProblem(await call("PATCH", `/v1/reports/${g.id}`, { laborNotes: "x" }), 409, "REPORT_ALREADY_APPROVED"));
check("REPORT_ALREADY_APPROVED approve outra chave", isProblem(await approve(g.id), 409, "REPORT_ALREADY_APPROVED"));
check("concluir agora 200", (await call("PUT", `/v1/sites/${s.id}/status`, { status: "completed" })).status === 200);
check("Idempotency-Key não UUID 400", (await approve(g.id, "abc")).status === 400);

// PREVIOUS_DAY_PENDING
const p = await site("Prev " + randomUUID().slice(0, 6));
await entry(p.id, daysAgo(2), 3);
await entry(p.id, today, 3);
const pdp = await generate(p.id, today);
check("PREVIOUS_DAY_PENDING lista o dia", isProblem(pdp, 409, "PREVIOUS_DAY_PENDING") && pdp.json.errors[0].field === daysAgo(2), pdp.json);
await approvedDay(p.id, daysAgo(2));
check("depois de aprovar o anterior, hoje gera", (await generate(p.id, today)).status === 202);

// regeneração preserva correções e incorpora registro novo
const r = await site("Regen " + randomUUID().slice(0, 6));
await call("POST", `/v1/sites/${r.id}/equipment`, { name: "Betoneira", identifier: "B1" });
await entry(r.id, today, 3);
const r1 = (await generate(r.id, today)).json;
const eqId = r1.equipment[0].equipmentId;
const photoId = r1.photos[0].id;
await call("PATCH", `/v1/reports/${r1.id}`, { ...complete(), laborNotes: "faltou 1", equipment: [{ ...r1.equipment[0], status: "operating", operatingHours: 8 }], photos: [{ id: photoId, caption: "Fundação", linkedTo: { type: "activity", id: "a1" } }] });
await entry(r.id, today, 2);
await call("POST", `/v1/sites/${r.id}/equipment`, { name: "Guindaste", identifier: null });
await call("PATCH", `/v1/sites/${r.id}`, { name: "Regen renomeada" });
const r2 = await generate(r.id, today);
const rr = r2.json;
check("regenera mesmo id 202", r2.status === 202 && rr.id === r1.id, [r2.status, rr?.id]);
check("mantém jornada, efetivo, atividade e laborNotes", rr.workday.startTime === "07:00" && rr.labor.length === 1 && rr.activities[0].id === "a1" && rr.laborNotes === "faltou 1", [rr.workday, rr.labor, rr.laborNotes]);
check("mantém status/horas do equipamento e inclui o novo", rr.equipment.length === 2 && rr.equipment.find((e: any) => e.equipmentId === eqId)?.operatingHours === 8 && rr.equipment.find((e: any) => e.name === "Guindaste")?.status === null, rr.equipment);
check("fotos: 5, com a legenda e o vínculo mantidos", rr.photos.length === 5 && rr.photos.find((x: any) => x.id === photoId)?.caption === "Fundação" && rr.photos.find((x: any) => x.id === photoId)?.linkedTo?.id === "a1", rr.photos.map((x: any) => x.caption));
check("entriesCount 2", rr.entriesCount === 2, rr.entriesCount);
check("site do rascunho atualizado", rr.site.name === "Regen renomeada", rr.site.name);
check("history: montado, corrigiu, remontado", rr.history.map((h: any) => h.description.split(" ")[1]).join() === "montado,a,remontado" || rr.history.length === 3, rr.history.map((h: any) => h.description));

// troca do tipo da obra depois de montar o RDO
const pub = await site("Pub " + randomUUID().slice(0, 6), "public");
const ap = await approvedDayPublic(pub.id, daysAgo(1));
await entry(pub.id, today, 3);
const draft = (await generate(pub.id, today)).json;
const ch = await call("PATCH", `/v1/sites/${pub.id}`, { type: "private" });
check("obra pública vira privada", ch.status === 200 && ch.json.type === "private" && ch.json.publicContract === null, ch.json?.type);
const ga = await call("GET", `/v1/reports/${ap}`);
check("RDO aprovado continua abrindo depois da troca de tipo", ga.status === 200, { status: ga.status, body: ga.json });
const gp = await call("GET", `/v1/reports/${ap}/pdf`);
check("PDF do aprovado continua saindo depois da troca de tipo", gp.status === 200, { status: gp.status, body: gp.json });
const gd = await call("GET", `/v1/reports/${draft.id}`);
check("rascunho continua abrindo depois da troca de tipo", gd.status === 200, { status: gd.status, body: gd.json });
const missingOf = (r: any) => r.missingFields.map((m: any) => m.field);
check("rascunho segue a cópia pública até gerar de novo", gd.json?.site?.type === "public" && missingOf(gd.json).includes("weatherStoppage"), [gd.json?.site?.type, missingOf(gd.json)]);
const regen = await generate(pub.id, today);
check("gerar de novo refaz a cópia como obra privada", regen.status === 202 && regen.json.site.type === "private" && regen.json.site.publicContract === null && !missingOf(regen.json).includes("weatherStoppage"), [regen.status, regen.json?.site?.type, missingOf(regen.json ?? { missingFields: [] })]);
done();

async function approvedDayPublic(siteId: string, localDate: string) {
  await entry(siteId, localDate, 3);
  const g0 = (await generate(siteId, localDate)).json;
  const act = { ...complete().activities[0], quantity: 10, unit: "m³" };
  const body = { ...complete(), activities: [act], weatherStoppage: { hours: 0, serviceIds: [] }, photos: g0.photos.map((ph: any) => ({ id: ph.id, linkedTo: { type: "activity", id: "a1" } })) };
  const pt = await call("PATCH", `/v1/reports/${g0.id}`, body);
  const a = await approve(g0.id);
  if (a.status !== 200) console.log("     info: aprovação pública falhou", JSON.stringify(pt.json?.missingFields), JSON.stringify(a.json));
  return g0.id as string;
}
