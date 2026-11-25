import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { B, DATABASE_URL, ROOT } from "./lib.mts";
const require = createRequire(new URL("apps/api/package.json", ROOT));
const pg = require("pg");
const db = new pg.Client({ connectionString: DATABASE_URL });
await db.connect();
const H = { "X-Api-Key": "dev-key", "X-Timezone": "America/Sao_Paulo" };
let fails = 0;
const check = (n: string, ok: boolean, x?: unknown) => { if (!ok) fails++; console.log(ok ? "ok  " : "FAIL", n, ok ? "" : JSON.stringify(x)); };
async function call(method: string, path: string, body?: unknown, extra: Record<string, string> = {}) {
  const form = body instanceof FormData;
  const res = await fetch(B + path, { method, headers: { ...H, ...extra, ...(body && !form ? { "Content-Type": "application/json" } : {}) }, body: body ? (form ? body : JSON.stringify(body)) : undefined });
  const t = await res.text();
  return { status: res.status, json: t ? JSON.parse(t) : null };
}
const party = { name: "X", taxId: "00" };
const s = (await call("POST", "/v1/sites", { name: "Apr", type: "private", address: "Rua", location: { lat: -19.9, lng: -44 }, client: party, contractor: party, technicalManager: { name: "R", artNumber: "1" } })).json;
async function media(kind: string, mime: string) {
  const id = randomUUID(); const f = new FormData();
  f.append("file", new Blob([new Uint8Array(5)], { type: mime }), "f"); f.append("kind", kind); f.append("source", kind === "audio" ? "microphone" : "camera"); f.append("capturedAt", new Date().toISOString());
  await call("PUT", `/v1/media/${id}`, f); return id;
}
const today = new Intl.DateTimeFormat("en-CA", { timeZone: H["X-Timezone"] }).format(new Date());
const mkEntry = async (photos: number) => {
  const ph = []; for (let i = 0; i < photos; i++) ph.push(await media("photo", "image/jpeg"));
  return call("POST", `/v1/sites/${s.id}/entries`, { id: randomUUID(), capturedAt: new Date().toISOString(), localDate: today, timezone: H["X-Timezone"], audioMediaId: await media("audio", "audio/webm"), photoMediaIds: ph, offline: true });
};
await mkEntry(3);
const g = (await call("POST", `/v1/sites/${s.id}/days/${today}/report`)).json;
const key = randomUUID();
check("sem chave 400", (await call("POST", `/v1/reports/${g.id}/approve`)).status === 400);
const inc = await call("POST", `/v1/reports/${g.id}/approve`, undefined, { "Idempotency-Key": key });
check("incompleto 409", inc.status === 409 && inc.json.code === "REPORT_INCOMPLETE" && inc.json.errors.some((e: any) => e.field === "workday.startTime"), inc);
check("404", (await call("POST", `/v1/reports/${randomUUID()}/approve`, undefined, { "Idempotency-Key": key })).status === 404);
const before = (await call("GET", `/v1/sites/${s.id}`)).json;
check("antes: today in_progress/draft e pendingDays vazio (hoje)", before.today.state === "draft" && before.approvedReportsCount === 0, before.today);

const c = g; // preenche o essencial direto no banco
const content: any = { ...c };
for (const k of ["id","siteId","number","status","entriesCount","questions","missingFields","photoRequirements","approval","history","pdfUrl"]) delete content[k];
content.workday = { startTime: "07:00", endTime: "17:00", breakMinutes: 60 };
content.weather = [{ shift: "morning", weather: "good", condition: "workable" }, { shift: "afternoon", weather: "good", condition: "workable" }];
content.labor = [{ role: "Pedreiro", count: 3, employment: "own", company: null, category: null }];
content.activities = [{ id: "a1", description: "Concretagem", service: { id: "s1", code: "02.05", description: "Escavação", unit: "m³" }, location: "Bloco B", status: "in_progress", quantity: null, unit: null, cumulativeProgressPercent: null, executor: null }];
content.occurrences = [{ id: "o1", type: "visit", description: "Visita", startTime: "10:00", endTime: "11:00", status: "closed", affectedServiceIds: [], source: null, safety: null, materials: null }];
await db.query("update reports set content = $1 where id = $2", [JSON.stringify(content), g.id]);
const still = (await call("GET", `/v1/reports/${g.id}`)).json;
check("completo: missingFields vazio", still.missingFields.length === 0, still.missingFields);

const ok = await call("POST", `/v1/reports/${g.id}/approve`, undefined, { "Idempotency-Key": key });
check("aprova 200", ok.status === 200 && ok.json.status === "approved" && ok.json.number === 1 && ok.json.approval.approvedBy === "Rafael Lima", ok);
const again = await call("POST", `/v1/reports/${g.id}/approve`, undefined, { "Idempotency-Key": key });
check("mesma chave 200 idempotente", again.status === 200 && again.json.approval.approvedAt === ok.json.approval.approvedAt, again);
check("outra chave 409", (await call("POST", `/v1/reports/${g.id}/approve`, undefined, { "Idempotency-Key": randomUUID() })).json?.code === "REPORT_ALREADY_APPROVED");
check("generate aprovado 409", (await call("POST", `/v1/sites/${s.id}/days/${today}/report`)).json?.code === "REPORT_ALREADY_APPROVED");
check("entry no dia aprovado 409", (await mkEntry(0)).json?.code === "REPORT_ALREADY_APPROVED");
const after = (await call("GET", `/v1/sites/${s.id}`)).json;
check("getSite: approved, 1 recente, count 1", after.today.state === "approved" && after.today.reportId === g.id && after.recentReports.length === 1 && after.recentReports[0].number === 1 && after.recentReports[0].occurrencesCount === 1 && after.approvedReportsCount === 1, after);
check("pendingDays sai", after.pendingDays.length === 0, after.pendingDays);
const day = (await call("GET", `/v1/sites/${s.id}/days/${today}`)).json;
check("getDay report approved", day.report?.status === "approved", day.report);
check("concluir obra agora pode", (await call("PUT", `/v1/sites/${s.id}/status`, { status: "completed" })).json?.status === "completed");
await db.end();
console.log(fails ? `${fails} FALHAS` : "TUDO OK");
