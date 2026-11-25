// Prepara a demo (M6): zera o banco, cadastra a obra fictícia e grava o dia 1 (ontem) com áudios e fotos de data/demo.
// O dia 2 (hoje) fica livre pra demo ao vivo. Precisa da API rodando: pnpm --filter @argos/api seed:demo
import { randomUUID } from "node:crypto";
import { readFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { sql } from "drizzle-orm";
import { db } from "../src/db/db";

const API = process.env.API_URL ?? "http://localhost:3001/v1";
const KEY = process.env.API_KEY ?? "dev-key";
const TZ = "America/Sao_Paulo";
const DATA = resolve(__dirname, "../../../data/demo");
const LOCATION = { lat: -19.9317, lng: -44.0536, accuracyMeters: 10 };

// O que os áudios do dia 1 não dizem: respostas do engenheiro às perguntas do agente, por palavra-chave.
const ANSWERS: [RegExp, string][] = [
  [/grua/i, "A grua ficou parada o dia todo, não precisou"],
  [/aço/i, "Percebi a falta do aço às duas da tarde"],
  [/chuva/i, "A chuva começou às duas da tarde e parou às quatro"],
  [/encerr|expediente|término|fim/i, "Encerramos às 17:00"],
  [/começ|início|inici/i, "Começamos às 07:00"],
  [/concretagem|laje|metros|m³/i, "A concretagem da laje terminou às 13:30, doze metros cúbicos"],
  [/escava/i, "A escavação do bloco C ficou parada desde as duas"],
  [/armador|pedreiro|efetivo|equipe/i, "Doze pedreiros próprios e dois armadores da Ferragens Silva"],
  [/intervalo|almoço/i, "Uma hora de almoço"],
  [/manhã|tarde|tempo|praticável/i, "De manhã tempo bom e deu pra trabalhar; à tarde chuva forte, impraticável"],
  [/betoneira/i, "A betoneira 2 operou o dia todo"],
];

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { "X-Api-Key": KEY, "X-Timezone": TZ };
  if (typeof init.body === "string") headers["Content-Type"] = "application/json";
  const res = await fetch(`${API}${path}`, { ...init, headers });
  const body = await res.json();
  if (!res.ok) throw Object.assign(new Error(`${res.status} ${path}: ${JSON.stringify(body)}`), { body });
  return body as T;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const localDate = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);
// Horário de Brasília, sem horário de verão.
const at = (day: string, hhmm: string) => `${new Date(`${day}T${hhmm}:00-03:00`).toISOString()}`;

async function upload(file: string, kind: "audio" | "photo", capturedAt: string) {
  const id = randomUUID();
  const form = new FormData();
  form.set("kind", kind);
  form.set("source", kind === "audio" ? "microphone" : "camera");
  form.set("capturedAt", capturedAt);
  form.set("location", JSON.stringify(LOCATION));
  const bytes = readFileSync(join(DATA, file));
  form.set("file", new Blob([bytes], { type: kind === "audio" ? "audio/wav" : "image/jpeg" }), file);
  await call(`/media/${id}`, { method: "PUT", body: form });
  return id;
}

async function main() {
  console.log("Zerando o banco local…");
  await db.execute(sql`truncate open_items, reports, entries, media, sites cascade`);
  rmSync(resolve(process.env.UPLOAD_DIR ?? "uploads"), { recursive: true, force: true });

  const site = await call<{ id: string }>("/sites", {
    method: "POST",
    body: JSON.stringify({
      name: "Residencial Vila Verde · Bloco B",
      type: "private",
      address: "Rua das Acácias, 410 · Contagem, MG",
      location: LOCATION,
      client: { name: "Vila Verde Empreendimentos", taxId: "00.000.000/0001-00" },
      contractor: { name: "Construtora Horizonte", taxId: "11.111.111/0001-11" },
      technicalManager: { name: "Eng. Rafael Lima", artNumber: "MG2026001234" },
      equipment: [{ name: "Betoneira 2" }, { name: "Grua", identifier: "GR-01" }],
    }),
  });
  console.log(`Obra: ${site.id}`);

  const day1 = localDate(new Date(Date.now() - 86_400_000));
  const entries = [
    { time: "07:15", audio: "dia1-manha.wav", photos: ["foto-armacao.jpg"] },
    { time: "14:10", audio: "dia1-tarde.wav", photos: ["foto-laje.jpg", "foto-escavacao.jpg"] },
    { time: "17:00", audio: "dia1-fim.wav", photos: ["foto-geral.jpg"] },
  ];
  const ids: string[] = [];
  for (const e of entries) {
    const capturedAt = at(day1, e.time);
    const audioMediaId = await upload(e.audio, "audio", capturedAt);
    const photoMediaIds = [];
    for (const p of e.photos) photoMediaIds.push(await upload(p, "photo", capturedAt));
    const id = randomUUID();
    await call(`/sites/${site.id}/entries`, {
      method: "POST",
      body: JSON.stringify({ id, capturedAt, localDate: day1, timezone: TZ, location: LOCATION, audioMediaId, photoMediaIds }),
    });
    ids.push(id);
    console.log(`Registro ${day1} ${e.time} enviado`);
  }

  for (const id of ids) {
    for (;;) {
      const entry = await call<{ status: string; title: string | null }>(`/entries/${id}`);
      if (entry.status !== "processing") {
        console.log(`  ${entry.status}: ${entry.title}`);
        break;
      }
      await sleep(2000);
    }
  }

  const { id: reportId } = await call<{ id: string }>(`/sites/${site.id}/days/${day1}/report`, { method: "POST" });
  type Report = { status: string; questions: { id: string; text: string }[]; missingFields: { field: string }[]; newOpenItems?: { title: string }[] };
  let report: Report;
  for (;;) {
    report = await call(`/reports/${reportId}`);
    if (report.status !== "generating") break;
    await sleep(3000);
  }
  console.log(`RDO do dia 1: ${report.status}`);
  console.log(`Itens novos: ${(report.newOpenItems ?? []).map((n) => n.title).join(" | ")}`);
  // As perguntas variam de uma execução pra outra, e uma resposta pode gerar outra pergunta.
  for (let round = 0; round < 3 && report.missingFields.length > 0; round++) {
    for (const q of report.questions) {
      const answer = ANSWERS.find(([re]) => re.test(q.text))?.[1];
      if (!answer) continue;
      report = await call<Report>(`/questions/${q.id}/answer`, { method: "POST", body: JSON.stringify({ text: answer }) });
      console.log(`  ${q.text} → ${answer}`);
    }
  }
  if (report.missingFields.length > 0) {
    console.log("Falta responder antes de aprovar:");
    for (const q of report.questions) console.log(`  ? ${q.text}`);
    console.log(`Abra http://localhost:3000/rdo/${reportId}, responda e aprove.`);
    return;
  }
  await call(`/reports/${reportId}/approve`, { method: "POST" });
  console.log(`RDO do dia 1 aprovado: http://localhost:3000/rdo/${reportId}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
