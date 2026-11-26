import { AI, approve, call, check, complete, db, done, entry, generate, media, randomUUID, site, today } from "./lib.mts";

// Montagem atrasada não sobrescreve RDO aprovado nem montagem mais nova (B11). Roda com E2E_AI=fake.
if (AI !== "fake") throw new Error("Rode com E2E_AI=fake e a API em AI_FAKE=true.");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const wait = async <T>(read: () => Promise<T>, until: (value: T) => boolean, ms = 30_000) => {
  let value = await read();
  for (const start = Date.now(); !until(value) && Date.now() - start < ms; value = await read()) await sleep(300);
  return value;
};
const reportOf = (id: string) => call("GET", `/v1/reports/${id}`).then((r) => r.json);
const processed = (id: string) => wait(() => call("GET", `/v1/entries/${id}`).then((r) => r.json), (x) => x.status === "failed" || (x.status === "processed" && x.title !== null));
const audio = (text: string) => media("audio", "audio/webm", { text });
const pg = await db();
const age = (id: string) => pg.query("update reports set updated_at = now() - interval '10 minutes' where id = $1", [id]);
const builds = (r: any) => r.history.filter((h: any) => h.description.startsWith("Argos preencheu")).length;

// aprovar durante uma montagem atrasada
const s = await site("Atraso " + randomUUID().slice(0, 6));
await processed((await entry(s.id, today, 3, { audioMediaId: await audio("Jornada 7h às 17h. Sol. 5 pedreiros na concretagem.") })).json.id);
const g = await generate(s.id, today);
await wait(() => reportOf(g.json.id), (x) => x.status !== "generating");
await call("PATCH", `/v1/reports/${g.json.id}`, complete());
await processed((await entry(s.id, today, 0, { audioMediaId: await audio("#lento-ia=10000\nAlvenaria no bloco B.") })).json.id);
const slow = await generate(s.id, today);
check("montagem lenta começou", slow.status === 202 && slow.json.status === "generating", slow.json?.status);
await age(g.json.id);
const a = await approve(g.json.id);
check("aprova durante a montagem presa", a.status === 200 && a.json.status === "approved", [a.status, a.json?.code]);
await sleep(13_000);
const after = await reportOf(g.json.id);
check("continua aprovado e com o mesmo número", after.status === "approved" && after.number === a.json.number, [after.status, after.number, a.json.number]);
check("conteúdo e histórico do aprovado intactos", JSON.stringify(after.activities) === JSON.stringify(a.json.activities) && after.history.length === a.json.history.length && after.history.at(-1).description === "RDO aprovado", [after.activities, after.history.at(-1)]);

// gerar de novo durante uma montagem atrasada: só a mais nova grava
const s2 = await site("Atraso2 " + randomUUID().slice(0, 6));
await processed((await entry(s2.id, today, 3, { audioMediaId: await audio("#lento-ia=8000\nJornada 7h às 17h. 5 pedreiros.") })).json.id);
const first = await generate(s2.id, today);
await sleep(1000);
await age(first.json.id);
const second = await generate(s2.id, today);
check("gerar de novo com a montagem presa abre outra", second.status === 202 && second.json.status === "generating", second.json?.status);
const done2 = await wait(() => reportOf(first.json.id), (x) => x.status !== "generating");
await sleep(3000);
const final = await reportOf(first.json.id);
check("só a montagem mais nova entra no histórico", done2.status === "draft" && builds(final) === 1, final.history.map((h: any) => h.description));

// corrigir à mão um RDO preso em generating encerra a montagem antiga
const s3 = await site("Atraso3 " + randomUUID().slice(0, 6));
await processed((await entry(s3.id, today, 3, { audioMediaId: await audio("#lento-ia=8000\nJornada 7h às 17h. 5 pedreiros.") })).json.id);
const g3 = await generate(s3.id, today);
await age(g3.json.id);
const p3 = await call("PATCH", `/v1/reports/${g3.json.id}`, { laborNotes: "corrigido à mão" });
check("PATCH no RDO preso volta a rascunho", p3.status === 200 && p3.json.status === "draft", [p3.status, p3.json?.status]);
await sleep(10_000);
const r3 = await reportOf(g3.json.id);
check("a montagem antiga não sobrescreve a correção", r3.status === "draft" && r3.laborNotes === "corrigido à mão" && builds(r3) === 0, [r3.status, r3.laborNotes, r3.history.map((h: any) => h.description)]);
await pg.end();
done();
