import { randomUUID } from "node:crypto";
import { B } from "./lib.mts";
const H = { "X-Api-Key": "dev-key", "X-Timezone": "America/Sao_Paulo" };
let fails = 0;
function check(name: string, ok: boolean, extra?: unknown) {
  if (!ok) fails++;
  console.log(ok ? "ok  " : "FAIL", name, ok ? "" : JSON.stringify(extra));
}
async function call(method: string, path: string, body?: unknown, extra: Record<string, string> = {}) {
  const isForm = body instanceof FormData;
  const res = await fetch(B + path, {
    method,
    headers: { ...H, ...extra, ...(body && !isForm ? { "Content-Type": "application/json" } : {}) },
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
  });
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null };
}
const party = { name: "X", taxId: "00.000.000/0001-00" };
const base = { name: "Vila Verde", type: "private", address: "Rua A, Contagem", location: { lat: -19.93, lng: -44.05 }, client: party, contractor: party, technicalManager: { name: "Rafael", artNumber: "MG1" } };

check("sem chave 401", (await fetch(B + "/v1/me")).status === 401);
check("me", (await call("GET", "/v1/me")).json.name === "Rafael Lima");
check("config", (await call("GET", "/v1/config")).json.maxPhotosPerReport === 20);

const bad = await call("POST", "/v1/sites", { ...base, type: "public" });
check("public sem contrato 400", bad.status === 400 && bad.json.code === "VALIDATION", bad);
const bad2 = await call("POST", "/v1/sites", { name: "" });
check("validation errors", bad2.status === 400 && bad2.json.errors.length > 0, bad2);

const a = await call("POST", "/v1/sites", base);
check("createSite 201", a.status === 201 && a.json.status === "in_progress", a);
const far = await call("POST", "/v1/sites", { ...base, name: "Galpão", location: { lat: -19.99, lng: -44.1 } });
const pub = await call("POST", "/v1/sites", { ...base, name: "Pública", type: "public", publicContract: { number: "045/2026", commitmentOrAgreement: "NE1", inspectorName: "Paula", serviceOrderDate: "2026-09-01", durationDays: 180, amendments: [{ description: "x", addedDays: 10, signedOn: "2026-10-01" }] } });
check("public contract calc", pub.status === 201 && pub.json.publicContract.remainingDays === 190 - pub.json.publicContract.elapsedDays, pub);
const id = a.json.id;

const list = await call("GET", "/v1/sites", undefined, { "X-Device-Location": "-19.93,-44.05" });
check("list ordena por distância", list.json.items[0].distanceMeters < 5 && list.json.items[0].distanceMeters < 5, list.json.items.map((i: any) => [i.name, i.distanceMeters]));
check("list search", (await call("GET", "/v1/sites?search=gal")).json.items.length === 1);
check("list status inválido 400", (await call("GET", "/v1/sites?status=foo")).status === 400);

const csv = new FormData();
csv.append("file", new Blob(["Código;Descrição;Unidade\n02.05;Escavação;m³\n02.06;Concreto;m³\n"]), "plan.csv");
const imp = await call("PUT", `/v1/sites/${id}/services`, csv);
check("importServices csv", imp.status === 200 && imp.json.servicesCount === 2, imp);
const badCsv = new FormData();
badCsv.append("file", new Blob(["a;b\n1;2\n"]), "x.csv");
check("importServices 422", (await call("PUT", `/v1/sites/${id}/services`, badCsv)).json?.code === "SPREADSHEET_UNREADABLE");
const txt = new FormData();
txt.append("file", new Blob(["x"]), "x.txt");
check("importServices 415", (await call("PUT", `/v1/sites/${id}/services`, txt)).status === 415);

const eq = await call("POST", `/v1/sites/${id}/equipment`, { name: "Betoneira 2", identifier: "BT-02" });
check("addEquipment", eq.status === 201, eq);
check("updateEquipment", (await call("PATCH", `/v1/sites/${id}/equipment/${eq.json.id}`, { name: "Betoneira 3" })).json.name === "Betoneira 3");

const doc = new FormData();
doc.append("file", new Blob(["%PDF-1.4"], { type: "application/pdf" }), "arq.pdf");
doc.append("type", "architectural");
const d = await call("POST", `/v1/sites/${id}/documents`, doc);
check("uploadSiteDocument", d.status === 201, d);
const dl = await fetch(d.json.url);
check("url assinada baixa", dl.status === 200 && (await dl.text()) === "%PDF-1.4");
check("url adulterada 404", (await fetch(d.json.url.replace(/sig=(.)/, (_: string, c: string) => `sig=${c === "0" ? "1" : "0"}`))).status === 404);
check("updateSiteDocument", (await call("PATCH", `/v1/sites/${id}/documents/${d.json.id}`, { type: "structural" })).json.type === "structural");

