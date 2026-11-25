import { randomUUID } from "node:crypto";
import { B } from "./lib.mts";
const H = { "X-Api-Key": "dev-key", "X-Timezone": "America/Sao_Paulo" };
let fails = 0; const check = (n: string, ok: boolean, x?: unknown) => { if (!ok) fails++; console.log(ok ? "ok  " : "FAIL", n, ok ? "" : JSON.stringify(x)); };
async function call(m: string, p: string, body?: unknown) { const f = body instanceof FormData; const r = await fetch(B + p, { method: m, headers: { ...H, ...(body && !f ? { "Content-Type": "application/json" } : {}) }, body: body ? (f ? body : JSON.stringify(body)) : undefined }); const t = await r.text(); return { status: r.status, json: t ? JSON.parse(t) : null }; }
const party = { name: "X", taxId: "00" };
const s = (await call("POST", "/v1/sites", { name: "Pub3b", type: "public", address: "R", location: { lat: -19.9, lng: -44 }, client: party, contractor: party, technicalManager: { name: "R", artNumber: "1" }, publicContract: { number: "1", commitmentOrAgreement: "NE", inspectorName: "P", serviceOrderDate: "2026-09-01", durationDays: 100 } })).json;
async function media(kind: string, mime: string) { const id = randomUUID(); const f = new FormData(); f.append("file", new Blob([new Uint8Array(5)], { type: mime }), "f"); f.append("kind", kind); f.append("source", kind === "audio" ? "microphone" : "camera"); f.append("capturedAt", new Date().toISOString()); await call("PUT", `/v1/media/${id}`, f); return id; }
const today = new Intl.DateTimeFormat("en-CA", { timeZone: H["X-Timezone"] }).format(new Date());
const ph = [await media("photo", "image/jpeg"), await media("photo", "image/jpeg"), await media("photo", "image/jpeg")];
await call("POST", `/v1/sites/${s.id}/entries`, { id: randomUUID(), capturedAt: new Date().toISOString(), localDate: today, timezone: H["X-Timezone"], audioMediaId: await media("audio", "audio/webm"), photoMediaIds: ph });
const g = (await call("POST", `/v1/sites/${s.id}/days/${today}/report`)).json;
const r = await call("PATCH", `/v1/reports/${g.id}`, {
  weatherStoppage: { hours: 0, serviceIds: [] },
  activities: [{ id: "a1", description: "Montagem", service: { id: "s1", code: "03.01", description: "Estrutura", unit: "t" }, location: "Eixo 1", status: "in_progress", quantity: 12, unit: "t", cumulativeProgressPercent: null, executor: null }],
  occurrences: [{ id: "o1", type: "inspection_order", description: "Fiscal pediu reforço", startTime: "10:30", endTime: null, status: "open", affectedServiceIds: ["s1"], source: { origin: "Fiscal", document: "e-mail" }, materials: null, safety: null }],
});
check("patch 200", r.status === 200, r);
check("photoRequirements 2", r.json.photoRequirements.length === 2 && r.json.photoRequirements[0].linkedTo.type === "activity" && r.json.photoRequirements[0].label === "Montagem", r.json.photoRequirements);
const r2 = await call("PATCH", `/v1/reports/${g.id}`, { photos: [{ id: r.json.photos[0].id, linkedTo: { type: "activity", id: "a1" } }, { id: r.json.photos[1].id, linkedTo: { type: "occurrence", id: "o1" } }] });
check("vincular fotos zera requisitos", r2.json.photoRequirements.length === 0 && !r2.json.missingFields.some((m: any) => m.field.includes("activities") || m.field.includes("occurrences")), [r2.json.photoRequirements, r2.json.missingFields]);
console.log(fails ? `${fails} FALHAS` : "TUDO OK");
