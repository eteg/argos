import { approve, approvedDay, call, check, complete, daysAgo, done, entry, generate, media, randomUUID, site, today, TZ } from "./lib.mts";

// aprovação concorrente, chaves diferentes
const s = await site("Conc " + randomUUID().slice(0, 6));
await approvedDay(s.id, daysAgo(2));
await entry(s.id, daysAgo(1), 3);
const g = (await generate(s.id, daysAgo(1))).json;
await call("PATCH", `/v1/reports/${g.id}`, complete());
const results = await Promise.all(Array.from({ length: 10 }, () => approve(g.id)));
const ok = results.filter((r) => r.status === 200);
const conflict = results.filter((r) => r.status === 409 && r.json.code === "REPORT_ALREADY_APPROVED");
check("10 chaves diferentes: 1 aprova, 9 recebem 409", ok.length === 1 && conflict.length === 9, results.map((r) => [r.status, r.json?.code]));
check("número 2 (sem repetir nem pular)", ok[0]?.json.number === 2, ok[0]?.json.number);
const hist = (await call("GET", `/v1/reports/${g.id}`)).json.history.filter((h: any) => h.description === "RDO aprovado");
check("um 'RDO aprovado' só no history", hist.length === 1, hist.length);

// aprovação concorrente, mesma chave (retentativa do mesmo toque)
await entry(s.id, today, 3);
const g2 = (await generate(s.id, today)).json;
await call("PATCH", `/v1/reports/${g2.id}`, complete());
const key = randomUUID();
const same = await Promise.all(Array.from({ length: 6 }, () => approve(g2.id, key)));
check("mesma chave em paralelo: todas 200", same.every((r) => r.status === 200), same.map((r) => [r.status, r.json?.code]));
const list = (await call("GET", `/v1/sites/${s.id}/reports`)).json.items;
check("números 3,2,1 sem buraco", JSON.stringify(list.map((r: any) => r.number)) === "[3,2,1]", list.map((r: any) => [r.localDate, r.number]));

// generate concorrente do mesmo dia novo
const s2 = await site("Gen " + randomUUID().slice(0, 6));
await entry(s2.id, today, 3);
const gens = await Promise.all(Array.from({ length: 6 }, () => generate(s2.id, today)));
const ids = new Set(gens.filter((r) => r.status === 202).map((r) => r.json.id));
check("6 generate em paralelo: todos 202 e o mesmo id", gens.every((r) => r.status === 202) && ids.size === 1, gens.map((r) => [r.status, r.json?.code]));

// createEntry concorrente com o mesmo id (fila reenviando)
const audio = await media("audio");
const eid = randomUUID();
const body = { id: eid, capturedAt: new Date().toISOString(), localDate: today, timezone: TZ, audioMediaId: audio, photoMediaIds: [] };
const ce = await Promise.all(Array.from({ length: 5 }, () => call("POST", `/v1/sites/${s2.id}/entries`, body)));
check("createEntry mesmo id em paralelo: 201 + 200s, sem 500", ce.every((r) => r.status === 201 || r.status === 200), ce.map((r) => [r.status, r.json?.code]));

// uploadMedia concorrente com o mesmo id
const mid = randomUUID();
const ups = await Promise.all(Array.from({ length: 5 }, () => media("photo", "image/jpeg", { id: mid }).then(() => 200, (e: Error) => e.message.slice(0, 40))));
check("uploadMedia mesmo id em paralelo: sem erro", ups.every((x) => x === 200), ups);

// limite de 20 fotos com envios em paralelo
const s3 = await site("Fotos " + randomUUID().slice(0, 6));
const day = daysAgo(1);
for (let i = 0; i < 6; i++) await entry(s3.id, day, 3);
const par = await Promise.all(Array.from({ length: 3 }, () => entry(s3.id, day, 2)));
const accepted = par.filter((r) => r.status === 201).length;
const totalPhotos = (await call("GET", `/v1/sites/${s3.id}/days/${day}`)).json.entries.reduce((n: number, e: any) => n + e.photos.length, 0);
check("18 fotos + 3 envios de 2 em paralelo: dia não passa de 20", totalPhotos <= 20, { accepted, totalPhotos, statuses: par.map((r) => [r.status, r.json?.code]) });
if (totalPhotos > 20) {
  const gr = await generate(s3.id, day);
  console.log("     info: generate com", totalPhotos, "fotos ->", gr.status, gr.json?.code ?? gr.json?.status);
  const gr2 = await call("GET", `/v1/reports/${gr.json?.id}`);
  console.log("     info: getReport ->", gr2.status, gr2.json?.code ?? gr2.json?.status);
}

// PATCH concorrendo com a aprovação (B14): nunca aprova conteúdo não validado nem perde linha do histórico
const s5 = await site("Patch " + randomUUID().slice(0, 6));
const races: unknown[] = [];
for (let i = 0; i < 6; i++) {
  const d = daysAgo(8 - i);
  await entry(s5.id, d, 3);
  const r = (await generate(s5.id, d)).json;
  await call("PATCH", `/v1/reports/${r.id}`, complete());
  const [p, a] = await Promise.all([call("PATCH", `/v1/reports/${r.id}`, { labor: [], laborNotes: `corrida ${i}` }), approve(r.id)]);
  const final = (await call("GET", `/v1/reports/${r.id}`)).json;
  const lines = final.history.map((h: any) => h.description);
  const bad =
    (a.status === 200 && final.labor.length === 0) ||
    (p.status === 200 && !lines.some((l: string) => l.startsWith("Corrigiu"))) ||
    (a.status === 200 && !lines.includes("RDO aprovado")) ||
    ![200, 409].includes(p.status) ||
    ![200, 409].includes(a.status);
  races.push({ patch: p.status, approve: a.status, approvedLabor: final.labor.length, lines: lines.length, bad });
  if (a.status !== 200) {
    await call("PATCH", `/v1/reports/${r.id}`, complete());
    await approve(r.id);
  }
}
check("PATCH x aprovação em paralelo: sem aprovar vazio nem perder histórico", races.every((r: any) => !r.bad), races);

// aprovação fora de ordem: hoje gerado antes de chegar o registro offline de ontem
const s4 = await site("Ordem " + randomUUID().slice(0, 6));
await entry(s4.id, today, 3);
const t = (await generate(s4.id, today)).json;
await entry(s4.id, daysAgo(1), 3, { offline: true });
const y = (await generate(s4.id, daysAgo(1))).json;
await call("PATCH", `/v1/reports/${t.id}`, complete());
await call("PATCH", `/v1/reports/${y.id}`, complete());
const at = await approve(t.id);
check("hoje não aprova com ontem pendente (D04)", at.status === 409, { status: at.status, code: at.json?.code, number: at.json?.number });
const ay = await approve(y.id);
console.log("     info: números: hoje =", at.json?.number, "ontem =", ay.json?.number);
check("número segue a data (D11)", !(at.status === 200 && ay.status === 200) || at.json.number > ay.json.number, { hoje: at.json?.number, ontem: ay.json?.number });
done();
