import { readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AI, call, check, done, entry, generate, media, randomUUID, site, today } from "./lib.mts";

// Registro e montagem interrompidos por um reinício da API (B12). Roda com E2E_AI=fake, em duas fases:
//   E2E_AI=fake tsx ia-reinicio.mts preparar   -> deixa um registro em processing e um RDO em generating
//   (mate a API com kill -9 e suba de novo)
//   E2E_AI=fake tsx ia-reinicio.mts conferir   -> em até 1 minuto, os dois saem do estado preso
if (AI !== "fake") throw new Error("Rode com E2E_AI=fake e a API em AI_FAKE=true.");
const STATE = join(tmpdir(), "argos-e2e-ia-reinicio.json");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const audio = (text: string) => media("audio", "audio/webm", { text });

if (process.argv[2] === "preparar") {
  const s = await site("Reinicio " + randomUUID().slice(0, 6));
  const e = await entry(s.id, today, 3, { audioMediaId: await audio("#lento=20000\nJornada 7h às 17h. 5 pedreiros.") });
  check("registro em processing", e.status === 202 && e.json.status === "processing", e.json?.status);
  const s2 = await site("Reinicio2 " + randomUUID().slice(0, 6));
  const e2 = await entry(s2.id, today, 3, { audioMediaId: await audio("#lento-ia=60000\nJornada 7h às 17h.") });
  for (let i = 0; i < 50 && (await call("GET", `/v1/entries/${e2.json.id}`)).json.status === "processing"; i++) await sleep(200);
  const g = await generate(s2.id, today);
  check("RDO em generating", g.status === 202 && g.json.status === "generating", g.json?.status);
  writeFileSync(STATE, JSON.stringify({ entryId: e.json.id, reportId: g.json.id }));
} else {
  const { entryId, reportId } = JSON.parse(readFileSync(STATE, "utf8")) as { entryId: string; reportId: string };
  const start = Date.now();
  let e = (await call("GET", `/v1/entries/${entryId}`)).json;
  while (e.status === "processing" && Date.now() - start < 60_000) {
    await sleep(500);
    e = (await call("GET", `/v1/entries/${entryId}`)).json;
  }
  const seconds = Math.round((Date.now() - start) / 1000);
  check("registro preso termina processed ou failed em até 1 minuto", e.status === "processed" || e.status === "failed", { status: e.status, seconds });
  check("e foi transcrito de novo depois do reinício", e.status === "processed" && e.transcript?.includes("5 pedreiros"), e.transcript);
  console.log(`     info: registro saiu de processing em ${seconds} s`);
  const r = (await call("GET", `/v1/reports/${reportId}`)).json;
  check("RDO preso volta a rascunho com aviso no histórico", r.status === "draft" && r.history.at(-1).description.includes("API reiniciou"), [r.status, r.history.at(-1)]);

  // a montagem avisa quando deixa registros de fora
  const s3 = await site("Fora " + randomUUID().slice(0, 6));
  const ok = await entry(s3.id, today, 3, { audioMediaId: await audio("Jornada 7h às 17h. 5 pedreiros.") });
  const bad = await entry(s3.id, today, 0, { audioMediaId: await audio("#falha") });
  for (let i = 0; i < 50; i++) {
    const states = await Promise.all([ok, bad].map(async (x) => (await call("GET", `/v1/entries/${x.json.id}`)).json.status));
    if (!states.includes("processing")) break;
    await sleep(200);
  }
  const g3 = await generate(s3.id, today);
  let r3 = g3.json;
  for (let i = 0; i < 100 && r3.status === "generating"; i++) {
    await sleep(300);
    r3 = (await call("GET", `/v1/reports/${g3.json.id}`)).json;
  }
  const note = r3.history.find((h: any) => h.description.startsWith("Argos preencheu"))?.description ?? "";
  check("histórico avisa o registro que ficou de fora", note.includes("1 registro(s) ficaram de fora"), r3.history.map((h: any) => h.description));
}
done();
