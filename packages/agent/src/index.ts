import { reportContentSchema } from "@argos/rdo-schema";
import { z } from "zod";

export interface AgentModel {
  complete(request: { name: string; system: string; user: string; maxTokens: number }): Promise<string>;
}

export interface ServiceInput {
  id: string;
  code: string;
  description: string;
  unit: string | null;
}

export interface EquipmentInput {
  equipmentId: string;
  name: string;
  identifier: string | null;
}

export interface OpenItemInput {
  id: string;
  title: string;
  kind: string;
  openedOn: string;
}

export interface EntryText {
  capturedAt: string;
  transcript: string;
}

export type SiteKind = "private" | "public" | "financed";

export const fieldsSchema = reportContentSchema.omit({ site: true, localDate: true, photos: true }).partial();
export type ReportFields = z.infer<typeof fieldsSchema>;

const questionSchema = z.object({
  kind: z.enum(["missing_field", "open_item", "service_match", "safety"]),
  text: z.string().min(1),
  field: z.string().nullable().default(null),
  options: z.array(z.object({ id: z.string(), label: z.string() })).default([]),
});
export type AgentQuestion = z.infer<typeof questionSchema>;

const interpretSchema = z.object({
  title: z.string().min(1),
  tags: z.array(z.object({ kind: z.enum(["activity", "occurrence", "labor", "equipment", "weather", "safety"]), label: z.string().min(1) })).default([]),
});
export type InterpretEntryResult = z.infer<typeof interpretSchema>;

const assembleSchema = z.object({ fields: z.unknown(), questions: z.array(questionSchema).default([]) });
const correctSchema = z.object({ fields: z.unknown(), summary: z.string().default("") });

export function extractJson(text: string): unknown {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  const body = fenced?.[1] ?? text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("The model did not return JSON.");
  return JSON.parse(body.slice(start, end + 1));
}

async function completeJson<T>(
  model: AgentModel,
  request: { name: string; system: string; user: string; maxTokens: number },
  parse: (value: unknown) => T,
): Promise<T> {
  let lastError = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const user = attempt === 0 ? request.user : `${request.user}\n\nSua resposta anterior era inválida: ${lastError}\nResponda de novo, só com o JSON corrigido.`;
    try {
      return parse(extractJson(await model.complete({ ...request, user })));
    } catch (error) {
      lastError = error instanceof Error ? error.message.slice(0, 600) : String(error);
    }
  }
  throw new Error(`Invalid model output after retry: ${lastError}`);
}

const RULES = `Regras que valem sempre:
- NUNCA invente. Só preencha o que foi dito nos registros. O que não foi dito fica null (campo) ou [] (lista).
- Horários em HH:MM (24 h). Números como número, sem unidade. Textos em português, como o engenheiro falou.
- Enums em inglês, exatamente como listados.`;

const SCHEMA_TEXT = `Formato de "fields" (todas as chaves opcionais; mande só o que o registro permite preencher):
workday: { startTime: "HH:MM"|null, endTime: "HH:MM"|null, breakMinutes: inteiro|null }
weather: lista com um item por turno: { shift: "morning"|"afternoon", weather: "good"|"cloudy"|"light_rain"|"heavy_rain"|null, condition: "workable"|"partially_workable"|"unworkable"|null }
weatherStoppage: { hours: número|null, serviceIds: [id de serviço] } | null   (horas paradas por clima)
rainfallMm: número|null
labor: [{ role, count, employment: "own"|"third_party", company: texto|null (obrigatório se third_party), category: "direct"|"indirect"|null }]
laborNotes: texto|null
equipment: [{ equipmentId (da lista de equipamentos da obra), name, identifier, status: "operating"|"stopped"|"under_maintenance"|null, operatingHours: número|null }]
activities: [{ id: "a1", description, service: { id, code, description, unit }|null, location: texto|null, status: "started"|"in_progress"|"completed"|"stopped"|null, quantity: número|null, unit: texto|null, cumulativeProgressPercent: número|null, executor: texto|null }]
occurrences: [{ id: "o1", type: "stoppage"|"accident"|"material_shortage"|"equipment_failure"|"inspection_order"|"visit"|"external_interference"|"other", description, startTime: "HH:MM"|null, endTime: "HH:MM"|null, status: "open"|"closed", affectedServiceIds: [id de serviço], source: { origin, document|null }|null, safety: { type: "accident"|"incident", dds: true|false, ppeInUse: true|false }|null, materials: texto|null }]
openItemReviews: [{ openItemId, outcome: "close"|"keep"|"update", note: texto|null }]
newOpenItems: [{ id: "n1", title, kind: "declared_pending"|"unresolved_occurrence"|"unfinished_service", track: true|false }]`;

export interface InterpretEntryInput {
  transcript: string;
  services: ServiceInput[];
}

export function interpretEntry(model: AgentModel, input: InterpretEntryInput): Promise<InterpretEntryResult> {
  return completeJson(
    model,
    {
      name: "interpret-entry",
      maxTokens: 500,
      system: `Você ajuda um engenheiro de obra. Leia a transcrição de um registro de áudio do dia e resuma.
Responda só com JSON: {"title": "até 6 palavras, ex.: Chuva parou a concretagem", "tags": [{"kind": "activity"|"occurrence"|"labor"|"equipment"|"weather"|"safety", "label": "ex.: Ocorrência: falta de material"}]}
Use só o que foi dito. Sem tags se nada for reconhecido.`,
      user: `Transcrição:\n${input.transcript}`,
    },
    (value) => interpretSchema.parse(value),
  );
}

