import { randomUUID } from "node:crypto";
import { B } from "./lib.mts";
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
const s = (await call("POST", "/v1/sites", { name: "Upd", type: "private", address: "Rua", location: { lat: -19.9, lng: -44 }, client: party, contractor: party, technicalManager: { name: "R", artNumber: "1" } })).json;
async function media(kind: string, mime: string) {
  const id = randomUUID(); const f = new FormData();
  f.append("file", new Blob([new Uint8Array(5)], { type: mime }), "f"); f.append("kind", kind); f.append("source", kind === "audio" ? "microphone" : "camera"); f.append("capturedAt", new Date().toISOString());
  await call("PUT", `/v1/media/${id}`, f); return id;
}
const today = new Intl.DateTimeFormat("en-CA", { timeZone: H["X-Timezone"] }).format(new Date());
const mkEntry = async (photos: number) => {
  const ph = []; for (let i = 0; i < photos; i++) ph.push(await media("photo", "image/jpeg"));
  return call("POST", `/v1/sites/${s.id}/entries`, { id: randomUUID(), capturedAt: new Date().toISOString(), localDate: today, timezone: H["X-Timezone"], audioMediaId: await media("audio", "audio/webm"), photoMediaIds: ph });
};
await mkEntry(3);
const g = (await call("POST", `/v1/sites/${s.id}/days/${today}/report`)).json;
const P = (b: unknown) => call("PATCH", `/v1/reports/${g.id}`, b);
check("history inicial", g.history.length === 1 && g.history[0].actor === "agent", g.history);
check("corpo vazio 400", (await P({})).status === 400);
check("campo desconhecido 400", (await P({ foo: 1 })).status === 400);
check("site não editável 400", (await P({ site: { name: "x" } })).status === 400);
check("enum inválido 400", (await P({ labor: [{ role: "A", count: 1, employment: "xx", company: null, category: null }] })).status === 400);
check("workday null 400", (await P({ workday: null })).status === 400);
check("foto desconhecida 400", (await P({ photos: [{ id: randomUUID(), caption: "x" }] })).status === 400);
check("404", (await call("PATCH", `/v1/reports/${randomUUID()}`, { rainfallMm: 1 })).status === 404);

const r1 = await P({ workday: { startTime: "07:00", endTime: "17:00", breakMinutes: 60 }, rainfallMm: 2.5 });
check("patch jornada", r1.status === 200 && r1.json.workday.startTime === "07:00" && r1.json.rainfallMm === 2.5 && !r1.json.missingFields.some((m: any) => m.field.startsWith("workday")), r1);
check("history do engenheiro", r1.json.history.at(-1).actor === "engineer" && r1.json.history.at(-1).description.includes("jornada"), r1.json.history);
const photoId = g.photos[0].id;
const r2 = await P({ photos: [{ id: photoId, caption: "Laje" }] });
check("legenda da foto", r2.json.photos[0].caption === "Laje" && r2.json.photos[0].url, r2.json.photos[0]);
const r3 = await P({
  weather: [{ shift: "morning", weather: "good", condition: "workable" }, { shift: "afternoon", weather: "cloudy", condition: "workable" }],
  labor: [{ role: "Pedreiro", count: 3, employment: "own", company: null, category: null }],
  activities: [{ id: "a1", description: "Concretagem", service: { id: "s1", code: "02.05", description: "Escavação", unit: "m³" }, location: "Bloco B", status: "in_progress", quantity: null, unit: null, cumulativeProgressPercent: null, executor: null }],
});
check("completo sem missingFields", r3.status === 200 && r3.json.missingFields.length === 0, r3.json.missingFields);
const regen = (await call("POST", `/v1/sites/${s.id}/days/${today}/report`)).json;
check("regenerar mantém correções e legenda", regen.id === g.id && regen.workday.startTime === "07:00" && regen.labor.length === 1 && regen.photos[0].caption === "Laje" && regen.missingFields.length === 0, regen.missingFields);
check("history cresce", regen.history.length >= 5 && regen.history.at(-1).description.includes("remontado"), regen.history.map((h: any) => h.description));
const key = randomUUID();
const ap = await call("POST", `/v1/reports/${g.id}/approve`, undefined, { "Idempotency-Key": key });
check("aprova pela API", ap.status === 200 && ap.json.status === "approved" && ap.json.history.at(-1).description === "RDO aprovado", ap);
check("patch aprovado 409", (await P({ rainfallMm: 1 })).json?.code === "REPORT_ALREADY_APPROVED");
console.log(fails ? `${fails} FALHAS` : "TUDO OK");
