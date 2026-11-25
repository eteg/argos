const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const delayOf = (text: string, directive: string) => Number(new RegExp(`#${directive}=(\\d+)`).exec(text)?.[1] ?? 0);

// Modo de teste (AI_FAKE=true): o "áudio" é um arquivo de texto. Linhas "#lento=ms" atrasam a transcrição,
// "#falha" faz a transcrição falhar e "#lento-ia=ms" atrasa a montagem do RDO.
export async function fakeTranscript(audio: Buffer): Promise<string> {
  const text = audio.toString("utf8");
  await sleep(delayOf(text, "lento"));
  if (/^#falha\b/m.test(text)) throw new Error("Fake transcription failure.");
  if (text.includes("\u0000")) return "";
  return text
    .split("\n")
    .filter((line) => !/^#lento=/.test(line))
    .join("\n")
    .trim();
}

interface FakeEntry {
  capturedAt: string;
  transcript: string;
}

const clockIn = (iso: string, timeZone: string) => new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone }).format(new Date(iso));
const hhmm = (h: string, m: string | undefined) => `${h.padStart(2, "0")}:${m ?? "00"}`;

function entriesOf(user: string): FakeEntry[] {
  const found: FakeEntry[] = [];
  const pattern = /Registro \d+ \(([^)]+)\):\n([\s\S]*?)(?=\n\nRegistro \d+ \(|$)/g;
  for (const match of user.matchAll(pattern)) found.push({ capturedAt: match[1]!, transcript: match[2]!.trim() });
  return found;
}

function assemble(user: string) {
  const timeZone = /\(fuso ([^)]+)\)/.exec(user)?.[1] ?? "America/Sao_Paulo";
  const entries = entriesOf(user);
  const all = entries.map((e) => e.transcript.toLowerCase()).join("\n");
  const fields: Record<string, unknown> = {};
  const questions: { kind: string; text: string; field: string | null; options: { id: string; label: string }[] }[] = [];

  const workday = /jornada (\d{1,2})[:h](\d{2})? (?:às|a|até) (\d{1,2})[:h](\d{2})?/.exec(all);
  const pause = /intervalo de (\d+) min/.exec(all);
  if (workday || pause) {
    fields.workday = {
      startTime: workday ? hhmm(workday[1]!, workday[2]) : null,
      endTime: workday ? hhmm(workday[3]!, workday[4]) : null,
      breakMinutes: pause ? Number(pause[1]) : null,
    };
  }
  const sky = [
    { test: /chuva forte/, weather: "heavy_rain", condition: "unworkable" },
    { test: /chuva/, weather: "light_rain", condition: "partially_workable" },
    { test: /sol|tempo bom/, weather: "good", condition: "workable" },
  ].find((s) => s.test.test(all));
  if (sky) fields.weather = ["morning", "afternoon"].map((shift) => ({ shift, weather: sky.weather, condition: sky.condition }));

  const labor = [
    { test: /(\d+) pedreiros?/, role: "Pedreiro" },
    { test: /(\d+) serventes?/, role: "Servente" },
  ].flatMap((l) => {
    const match = l.test.exec(all);
    return match ? [{ role: l.role, count: Number(match[1]), employment: "own", company: null, category: null }] : [];
  });
  if (labor.length > 0) fields.labor = labor;

  const activities = [
    { test: /concretagem/, description: "Concretagem da laje" },
    { test: /alvenaria/, description: "Alvenaria" },
    { test: /escava/, description: "Escavação" },
  ]
    .filter((a) => a.test.test(all))
    .map((a, i) => ({ id: `a${i + 1}`, description: a.description, service: null, location: null, status: "in_progress", quantity: null, unit: null, cumulativeProgressPercent: null, executor: null }));
  if (activities.length > 0) fields.activities = activities;

  const occurrences = entries
    .filter((e) => /acidente/i.test(e.transcript))
    .map((e, i) => ({
      id: `o${i + 1}`,
      type: "accident",
      description: e.transcript.split("\n").find((line) => /acidente/i.test(line))?.trim() ?? "Acidente",
      startTime: clockIn(e.capturedAt, timeZone),
      endTime: null,
      status: "open",
      affectedServiceIds: [],
      source: null,
      safety: null,
      materials: null,
    }));
  if (occurrences.length > 0) fields.occurrences = occurrences;
  occurrences.forEach((_, i) => {
    questions.push({ kind: "safety", text: "Houve acidente: qual o tipo, teve DDS e o EPI estava em uso?", field: `occurrences.${i}.safety`, options: [] });
  });
  return { fields, questions };
}

function correct(user: string) {
  const instruction = (/Instrução falada:\n([\s\S]*)$/.exec(user)?.[1] ?? "").trim();
  const fields: Record<string, unknown> = {};
  const note = /observaç(?:ão|ões) do efetivo: (.+)/i.exec(instruction);
  if (note) fields.laborNotes = note[1]!.trim();
  const rain = /pluviometria de (\d+(?:[.,]\d+)?)/i.exec(instruction);
  if (rain) fields.rainfallMm = Number(rain[1]!.replace(",", "."));
  return { fields, summary: Object.keys(fields).length > 0 ? `Mudou ${Object.keys(fields).join(", ")}` : "Nada mudou" };
}

function interpret(user: string) {
  const transcript = (/Transcrição:\n([\s\S]*)$/.exec(user)?.[1] ?? "").trim();
  const words = transcript.replace(/^#.*$/gm, "").split(/\s+/).filter(Boolean);
  const tags = [
    { test: /acidente/i, kind: "safety", label: "Segurança: acidente" },
    { test: /pedreiro|servente/i, kind: "labor", label: "Efetivo" },
    { test: /concretagem|alvenaria|escava/i, kind: "activity", label: "Atividade" },
  ].filter((t) => t.test.test(transcript));
  return { title: words.slice(0, 6).join(" ") || "Registro de teste", tags: tags.map(({ kind, label }) => ({ kind, label })), openItemIds: [] };
}

export async function fakeComplete(name: string, user: string): Promise<string> {
  if (name === "assemble-report") {
    await sleep(delayOf(user, "lento-ia"));
    return JSON.stringify(assemble(user));
  }
  if (name === "correct-report") return JSON.stringify(correct(user));
  if (name === "interpret-entry") return JSON.stringify(interpret(user));
  return "Conexão de teste com a IA falsa (AI_FAKE).";
}
