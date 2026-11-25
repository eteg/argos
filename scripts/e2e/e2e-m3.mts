import { randomUUID } from "node:crypto";
import { B } from "./lib.mts";
const H = { "X-Api-Key": "dev-key", "X-Timezone": "America/Sao_Paulo" };
let fails = 0; const check = (n: string, ok: boolean, x?: unknown) => { if (!ok) fails++; console.log(ok ? "ok  " : "FAIL", n, ok ? "" : JSON.stringify(x)); };
async function call(m: string, p: string, body?: unknown, extra: Record<string, string> = {}) { const f = body instanceof FormData; const r = await fetch(B + p, { method: m, headers: { ...H, ...extra, ...(body && !f ? { "Content-Type": "application/json" } : {}) }, body: body ? (f ? body : JSON.stringify(body)) : undefined }); const t = await r.text(); return { status: r.status, json: t ? JSON.parse(t) : null }; }
const party = { name: "X", taxId: "00" };
const s = (await call("POST", "/v1/sites", { name: "M3", type: "private", address: "R", location: { lat: -19.9, lng: -44 }, client: party, contractor: party, technicalManager: { name: "R", artNumber: "1" } })).json;
async function media(kind: string, mime: string) { const id = randomUUID(); const f = new FormData(); f.append("file", new Blob([new Uint8Array(5)], { type: mime }), "f"); f.append("kind", kind); f.append("source", kind === "audio" ? "microphone" : "camera"); f.append("capturedAt", new Date().toISOString()); await call("PUT", `/v1/media/${id}`, f); return id; }
const fmt = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: H["X-Timezone"] }).format(d);
const today = fmt(new Date()); const yesterday = fmt(new Date(Date.now() - 86400000));
async function day(localDate: string) {
  const ph = [await media("photo", "image/jpeg"), await media("photo", "image/jpeg"), await media("photo", "image/jpeg")];
  await call("POST", `/v1/sites/${s.id}/entries`, { id: randomUUID(), capturedAt: new Date().toISOString(), localDate, timezone: H["X-Timezone"], audioMediaId: await media("audio", "audio/webm"), photoMediaIds: ph });
  return (await call("POST", `/v1/sites/${s.id}/days/${localDate}/report`)).json;
}
const base = {
  workday: { startTime: "07:00", endTime: "17:00", breakMinutes: 60 },
  weather: [{ shift: "morning", weather: "good", condition: "workable" }, { shift: "afternoon", weather: "good", condition: "workable" }],
  labor: [{ role: "Pedreiro", count: 3, employment: "own", company: null, category: null }],
  activities: [{ id: "a1", description: "Escavação", service: { id: "s1", code: "1", description: "x", unit: null }, location: "B", status: "in_progress", quantity: null, unit: null, cumulativeProgressPercent: null, executor: null }],
};
const r1 = await day(yesterday);
const p1 = await call("PATCH", `/v1/reports/${r1.id}`, { ...base, newOpenItems: [{ id: "n1", title: "Infiltração no subsolo", kind: "unresolved_occurrence", track: true }, { id: "n2", title: "Não acompanhar", kind: "declared_pending", track: false }] });
check("patch dia 1", p1.status === 200 && p1.json.missingFields.length === 0, p1.json?.missingFields ?? p1);
check("antes de aprovar: sem itens abertos (F1RN11)", (await call("GET", `/v1/open-items?siteId=${s.id}`)).json.items.length === 0);
const a1 = await call("POST", `/v1/reports/${r1.id}/approve`, undefined, { "Idempotency-Key": randomUUID() });
check("aprova dia 1", a1.status === 200, a1);
const open1 = (await call("GET", `/v1/open-items?siteId=${s.id}`)).json.items;
check("só o item com track abre", open1.length === 1 && open1[0].title === "Infiltração no subsolo" && open1[0].status === "open", open1);
const det = (await call("GET", `/v1/sites/${s.id}`)).json;
check("getSite traz o item e a contagem", det.openItems.length === 1, det.openItems);
const list = (await call("GET", `/v1/sites?status=in_progress`)).json.items.find((x: any) => x.id === s.id);
check("openItemsCount no resumo", list.openItemsCount === 1, list.openItemsCount);
const r2 = await day(today);
const d2 = (await call("GET", `/v1/sites/${s.id}/days/${today}`)).json;
check("getDay do dia 2 carrega o item", d2.openItems.length === 1, d2.openItems);
const itemId = open1[0].id;
const p2 = await call("PATCH", `/v1/reports/${r2.id}`, { ...base, openItemReviews: [{ openItemId: itemId, outcome: "close", note: "Resolvido" }] });
check("patch dia 2 com desfecho", p2.status === 200 && p2.json.missingFields.length === 0, p2.json?.missingFields ?? p2);
const a2 = await call("POST", `/v1/reports/${r2.id}/approve`, undefined, { "Idempotency-Key": randomUUID() });
check("aprova dia 2", a2.status === 200, a2);
check("item fechado sai dos abertos", (await call("GET", `/v1/open-items?siteId=${s.id}`)).json.items.length === 0);
const closed = (await call("GET", `/v1/open-items?siteId=${s.id}&status=closed`)).json.items;
check("item aparece como fechado com nota", closed.length === 1 && closed[0].status === "closed" && closed[0].closingNote === "Resolvido", closed);
console.log(fails ? `${fails} FALHAS` : "TUDO OK");
