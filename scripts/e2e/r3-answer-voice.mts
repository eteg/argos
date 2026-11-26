import { AI, approve, call, check, complete, daysAgo, db, done, entry, generateReady as generate, media, randomUUID, site, today } from "./lib.mts";

const pg = await db();
async function q(v: { report_id?: string; entry_id?: string; kind: string; text: string; field?: string | null; open_item_id?: string; options: unknown[] }) {
  const res = await pg.query(
    "insert into questions (report_id, entry_id, kind, text, field, open_item_id, options) values ($1, $2, $3, $4, $5, $6, $7) returning id",
    [v.report_id ?? null, v.entry_id ?? null, v.kind, v.text, v.field ?? null, v.open_item_id ?? null, JSON.stringify(v.options)],
  );
  return res.rows[0].id as string;
}
const answer = (id: string, body: unknown) => call("POST", `/v1/questions/${id}/answer`, body);
const report = async (id: string) => (await call("GET", `/v1/reports/${id}`)).json;

const s = await site("Resp " + randomUUID().slice(0, 6));
await entry(s.id, today, 3);
const g = (await generate(s.id, today)).json;

const qw = await q({ report_id: g.id, kind: "missing_field", text: "Tempo de manhã?", field: "weather.0.weather", options: [{ id: "good", label: "Bom" }, { id: "cloudy", label: "Nublado" }] });
const r1 = await answer(qw, { optionId: "cloudy" });
check("opção 200 answered", r1.status === 200 && r1.json.status === "answered" && r1.json.answer.optionId === "cloudy" && r1.json.answer.text === null && typeof r1.json.answer.answeredAt === "string", r1);
let rep = await report(g.id);
check("opção aplicada no RDO", rep.weather[0].weather === "cloudy", rep.weather);
check("history registra a resposta", rep.history.at(-1).actor === "engineer" && rep.history.at(-1).description.startsWith("Respondeu"), rep.history.at(-1));
check("opção inválida 400", (await answer(qw, { optionId: "zz" })).status === 400);
check("corpo vazio 400", (await answer(qw, {})).status === 400);
check("dois campos 400", (await answer(qw, { optionId: "good", text: "x" })).status === 400);
check("campo extra 400", (await answer(qw, { optionId: "good", foo: 1 })).status === 400);
check("texto vazio 400", (await answer(qw, { text: "" })).status === 400);
check("id ruim 404", (await answer("abc", { text: "x" })).status === 404);
check("pergunta inexistente 404", (await answer(randomUUID(), { text: "x" })).status === 404);

const qt = await q({ report_id: g.id, kind: "missing_field", text: "Início?", field: "workday.startTime", options: [] });
const r2 = await answer(qt, { text: "7h30" });
rep = await report(g.id);
check("texto '7h30' vira 07:30", r2.status === 200 && rep.workday.startTime === "07:30", [r2.status, rep.workday]);
const qb = await q({ report_id: g.id, kind: "missing_field", text: "Intervalo?", field: "workday.breakMinutes", options: [] });
const r3 = await answer(qb, { text: "60" });
rep = await report(g.id);
check("texto '60' vira número", r3.status === 200 && rep.workday.breakMinutes === 60, [r3.status, rep.workday]);
const ql = await q({ report_id: g.id, kind: "missing_field", text: "Quantas pessoas trabalharam hoje e em quais funções?", field: "labor", options: [] });
const r4 = await answer(ql, { text: "5 pedreiros próprios" });
check("resposta em texto à pergunta de 'labor' (autoQuestion) é aceita", r4.status === 200, r4);
const qa = await q({ report_id: g.id, kind: "missing_field", text: "Quais atividades foram feitas hoje?", field: "activities", options: [] });
const r5 = await answer(qa, { text: "Concretagem da laje" });
check("resposta em texto à pergunta de 'activities' (autoQuestion) é aceita", r5.status === 200, r5);
const afterStructured = await report(g.id);
check("texto em campo estruturado fica na pergunta e não muda o RDO", r4.json?.answer?.text === "5 pedreiros próprios" && afterStructured.labor.length === 0 && afterStructured.activities.length === 0, [r4.json?.answer, afterStructured.labor, afterStructured.activities]);
await call("PATCH", `/v1/reports/${g.id}`, { labor: [{ role: "Servente", count: 2, employment: "third_party", company: null, category: null }] });
const qc = await q({ report_id: g.id, kind: "missing_field", text: "Qual é a empresa?", field: "labor.0.company", options: [] });
const r6 = await answer(qc, { text: "3" });
check("empresa chamada '3' aceita como texto", r6.status === 200, r6);
check("empresa '3' gravada como texto", (await report(g.id)).labor[0]?.company === "3", (await report(g.id)).labor[0]);

