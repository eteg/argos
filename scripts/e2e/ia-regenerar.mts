import { AI, call, check, done, entry, generate, media, randomUUID, site, today } from "./lib.mts";

// Gerar de novo recalcula com a IA tudo o que o engenheiro não editou (B2). Roda com E2E_AI=fake.
if (AI !== "fake") throw new Error("Rode com E2E_AI=fake e a API em AI_FAKE=true.");

const wait = async <T>(read: () => Promise<T>, until: (value: T) => boolean, ms = 30_000) => {
  let value = await read();
  for (const start = Date.now(); !until(value) && Date.now() - start < ms; value = await read()) await new Promise((r) => setTimeout(r, 300));
  return value;
};
const reportOf = (id: string) => call("GET", `/v1/reports/${id}`).then((r) => r.json);
const processed = (id: string) => wait(() => call("GET", `/v1/entries/${id}`).then((r) => r.json), (x) => x.status === "failed" || (x.status === "processed" && x.title !== null));
const audio = (text: string) => media("audio", "audio/webm", { text });

const s = await site("Regera " + randomUUID().slice(0, 6));
const e1 = await entry(s.id, today, 3, { audioMediaId: await audio("Jornada 7h às 17h, intervalo de 60 min. Sol o dia todo.\n5 pedreiros na concretagem da laje.\nFaltou cimento de manhã.") });
await processed(e1.json.id);
const g1 = await generate(s.id, today);
const r1 = await wait(() => reportOf(g1.json.id), (x) => x.status !== "generating");
check("primeira montagem", r1.status === "draft" && r1.workday.startTime === "07:00" && r1.labor.length === 1 && r1.occurrences.length === 1 && r1.occurrences[0].type === "material_shortage", [r1.status, r1.workday, r1.labor]);

const p = await call("PATCH", `/v1/reports/${g1.json.id}`, { workday: { ...r1.workday, startTime: "06:30" } });
check("engenheiro corrige o início da jornada", p.status === 200 && p.json.workday.startTime === "06:30", p.json?.workday);

const e2 = await entry(s.id, today, 0, { audioMediaId: await audio("Houve um acidente: um servente torceu o pé na escada.\nJornada 7h às 18h. Agora são 5 pedreiros e 3 serventes.") });
await processed(e2.json.id);
const g2 = await generate(s.id, today);
check("gerar de novo 202 com o mesmo RDO", g2.status === 202 && g2.json.id === g1.json.id, [g2.status, g2.json?.id]);
const r2 = await wait(() => reportOf(g1.json.id), (x) => x.status !== "generating");
const accident = r2.occurrences.find((o: any) => o.type === "accident");
check("a ocorrência de acidente do registro novo aparece junto da que já havia", r2.status === "draft" && accident !== undefined && r2.occurrences.length === 2, r2.occurrences);
check("existe a pergunta de segurança (F1RN04)", r2.questions.some((q: any) => q.kind === "safety" && q.status === "open" && q.field === `occurrences.${r2.occurrences.indexOf(accident)}.safety`), r2.questions);
check("a segurança é cobrada em missingFields", r2.missingFields.some((m: any) => m.field.endsWith(".safety")), r2.missingFields);
check("o início editado continua", r2.workday.startTime === "06:30", r2.workday);
check("o fim, não editado, foi recalculado", r2.workday.endTime === "18:00", r2.workday);
check("o efetivo, não editado, foi recalculado", r2.labor.length === 2 && r2.labor.some((l: any) => l.role === "Servente" && l.count === 3), r2.labor);
check("history registra as duas montagens", r2.history.filter((h: any) => h.actor === "agent" && h.description.startsWith("Argos preencheu")).length === 2, r2.history.map((h: any) => h.description));
done();
