import { randomUUID } from "node:crypto";
import { B } from "./lib.mts";
const H = { "X-Api-Key": "dev-key", "X-Timezone": "America/Sao_Paulo" };
let fails = 0; const check = (n: string, ok: boolean, x?: unknown) => { if (!ok) fails++; console.log(ok ? "ok  " : "FAIL", n, ok ? "" : JSON.stringify(x)); };
async function call(m: string, p: string, body?: unknown, extra: Record<string, string> = {}) { const f = body instanceof FormData; const r = await fetch(B + p, { method: m, headers: { ...H, ...extra, ...(body && !f ? { "Content-Type": "application/json" } : {}) }, body: body ? (f ? body : JSON.stringify(body)) : undefined }); const t = await r.text(); return { status: r.status, json: t ? JSON.parse(t) : null }; }
const party = { name: "X", taxId: "00" };
const s = (await call("POST", "/v1/sites", { name: "Seg", type: "private", address: "R", location: { lat: -19.9, lng: -44 }, client: party, contractor: party, technicalManager: { name: "R", artNumber: "1" } })).json;
async function media(kind: string, mime: string) { const id = randomUUID(); const f = new FormData(); f.append("file", new Blob([new Uint8Array(5)], { type: mime }), "f"); f.append("kind", kind); f.append("source", kind === "audio" ? "microphone" : "camera"); f.append("capturedAt", new Date().toISOString()); await call("PUT", `/v1/media/${id}`, f); return id; }
const today = new Intl.DateTimeFormat("en-CA", { timeZone: H["X-Timezone"] }).format(new Date());
const ph = [await media("photo", "image/jpeg"), await media("photo", "image/jpeg"), await media("photo", "image/jpeg")];
await call("POST", `/v1/sites/${s.id}/entries`, { id: randomUUID(), capturedAt: new Date().toISOString(), localDate: today, timezone: H["X-Timezone"], audioMediaId: await media("audio", "audio/webm"), photoMediaIds: ph });
const g = (await call("POST", `/v1/sites/${s.id}/days/${today}/report`)).json;
const base = {
  workday: { startTime: "07:00", endTime: "17:00", breakMinutes: 60 },
  weather: [{ shift: "morning", weather: "good", condition: "workable" }, { shift: "afternoon", weather: "good", condition: "workable" }],
  labor: [{ role: "Servente", count: 2, employment: "own", company: null, category: null }],
  activities: [{ id: "a1", description: "Corte", service: { id: "s1", code: "1", description: "x", unit: null }, location: "B", status: "in_progress", quantity: null, unit: null, cumulativeProgressPercent: null, executor: null }],
};
const acc = { id: "o1", type: "accident", description: "Corte na mão", startTime: "11:10", endTime: null, status: "open", affectedServiceIds: [], source: null, safety: null, materials: null };
const r1 = await call("PATCH", `/v1/reports/${g.id}`, { ...base, occurrences: [acc] });
check("acidente sem segurança falta campo", r1.json.missingFields.some((m: any) => m.field === "occurrences.0.safety"), r1.json.missingFields);
const key = randomUUID();
const ap = await call("POST", `/v1/reports/${g.id}/approve`, undefined, { "Idempotency-Key": key });
check("aprovar bloqueia com .safety", ap.status === 409 && ap.json.errors.some((e: any) => e.field === "occurrences.0.safety"), ap);
const r2 = await call("PATCH", `/v1/reports/${g.id}`, { occurrences: [{ ...acc, safety: { type: "accident", dds: false, ppeInUse: true } }] });
check("segurança preenchida libera", r2.status === 200 && r2.json.missingFields.length === 0, r2.json.missingFields);
const ok = await call("POST", `/v1/reports/${g.id}/approve`, undefined, { "Idempotency-Key": key });
check("aprova", ok.status === 200 && ok.json.status === "approved", ok);
console.log(fails ? `${fails} FALHAS` : "TUDO OK");