export interface AssembleReportInput {
  siteType: SiteKind;
  localDate: string;
  timezone: string;
  entries: EntryText[];
  services: ServiceInput[];
  equipment: EquipmentInput[];
  openItems: OpenItemInput[];
}

export interface AssembleReportResult {
  fields: ReportFields;
  questions: AgentQuestion[];
}

const servicesText = (services: ServiceInput[]) => services.map((s) => `${s.id} | ${s.code} | ${s.description} | ${s.unit ?? ""}`).join("\n");

export function assembleReport(model: AgentModel, input: AssembleReportInput): Promise<AssembleReportResult> {
  const publicRules =
    input.siteType === "private"
      ? "A obra é privada: não precisa de quantidade por atividade, serviços afetados, fonte da ocorrência nem horas paradas por clima."
      : "A obra é pública ou financiada: além do básico, são obrigatórios quantity e unit de cada atividade, affectedServiceIds e source de cada ocorrência, e weatherStoppage (horas paradas por clima e serviços afetados; use hours 0 só se o engenheiro disse que não parou).";
  return completeJson(
    model,
    {
      name: "assemble-report",
      maxTokens: 6000,
      system: `Você monta o RDO (Relatório Diário de Obra) a partir do que o engenheiro falou nos registros do dia.
${RULES}
- Para cada informação obrigatória que faltou, NÃO preencha: deixe vazio e faça uma pergunta curta em "questions", com "field" no caminho do campo (ex.: "workday.startTime", "weather.0.weather", "weather.1.condition", "occurrences.0.endTime", "activities.1.service"). Pergunte em português, como um colega.
- Pergunta sobre campo de lista fechada (clima, condição, vínculo, situação) leva "options" com id igual ao valor do enum e label em português.
- Serviço da planilha: escolha só pelo id da lista fornecida e só se tiver certeza. Se não tiver, service null e uma pergunta kind "service_match" com até 4 candidatos em options (id do serviço, label "código descrição").
- Acidente: crie a ocorrência type "accident". Preencha safety só se foram ditos o tipo, se houve DDS e se o EPI estava em uso; senão safety null e uma pergunta kind "safety" com field "occurrences.N.safety".
- Efetivo terceirizado exige company; se não foi dita, company null e pergunte.
- Equipamento: só os da lista da obra, pelo equipmentId. Informe status se foi dito.
- ${publicRules}
- Se houver itens em aberto, proponha o desfecho só dos que foram citados (close, keep ou update com note).
Responda só com JSON: {"fields": {...}, "questions": [{"kind": "missing_field"|"open_item"|"service_match"|"safety", "text": "...", "field": "caminho"|null, "options": [{"id": "...", "label": "..."}]}]}

${SCHEMA_TEXT}`,
      user: `Dia ${input.localDate} (fuso ${input.timezone}). Obra ${input.siteType}.

Serviços da planilha (id | código | descrição | unidade):
${servicesText(input.services) || "(nenhum)"}

Equipamentos da obra:
${input.equipment.map((e) => `${e.equipmentId} | ${e.name} | ${e.identifier ?? ""}`).join("\n") || "(nenhum)"}

Itens em aberto de dias anteriores:
${input.openItems.map((i) => `${i.id} | ${i.title} | aberto em ${i.openedOn}`).join("\n") || "(nenhum)"}

Registros do dia, em ordem (momento em UTC):
${input.entries.map((e, i) => `Registro ${i + 1} (${e.capturedAt}):\n${e.transcript}`).join("\n\n")}`,
    },
    (value) => {
      const parsed = assembleSchema.parse(value);
      return { fields: fieldsSchema.parse(parsed.fields ?? {}), questions: parsed.questions };
    },
  );
}

export interface CorrectReportInput {
  current: ReportFields;
  instruction: string;
  section: string | null;
  services: ServiceInput[];
}

export function correctReport(model: AgentModel, input: CorrectReportInput): Promise<{ fields: ReportFields; summary: string }> {
  return completeJson(
    model,
    {
      name: "correct-report",
      maxTokens: 4000,
      system: `Você corrige um RDO em rascunho a partir de uma instrução falada pelo engenheiro.
${RULES}
- Mude só o que a instrução pede. Em "fields" mande apenas as chaves alteradas, com o valor novo COMPLETO (listas inteiras, não só o item mudado).
- Se a instrução citar serviço da planilha, use só os ids da lista fornecida.
Responda só com JSON: {"fields": {...}, "summary": "frase curta do que mudou"}

${SCHEMA_TEXT}`,
      user: `${input.section ? `Seção em foco: ${input.section}\n` : ""}Serviços da planilha (id | código | descrição | unidade):
${servicesText(input.services) || "(nenhum)"}

RDO atual:
${JSON.stringify(input.current)}

Instrução falada:
${input.instruction}`,
    },
    (value) => {
      const parsed = correctSchema.parse(value);
      return { fields: fieldsSchema.parse(parsed.fields ?? {}), summary: parsed.summary };
    },
  );
}
