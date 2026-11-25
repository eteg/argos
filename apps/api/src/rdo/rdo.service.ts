import { blockingFields, findMissingFields, reportContentSchema, type ReportContent, type SiteType } from "@argos/rdo-schema";
import { Inject, Injectable } from "@nestjs/common";
import { and, asc, eq, max } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { z } from "zod";
import { AiService } from "../ai/ai.service";
import { db } from "../db/db";
import { entries, media, reports, sites, type EntryTag, type Question } from "../db/schema";

const SYSTEM = `Você é o agente do Argos, que preenche o RDO (Relatório Diário de Obra) a partir dos áudios e fotos que o engenheiro grava ao longo do dia.
Regras:
- Nunca invente. Campo que o engenheiro não falou fica null (ou lista vazia), e você pergunta por ele.
- Use só o que está nos relatos e no cadastro da obra.
- Escreva em português do Brasil, com o jargão de obra que o engenheiro usou.`;

const interpretationSchema = z.object({
  title: z.string().describe("Resumo curto do registro pra linha do dia, como 'Chuva parou a concretagem'"),
  tags: z.array(
    z.object({
      kind: z.enum(["activity", "occurrence", "labor", "equipment", "weather", "safety"]),
      label: z.string().describe("Como 'Ocorrência: falta de material' ou 'Efetivo: 12 pedreiros'"),
    }),
  ),
});

const reportOutputSchema = z.object({
  content: reportContentSchema,
  questions: z
    .array(z.object({ field: z.string().describe("Caminho do campo, como weather.0.weather"), text: z.string() }))
    .describe("Uma pergunta curta e direta pra cada campo obrigatório que ficou null"),
});

type SiteRow = typeof sites.$inferSelect;

@Injectable()
export class RdoService {
  constructor(@Inject(AiService) private readonly ai: AiService) {}

  // Transcreve o áudio e diz o que o agente entendeu do registro (3.2).
  async interpretEntry(entryId: string) {
    const [entry] = await db.select().from(entries).where(eq(entries.id, entryId));
    if (!entry) return;
    try {
      let transcript = entry.transcript;
      if (!transcript && entry.audioMediaId) {
        const [audio] = await db.select().from(media).where(eq(media.id, entry.audioMediaId));
        if (audio) transcript = await this.ai.transcribe(readFileSync(audio.path), audio.contentType);
      }
      let title: string | null = entry.photoMediaIds.length > 0 ? `${entry.photoMediaIds.length} foto(s)` : null;
      let tags: EntryTag[] = [];
      if (transcript) {
        const out = await this.ai.parse({
          name: "interpretar-registro",
          system: SYSTEM,
          prompt: `Relato do engenheiro gravado às ${entry.capturedAt.toISOString()}:\n"""${transcript}"""\n\nDê um título curto e marque o que você reconheceu.`,
          effort: "low",
          schema: interpretationSchema,
        });
        title = out.title;
        tags = out.tags;
      }
      await db.update(entries).set({ status: "processed", transcript, title, tags }).where(eq(entries.id, entryId));
    } catch {
      await db.update(entries).set({ status: "failed" }).where(eq(entries.id, entryId));
    }
  }

  // Cria ou reabre o rascunho do dia e preenche em segundo plano (202).
  async startReport(site: SiteRow, localDate: string) {
    const [existing] = await db
      .select()
      .from(reports)
      .where(and(eq(reports.siteId, site.id), eq(reports.localDate, localDate)));
    if (existing) {
      await db.update(reports).set({ status: "generating", error: null }).where(eq(reports.id, existing.id));
      void this.fillReport(existing.id);
      return existing.id;
    }
    // D11: o número sai ao gerar, em sequência por obra.
    const [last] = await db.select({ n: max(reports.number) }).from(reports).where(eq(reports.siteId, site.id));
    const [row] = await db
      .insert(reports)
      .values({ siteId: site.id, localDate, number: (last?.n ?? 0) + 1, status: "generating", site: snapshot(site) })
      .returning();
    void this.fillReport(row!.id);
    return row!.id;
  }

  private async fillReport(reportId: string) {
    const [report] = await db.select().from(reports).where(eq(reports.id, reportId));
    if (!report) return;
    const [site] = await db.select().from(sites).where(eq(sites.id, report.siteId));
    const dayEntries = await db
      .select()
      .from(entries)
      .where(and(eq(entries.siteId, report.siteId), eq(entries.localDate, report.localDate)))
      .orderBy(asc(entries.capturedAt));
    // Registro novo que ainda não foi interpretado entra agora.
    for (const e of dayEntries.filter((x) => x.status === "processing")) await this.interpretEntry(e.id);
    const fresh = await db
      .select()
      .from(entries)
      .where(and(eq(entries.siteId, report.siteId), eq(entries.localDate, report.localDate)))
      .orderBy(asc(entries.capturedAt));
    const relatos = fresh
      .map((e) => `- ${hhmm(e.capturedAt, e.timezone)}: ${e.transcript ?? "(sem áudio)"}${e.photoMediaIds.length ? ` [${e.photoMediaIds.length} foto(s)]` : ""}`)
      .join("\n");
    try {
      const out = await this.ai.parse({
        name: "preencher-rdo",
        system: SYSTEM,
        prompt: `Obra: ${site!.name} (${site!.type === "private" ? "obra privada" : "obra pública ou financiada"}).
Equipamentos cadastrados na obra (use exatamente estes equipmentId, name e identifier, e preencha só status e operatingHours):
${JSON.stringify(site!.equipment)}
A obra não tem planilha de serviços importada: deixe serviceId null.
Dia: ${report.localDate}.
${report.content ? `Rascunho atual, já revisado pelo engenheiro (mantenha o que ele corrigiu):\n${JSON.stringify(report.content)}\n` : ""}
Relatos do dia, em ordem:
${relatos}

Preencha o RDO. Ids de atividade e ocorrência: "a1", "a2"..., "o1", "o2"...
weather tem sempre dois itens, morning e afternoon. openItemReviews e newOpenItems ficam vazios.
Em obra pública ou financiada, também são obrigatórios: horas paradas por clima, quantidade e unidade de cada atividade, serviços afetados e documento de origem de cada ocorrência.
Ocorrência de acidente precisa de safety (DDS e EPI em uso), e você pergunta o que não foi falado.`,
        effort: "medium",
        schema: reportOutputSchema,
      });
      const questions = toQuestions(out.questions, out.content, site!);
      await db
        .update(reports)
        .set({
          status: "draft",
          content: out.content,
          questions,
          history: [...report.history, { at: new Date().toISOString(), actor: "agent", description: `Montado a partir de ${fresh.length} registro(s)` }],
        })
        .where(eq(reports.id, reportId));
    } catch (error) {
      await db.update(reports).set({ status: report.content ? "draft" : "failed", error: String(error) }).where(eq(reports.id, reportId));
    }
  }

