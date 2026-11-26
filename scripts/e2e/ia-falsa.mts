import { AI, call, check, db, done, entry, generate, media, randomUUID, site, today } from "./lib.mts";

// Roda com a API em AI_ENABLED=true e AI_FAKE=true (E2E_AI=fake).
if (AI !== "fake") throw new Error("Rode com E2E_AI=fake e a API em AI_FAKE=true.");

const wait = async <T>(read: () => Promise<T>, until: (value: T) => boolean, ms = 20_000) => {
  let value = await read();
  for (const start = Date.now(); !until(value) && Date.now() - start < ms; value = await read()) await new Promise((r) => setTimeout(r, 300));
  return value;
};
const entryOf = (id: string) => call("GET", `/v1/entries/${id}`).then((r) => r.json);
const reportOf = (id: string) => call("GET", `/v1/reports/${id}`).then((r) => r.json);

const s = await site("Falsa " + randomUUID().slice(0, 6));
const e = await entry(s.id, today, 3, { audioMediaId: await media("audio", "audio/webm", { text: "Jornada 7h às 17h, intervalo de 60 min. Sol o dia todo.\n5 pedreiros na concretagem da laje." }) });
check("createEntry 202 processing", e.status === 202 && e.json.status === "processing", e);
const done1 = await wait(() => entryOf(e.json.id), (x) => x.status === "failed" || (x.status === "processed" && x.title !== null));
check("registro processado com a transcrição falsa", done1.status === "processed" && done1.transcript.startsWith("Jornada 7h") && typeof done1.title === "string", done1);

const g = await generate(s.id, today);
check("generate 202 generating", g.status === 202 && g.json.status === "generating", g.json?.status);
const r = await wait(() => reportOf(g.json.id), (x) => x.status !== "generating");
check("RDO montado pela IA falsa", r.status === "draft" && r.workday.startTime === "07:00" && r.labor[0]?.count === 5 && r.activities[0]?.description === "Concretagem da laje" && r.weather[0].weather === "good", [r.status, r.workday, r.labor, r.activities]);

const vc = await call("POST", `/v1/reports/${g.json.id}/voice-corrections`, { audioMediaId: await media("audio", "audio/webm", { text: "Observação do efetivo: faltou um servente" }) });
check("correção falada 202", vc.status === 202, vc);
const r2 = await wait(() => reportOf(g.json.id), (x) => x.status !== "generating");
check("correção falada aplicada", r2.laborNotes === "faltou um servente" && r2.history.at(-1).description.startsWith("Corrigiu por voz"), [r2.laborNotes, r2.history.at(-1)]);

// resposta falada segue o caminho da digitada (B15)
const pg = await db();
const ask = async (field: string, text: string) =>
  (await pg.query("insert into questions (report_id, kind, text, field, options) values ($1, 'missing_field', $2, $3, '[]') returning id", [g.json.id, text, field])).rows[0].id as string;
const qBreak = await ask("workday.breakMinutes", "Quantos minutos de intervalo?");
const spoken = await call("POST", `/v1/questions/${qBreak}/answer`, { audioMediaId: await media("audio", "audio/webm", { text: "45" }) });
check("resposta falada 202", spoken.status === 202 && spoken.json.answer.audioMediaId !== null, spoken.json);
const applied = await wait(() => reportOf(g.json.id), (x) => x.workday.breakMinutes === 45);
check("resposta falada aplicada no campo como a digitada", applied.workday.breakMinutes === 45 && applied.history.at(-1).description.startsWith("Respondeu"), [applied.workday, applied.history.at(-1)]);
const answered = applied.questions.find((q: any) => q.id === qBreak);
check("a transcrição fica na resposta", answered?.answer?.text === "45" && answered?.status === "answered", answered);
const qLabor = await ask("labor", "Quantas pessoas trabalharam?");
const before = await reportOf(g.json.id);
await call("POST", `/v1/questions/${qLabor}/answer`, { audioMediaId: await media("audio", "audio/webm", { text: "dois serventes" }) });
const kept = await wait(() => reportOf(g.json.id), (x) => x.questions.find((q: any) => q.id === qLabor)?.answer?.text !== null);
check("resposta falada a campo estruturado fica só na pergunta", kept.questions.find((q: any) => q.id === qLabor)?.answer?.text === "dois serventes" && JSON.stringify(kept.labor) === JSON.stringify(before.labor), kept.labor);
await pg.end();

const diag = await call("POST", "/v1/diagnostics/ai");
check("diagnóstico responde com o modelo falso", diag.status === 200 && diag.json.model === "fake", diag.json);
done();