const au = await media("audio");
const r7 = await answer(qt, { audioMediaId: au });
if (AI === "off") check("áudio com IA desligada 409 AI_DISABLED", r7.status === 409 && r7.json?.code === "AI_DISABLED", [r7.status, r7.json]);
else check("áudio 202 com Retry-After", r7.status === 202 && r7.headers.get("retry-after") === "2" && r7.json.answer.audioMediaId === au, [r7.status, r7.headers.get("retry-after"), r7.json]);
const ph = await media("photo");
const r8 = await answer(qt, { audioMediaId: ph });
check("audioMediaId que é foto 400", r8.status === 400, { status: r8.status, body: r8.json });
const r9 = await answer(qt, { audioMediaId: randomUUID() });
check("audioMediaId inexistente 400", r9.status === 400, { status: r9.status, body: r9.json });

const s2 = await site("Item " + randomUUID().slice(0, 6));
await entry(s2.id, daysAgo(1), 3);
const d1 = (await generate(s2.id, daysAgo(1))).json;
await call("PATCH", `/v1/reports/${d1.id}`, { ...complete(), newOpenItems: [{ id: "n1", title: "Betoneira parada", kind: "declared_pending", track: true }] });
await approve(d1.id);
const item = (await call("GET", `/v1/open-items?siteId=${s2.id}`)).json.items[0];
const e2 = (await entry(s2.id, today, 3)).json;
const d2 = (await generate(s2.id, today)).json;
const qo = await q({ entry_id: e2.id, kind: "open_item", text: "Como está?", open_item_id: item.id, options: [{ id: "close", label: "Fechar" }, { id: "keep", label: "Manter" }] });
const r10 = await answer(qo, { optionId: "close" });
const rep2 = await report(d2.id);
check("open_item 'close' vira openItemReviews no rascunho", r10.status === 200 && rep2.openItemReviews.some((x: any) => x.openItemId === item.id && x.outcome === "close"), rep2.openItemReviews);
const r11 = await answer(qo, { text: "Voltou a funcionar" });
const rep3 = await report(d2.id);
check("open_item em texto vira 'update' com nota e substitui", r11.status === 200 && rep3.openItemReviews.length === 1 && rep3.openItemReviews[0].outcome === "update" && rep3.openItemReviews[0].note === "Voltou a funcionar", rep3.openItemReviews);

const v = (sid: string, body: unknown) => call("POST", `/v1/reports/${sid}/voice-corrections`, body);
check("voz sem corpo 400", (await v(g.id, {})).status === 400);
check("voz audioMediaId não uuid 400", (await v(g.id, { audioMediaId: "x" })).status === 400);
check("voz campo extra 400", (await v(g.id, { audioMediaId: au, foo: 1 })).status === 400);
check("voz section vazia 400", (await v(g.id, { audioMediaId: au, section: "" })).status === 400);
const vf = await v(g.id, { audioMediaId: ph });
check("voz com foto 400", vf.status === 400 && vf.json.errors?.[0]?.field === "audioMediaId", vf);
check("voz áudio inexistente 400", (await v(g.id, { audioMediaId: randomUUID() })).status === 400);
check("voz relatório inexistente 404", (await v(randomUUID(), { audioMediaId: au })).status === 404);
const before = await report(g.id);
const vs = await v(g.id, { audioMediaId: au, section: "workday" });
if (AI === "off") {
  check("voz com IA desligada 409 AI_DISABLED sem mudar o RDO", vs.status === 409 && vs.json?.code === "AI_DISABLED" && (await report(g.id)).status === before.status, [vs.status, vs.json]);
} else {
  check("voz 202 generating com Location", vs.status === 202 && vs.json.status === "generating" && vs.headers.get("location") === `/v1/reports/${g.id}`, [vs.status, vs.json?.status, vs.headers.get("location")]);
  let after = await report(g.id);
  for (let i = 0; i < 20 && after.status === "generating"; i++) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    after = await report(g.id);
  }
  check("voz sem fala volta a draft sem mudar o conteúdo", after.status === "draft" && JSON.stringify(after.workday) === JSON.stringify(before.workday) && after.history.at(-1).description.includes("não tinha fala"), [after.status, after.history.at(-1)]);
}
check("voz em aprovado 409", (await v(d1.id, { audioMediaId: au })).json?.code === "REPORT_ALREADY_APPROVED");
await pg.end();
done();