async function media(kind: string, mime: string, mid = randomUUID(), size = 10) {
  const f = new FormData();
  f.append("file", new Blob([new Uint8Array(size)], { type: mime }), "f");
  f.append("kind", kind);
  f.append("source", kind === "audio" ? "microphone" : "camera");
  f.append("capturedAt", new Date().toISOString());
  f.append("location", JSON.stringify({ lat: -19.93, lng: -44.05, accuracyMeters: 10 }));
  if (kind === "audio") f.append("durationSeconds", "48");
  return { mid, ...(await call("PUT", `/v1/media/${mid}`, f)) };
}
const au = await media("audio", "audio/webm;codecs=opus");
check("uploadMedia audio 201", au.status === 201 && au.json.durationSeconds === 48, au);
check("uploadMedia idempotente 200", (await media("audio", "audio/webm", au.mid)).status === 200);
check("foto mime ruim 415", (await media("photo", "image/gif")).status === 415);
check("áudio >10MB 413", (await media("audio", "audio/webm", randomUUID(), 11 * 1024 * 1024)).status === 413);
const photos = [];
for (let i = 0; i < 4; i++) photos.push((await media("photo", "image/jpeg")).mid);

const today = new Intl.DateTimeFormat("en-CA", { timeZone: H["X-Timezone"] }).format(new Date());
const eid = randomUUID();
const entry = { id: eid, capturedAt: new Date().toISOString(), localDate: today, timezone: H["X-Timezone"], location: { lat: -19.93, lng: -44.05 }, audioMediaId: au.mid, photoMediaIds: photos.slice(0, 2) };
const e1 = await call("POST", `/v1/sites/${id}/entries`, entry);
check("createEntry 201", e1.status === 201 && e1.json.photos.length === 2 && e1.json.audio.id === au.mid, e1);
check("createEntry idempotente 200", (await call("POST", `/v1/sites/${id}/entries`, entry)).status === 200);
check("PHOTO_LIMIT_ENTRY", (await call("POST", `/v1/sites/${id}/entries`, { ...entry, id: randomUUID(), photoMediaIds: photos })).json?.code === "PHOTO_LIMIT_ENTRY");
check("audio inexistente 400", (await call("POST", `/v1/sites/${id}/entries`, { ...entry, id: randomUUID(), audioMediaId: randomUUID() })).status === 400);
const day = await call("GET", `/v1/sites/${id}/days/${today}`);
check("getDay", day.json.entries.length === 1 && day.json.site.today.state === "in_progress" && day.json.site.today.entriesCount === 1, day);
const det = await call("GET", `/v1/sites/${id}`);
check("getSite", det.json.equipment.length === 1 && det.json.documents.length === 1 && det.json.servicesCount === 2 && det.json.today.entriesCount === 1, det.json);
check("getSite 404", (await call("GET", `/v1/sites/${randomUUID()}`)).status === 404);
check("getSite id ruim 404", (await call("GET", `/v1/sites/abc`)).status === 404);

// limite de 20 fotos por dia
let last: any;
for (let i = 0; i < 9; i++) {
  const ps = [];
  for (let j = 0; j < 3; j++) ps.push((await media("photo", "image/png")).mid);
  last = await call("POST", `/v1/sites/${id}/entries`, { ...entry, id: randomUUID(), photoMediaIds: ps });
  if (last.status !== 201) break;
}
check("PHOTO_LIMIT_REPORT", last.json?.code === "PHOTO_LIMIT_REPORT", last);

const done = await call("PUT", `/v1/sites/${id}/status`, { status: "completed" });
check("concluir com registros 409", done.status === 409 && done.json.code === "SITE_HAS_OPEN_REPORTS" && done.json.errors[0].field === today, done);
const paused = await call("PUT", `/v1/sites/${id}/status`, { status: "paused" });
check("pausar", paused.json.status === "paused" && paused.json.statusChangedOn === today, paused);
check("SITE_NOT_IN_PROGRESS", (await call("POST", `/v1/sites/${id}/entries`, { ...entry, id: randomUUID() })).json?.code === "SITE_NOT_IN_PROGRESS");
check("list sem pausada", !(await call("GET", "/v1/sites")).json.items.some((i: any) => i.id === id));
check("list fora de andamento", (await call("GET", "/v1/sites?status=paused,completed,not_started")).json.items.some((i: any) => i.id === id));
const done2 = await call("PUT", `/v1/sites/${far.json.id}/status`, { status: "completed" });
check("concluir sem registros", done2.json.status === "completed", done2);
check("updateSite", (await call("PATCH", `/v1/sites/${id}`, { name: "Novo" })).json.name === "Novo");
check("removeEquipment 204", (await call("DELETE", `/v1/sites/${id}/equipment/${eq.json.id}`)).status === 204);
check("removeSiteDocument 204", (await call("DELETE", `/v1/sites/${id}/documents/${d.json.id}`)).status === 204);
console.log(fails ? `${fails} FALHAS` : "TUDO OK");
