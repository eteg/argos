import { randomUUID } from "node:crypto";
import { B } from "./lib.mts";
const H = { "X-Api-Key": "dev-key", "X-Timezone": "America/Sao_Paulo" };
let fails = 0;
const check = (n: string, ok: boolean, x?: unknown) => { if (!ok) fails++; console.log(ok ? "ok  " : "FAIL", n, ok ? "" : JSON.stringify(x)); };
async function call(method: string, path: string, body?: unknown) {
  const form = body instanceof FormData;
  const res = await fetch(B + path, { method, headers: { ...H, ...(body && !form ? { "Content-Type": "application/json" } : {}) }, body: body ? (form ? body : JSON.stringify(body)) : undefined });
  const t = await res.text();
  return { status: res.status, headers: res.headers, json: t ? JSON.parse(t) : null };
}
const party = { name: "X", taxId: "00" };
const mk = async (extra = {}) => (await call("POST", "/v1/sites", { name: "Rel", type: "private", address: "Rua", location: { lat: -19.9, lng: -44 }, client: party, contractor: party, technicalManager: { name: "R", artNumber: "1" }, ...extra })).json;
async function media(kind: string, mime: string) {
  const id = randomUUID(); const f = new FormData();
  f.append("file", new Blob([new Uint8Array(5)], { type: mime }), "f"); f.append("kind", kind); f.append("source", kind === "audio" ? "microphone" : "camera"); f.append("capturedAt", new Date().toISOString());
  await call("PUT", `/v1/media/${id}`, f); return id;
}
async function entry(siteId: string, localDate: string, photos = 1) {
  const ph = []; for (let i = 0; i < photos; i++) ph.push(await media("photo", "image/jpeg"));
  return call("POST", `/v1/sites/${siteId}/entries`, { id: randomUUID(), capturedAt: new Date().toISOString(), localDate, timezone: H["X-Timezone"], audioMediaId: await media("audio", "audio/webm"), photoMediaIds: ph });
}
const fmt = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: H["X-Timezone"] }).format(d);
const today = fmt(new Date());
const yesterday = fmt(new Date(Date.now() - 86400000));

const s = await mk();
check("sem registro 409 NO_ENTRIES", (await call("POST", `/v1/sites/${s.id}/days/${today}/report`)).json?.code === "NO_ENTRIES");
await call("POST", `/v1/sites/${s.id}/equipment`, { name: "Betoneira", identifier: "BT" });
check("entry", (await entry(s.id, today, 2)).status === 201);
const g = await call("POST", `/v1/sites/${s.id}/days/${today}/report`);
check("generate 202 draft", g.status === 202 && g.json.status === "draft" && g.headers.get("location")?.includes(g.json.id) && g.json.entriesCount === 1, g);
check("photos 2", g.json.photos.length === 2);
check("number 1", g.json.number === 1);
check("missingFields", g.json.missingFields.some((m: any) => m.field === "workday.startTime"), g.json.missingFields);
check("equipment copied", g.json.equipment[0].name === "Betoneira");
const r = await call("GET", `/v1/reports/${g.json.id}`);
check("getReport 200 mesmo id", r.status === 200 && r.json.id === g.json.id, r);
check("generate de novo mantém o id", (await call("POST", `/v1/sites/${s.id}/days/${today}/report`)).json.id === g.json.id);
check("getReport 404", (await call("GET", `/v1/reports/${randomUUID()}`)).status === 404);
check("getReport id ruim 404", (await call("GET", `/v1/reports/x`)).status === 404);
const p = await mk({ name: "Pub", type: "public", publicContract: { number: "1", commitmentOrAgreement: "NE", inspectorName: "P", serviceOrderDate: "2026-09-01", durationDays: 100 } });
await entry(p.id, yesterday); await entry(p.id, today);
const pp = await call("POST", `/v1/sites/${p.id}/days/${today}/report`);
check("PREVIOUS_DAY_PENDING", pp.status === 409 && pp.json.code === "PREVIOUS_DAY_PENDING" && pp.json.errors[0].field === yesterday, pp);
const py = await call("POST", `/v1/sites/${p.id}/days/${yesterday}/report`);
check("dia anterior gera (pública)", py.status === 202 && py.json.site.publicContract.remainingDays !== undefined && py.json.missingFields.length > 0, py);
console.log(fails ? `${fails} FALHAS` : "TUDO OK");
