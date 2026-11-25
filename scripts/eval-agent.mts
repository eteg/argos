import { readFileSync, readdirSync } from "node:fs";
import { assembleReport, type AgentModel } from "../packages/agent/dist/src/index.js";

const KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5-5";
if (!KEY) throw new Error("Set ANTHROPIC_API_KEY.");

const model: AgentModel = {
  async complete({ system, user, maxTokens }) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, system, messages: [{ role: "user", content: user }] }),
    });
    const data = (await res.json()) as { content?: { type: string; text?: string }[] };
    return (data.content ?? []).map((b) => b.text ?? "").join("");
  },
};

const csv = readFileSync("data/demo-site/services.csv", "utf8").trim().split("\n").slice(1);
const services = csv.map((line, i) => {
  const [code = "", description = "", unit = ""] = line.split(",");
  return { id: `svc-${i}`, code, description, unit: unit || null };
});
const equipment = (JSON.parse(readFileSync("data/demo-site/equipment.json", "utf8")) as { name: string; identifier: string | null }[]).map((e, i) => ({ equipmentId: `eq-${i}`, name: e.name, identifier: e.identifier }));

const get = (obj: unknown, path: string): unknown => path.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown> | null)?.[k], obj);
let total = 0, correct = 0, omitted = 0, asked = 0, invented = 0;

for (const file of readdirSync("data/golden-reports").filter((f) => f.endsWith(".json")).sort()) {
  const day = JSON.parse(readFileSync(`data/golden-reports/${file}`, "utf8")) as { localDate: string; timezone: string; entries: { capturedAt: string; script: string }[]; omittedFields: { field: string }[]; expectedReport: Record<string, unknown> };
  const result = await assembleReport(model, {
    siteType: "public", localDate: day.localDate, timezone: day.timezone, services, equipment, openItems: [],
    entries: day.entries.map((e) => ({ capturedAt: e.capturedAt, transcript: e.script })),
  });
  const got = result.fields as Record<string, unknown>;
  const exp = day.expectedReport;
  const omittedPaths = new Set(day.omittedFields.map((o) => o.field));
  const checks: [string, unknown, unknown][] = [
    ["workday.startTime", get(exp, "workday.startTime"), get(got, "workday.startTime")],
    ["workday.endTime", get(exp, "workday.endTime"), get(got, "workday.endTime")],
    ["workday.breakMinutes", get(exp, "workday.breakMinutes"), get(got, "workday.breakMinutes")],
    ...[0, 1].flatMap((i) => ["weather", "condition"].map((k): [string, unknown, unknown] => [`weather.${i}.${k}`, get(exp, `weather.${i}.${k}`), get(got, `weather.${i}.${k}`)])),
    ["labor.count", ((exp.labor as unknown[]) ?? []).length, ((got.labor as unknown[]) ?? []).length],
    ["activities.count", ((exp.activities as unknown[]) ?? []).length, ((got.activities as unknown[]) ?? []).length],
    ["occurrences.count", ((exp.occurrences as unknown[]) ?? []).length, ((got.occurrences as unknown[]) ?? []).length],
  ];
  let dayCorrect = 0, dayTotal = 0;
  for (const [path, e, g] of checks) {
    if (omittedPaths.has(path)) {
      omitted++;
      if (g !== null && g !== undefined) invented++;
      if (result.questions.some((q) => q.field === path)) asked++;
      continue;
    }
    dayTotal++;
    if (JSON.stringify(e) === JSON.stringify(g)) dayCorrect++;
    else console.log(`  ${file} ${path}: esperado ${JSON.stringify(e)} / veio ${JSON.stringify(g)}`);
  }
  for (const o of day.omittedFields) {
    if (!checks.some(([p]) => p === o.field)) { omitted++; if (result.questions.some((q) => q.field === o.field)) asked++; }
  }
  total += dayTotal; correct += dayCorrect;
  console.log(`${file}: ${dayCorrect}/${dayTotal} campos corretos, ${result.questions.length} perguntas`);
}
console.log(`\nCampos corretos: ${correct}/${total} (${Math.round((100 * correct) / Math.max(total, 1))}%)`);
console.log(`Campos faltantes perguntados: ${asked}/${omitted}`);
console.log(`Campos inventados (meta 0): ${invented}`);