  // RG05: a resposta do engenheiro entra no RDO pela IA, sem inventar o resto.
  async applyAnswer(reportId: string, questionId: string, answer: string) {
    const [report] = await db.select().from(reports).where(eq(reports.id, reportId));
    const [site] = await db.select().from(sites).where(eq(sites.id, report!.siteId));
    const question = report!.questions.find((q) => q.id === questionId)!;
    const content = await this.ai.parse({
      name: "aplicar-resposta",
      system: SYSTEM,
      prompt: `RDO atual:\n${JSON.stringify(report!.content)}\n\nVocê perguntou: "${question.text}" (campo ${question.field ?? "livre"}).\nO engenheiro respondeu: "${answer}".\n\nDevolva o RDO inteiro com a resposta aplicada. Não mude nada que a resposta não cobre.`,
      effort: "low",
      schema: reportContentSchema,
    });
    const answered = report!.questions.map((q) =>
      q.id === questionId
        ? { ...q, status: "answered" as const, answer: { optionId: null, text: answer, audioMediaId: null, answeredAt: new Date().toISOString() } }
        : q,
    );
    const missing = new Set(blockingFields(content, site!.type as SiteType, { hasServices: false }).map((f) => f.field));
    // Pergunta aberta cujo campo foi preenchido pela resposta sai da tela.
    const questions = answered.map((q) => (q.status === "open" && q.field && !missing.has(q.field) ? { ...q, status: "answered" as const } : q));
    await db
      .update(reports)
      .set({
        content,
        questions,
        history: [...report!.history, { at: new Date().toISOString(), actor: "engineer", description: `Respondeu: ${question.text} → ${answer}` }],
      })
      .where(eq(reports.id, reportId));
  }
}

function toQuestions(asked: { field: string; text: string }[], content: ReportContent, site: SiteRow): Question[] {
  const missing = findMissingFields(content, site.type as SiteType, { hasServices: false }).filter((f) => f.level !== "recommended");
  const byField = new Map(asked.map((q) => [q.field, q.text]));
  // Todo campo obrigatório vazio tem uma pergunta, mesmo que a IA tenha esquecido de fazer.
  return missing.map((f) => ({
    id: randomUUID(),
    kind: f.field.includes("safety") ? "safety" : "missing_field",
    text: byField.get(f.field) ?? `Você não falou ${describeField(f.field, content)}. Pode me dizer?`,
    field: f.field,
    openItemId: null,
    options: [],
    status: "open",
    answer: null,
  }));
}

function snapshot(site: SiteRow) {
  return {
    name: site.name,
    type: site.type,
    address: site.address,
    client: site.client,
    contractor: site.contractor,
    technicalManager: site.technicalManager,
    publicContract: site.publicContract,
  };
}

const hhmm = (d: Date, timezone: string) =>
  d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: timezone });

const FIELD_LABELS: Record<string, string> = {
  startTime: "o horário de início",
  endTime: "o horário de fim",
  breakMinutes: "o tempo de intervalo",
  weather: "o tempo",
  condition: "se deu pra trabalhar",
  status: "a situação",
  location: "o local",
  count: "a quantidade de pessoas",
  employment: "se é equipe própria ou terceirizada",
  company: "a empresa terceirizada",
  quantity: "a quantidade executada",
  unit: "a unidade",
  source: "o documento de origem",
  affectedServiceIds: "os serviços afetados",
  hours: "as horas paradas por clima",
  dds: "se teve DDS hoje",
  ppeInUse: "se o EPI estava em uso",
};

// "occurrences.1.startTime" vira "o horário de início da ocorrência \"Falta de aço\"".
function describeField(field: string, content: ReportContent) {
  const parts = field.split(".");
  const what = FIELD_LABELS[parts[parts.length - 1]!] ?? field;
  const i = Number(parts[1]);
  if (parts[0] === "weather" && Number.isInteger(i)) return `${what} da ${content.weather[i]?.shift === "morning" ? "manhã" : "tarde"}`;
  if (parts[0] === "occurrences" && content.occurrences[i]) return `${what} da ocorrência "${content.occurrences[i].description}"`;
  if (parts[0] === "activities" && content.activities[i]) return `${what} da atividade "${content.activities[i].description}"`;
  if (parts[0] === "labor" && content.labor[i]) return `${what} de ${content.labor[i].role}`;
  if (parts[0] === "equipment" && content.equipment[i]) return `${what} de ${content.equipment[i].name}`;
  return what;
}
