import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";

export const ROOT = new URL("../../", import.meta.url);
export const B = process.env.E2E_API ?? "http://localhost:3101";
export const DATABASE_URL = process.env.E2E_DATABASE_URL ?? "postgres://argos:argos@localhost:5432/argos_test";
// "off" com a API em AI_ENABLED=false, "fake" com AI_FAKE=true. Os scripts nunca rodam contra IA real.
export const AI = (process.env.E2E_AI ?? "off") as "off" | "fake";
export const TZ = "America/Sao_Paulo";
export const H: Record<string, string> = { "X-Api-Key": "dev-key", "X-Timezone": TZ };
export let fails = 0;
let oks = 0;
export const check = (n: string, ok: boolean, x?: unknown) => {
  if (!ok) fails++;
  else oks++;
  console.log(ok ? "ok  " : "FAIL", n, ok ? "" : JSON.stringify(x)?.slice(0, 1500));
};
export const done = () => console.log(`(${oks} ok, ${fails} falhas)\n` + (fails ? `${fails} FALHAS` : "TUDO OK"));

export async function call(method: string, path: string, body?: unknown, extra: Record<string, string> = {}) {
  const form = body instanceof FormData;
  const res = await fetch(B + path, {
    method,
    headers: { ...H, ...extra, ...(body !== undefined && !form ? { "Content-Type": "application/json" } : {}) },
    body: body !== undefined ? (form ? (body as FormData) : JSON.stringify(body)) : undefined,
  });
  const t = await res.text();
  let json: any = null;
  try { json = t ? JSON.parse(t) : null; } catch { json = t; }
  return { status: res.status, json, headers: res.headers };
}

export const fmt = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);
export const daysAgo = (n: number) => fmt(new Date(Date.now() - n * 86400000));
export const today = daysAgo(0);
const party = { name: "X", taxId: "00" };

export async function site(name: string, type: "private" | "public" = "private") {
  const body: any = { name, type, address: "Rua", location: { lat: -19.9, lng: -44 }, client: party, contractor: party, technicalManager: { name: "R", artNumber: "1" } };
  if (type !== "private") body.publicContract = { number: "1/2026", commitmentOrAgreement: "NE1", inspectorName: "F", serviceOrderDate: "2026-09-01", durationDays: 300 };
  const r = await call("POST", "/v1/sites", body);
  if (r.status !== 201) throw new Error("createSite " + JSON.stringify(r.json));
  return r.json;
}

export async function media(kind: "audio" | "photo", mime = kind === "audio" ? "audio/webm" : "image/jpeg", opts: { duration?: number; id?: string; text?: string } = {}) {
  const id = opts.id ?? randomUUID();
  const f = new FormData();
  // com AI_FAKE o conteúdo do "áudio" é a transcrição
  const content = opts.text === undefined ? new Uint8Array(5) : new TextEncoder().encode(opts.text);
  f.append("file", new Blob([content], { type: mime }), "f");
  f.append("kind", kind);
  f.append("source", kind === "audio" ? "microphone" : "camera");
  f.append("capturedAt", new Date().toISOString());
  // duração 0: a API devolve transcrição vazia sem chamar a IA externa
  if (kind === "audio") f.append("durationSeconds", String(opts.duration ?? (opts.text === undefined ? 0 : 5)));
  const r = await call("PUT", `/v1/media/${id}`, f);
  if (r.status !== 201 && r.status !== 200) throw new Error("uploadMedia " + r.status + JSON.stringify(r.json));
  return id;
}

export async function entry(siteId: string, localDate: string, photos = 0, extra: Record<string, unknown> = {}) {
  const ph: string[] = [];
  for (let i = 0; i < photos; i++) ph.push(await media("photo"));
  return call("POST", `/v1/sites/${siteId}/entries`, { id: randomUUID(), capturedAt: new Date().toISOString(), localDate, timezone: TZ, audioMediaId: await media("audio"), photoMediaIds: ph, ...extra });
}

export const generate = (siteId: string, localDate: string) => call("POST", `/v1/sites/${siteId}/days/${localDate}/report`);

// gera e espera a montagem da IA terminar (com a IA desligada já volta em draft)
export async function generateReady(siteId: string, localDate: string) {
  const g = await generate(siteId, localDate);
  let json = g.json;
  for (let i = 0; i < 100 && json?.status === "generating"; i++) {
    await new Promise((r) => setTimeout(r, 300));
    json = (await call("GET", `/v1/reports/${g.json.id}`)).json;
  }
  return { ...g, json };
}

export const complete = (serviceId = "s1") => ({
  workday: { startTime: "07:00", endTime: "17:00", breakMinutes: 60 },
  weather: [{ shift: "morning", weather: "good", condition: "workable" }, { shift: "afternoon", weather: "good", condition: "workable" }],
  labor: [{ role: "Pedreiro", count: 3, employment: "own", company: null, category: null }],
  activities: [{ id: "a1", description: "Escavação", service: { id: serviceId, code: "1", description: "x", unit: null }, location: "B", status: "in_progress", quantity: null, unit: null, cumulativeProgressPercent: null, executor: null }],
});

export const approve = (reportId: string, key = randomUUID()) => call("POST", `/v1/reports/${reportId}/approve`, undefined, { "Idempotency-Key": key });

// cria o dia com 3 fotos, gera, completa e aprova
export async function approvedDay(siteId: string, localDate: string) {
  await entry(siteId, localDate, 3);
  const g = await generate(siteId, localDate);
  if (g.status !== 202) throw new Error("generate " + JSON.stringify(g.json));
  const p = await call("PATCH", `/v1/reports/${g.json.id}`, complete());
  if (p.status !== 200) throw new Error("patch " + JSON.stringify(p.json));
  const a = await approve(g.json.id);
  if (a.status !== 200) throw new Error("approve " + JSON.stringify(a.json));
  return a.json;
}

export async function db() {
  const pg = createRequire(new URL("apps/api/package.json", ROOT))("pg");
  const c = new pg.Client({ connectionString: DATABASE_URL });
  await c.connect();
  return c;
}
export { randomUUID };
