import { randomUUID } from "node:crypto";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { assembleReport, correctReport, interpretEntry, type AgentModel, type AgentQuestion, type ReportFields } from "@argos/agent";
import { validateReport } from "@argos/rdo-schema";
import { AiClientService } from "../ai/ai-client.service.js";
import { TranscriptionService } from "../ai/transcription.service.js";
import { DB, type Database } from "../database/database.module.js";
import { entries, equipment, media, questions, reports, services, sites } from "../database/schema.js";
import { OpenItemsService } from "../open-items/open-items.service.js";
import { StorageService } from "../storage/storage.service.js";

type Content = Record<string, unknown> & {
  workday: { startTime: string | null; endTime: string | null; breakMinutes: number | null };
  weather: { shift: string; weather: string | null; condition: string | null }[];
  weatherStoppage: unknown;
  rainfallMm: number | null;
  labor: unknown[];
  laborNotes: string | null;
  equipment: { equipmentId: string; name?: string; status: string | null; operatingHours: number | null }[];
  activities: { id: string; service: { id: string } | null }[];
  occurrences: { id: string; description: string }[];
  openItemReviews: unknown[];
  newOpenItems: { id: string }[];
};

const MIN_PHOTOS = 3;
const MAX_PHOTOS = 20;
const STALE_MS = 5 * 60 * 1000;
const periodName = (i: number) => (i === 0 ? "de manhã" : "à tarde");
const weatherOptions = [
  { id: "good", label: "Bom" },
  { id: "cloudy", label: "Nublado" },
  { id: "light_rain", label: "Chuva fraca" },
  { id: "heavy_rain", label: "Chuva forte" },
];
const conditionOptions = [
  { id: "workable", label: "Praticável" },
  { id: "partially_workable", label: "Parcialmente praticável" },
  { id: "unworkable", label: "Impraticável" },
];

export function setPath(target: Record<string, unknown>, path: string, value: unknown) {
  const keys = path.split(".");
  let node: unknown = target;
  for (const key of keys.slice(0, -1)) {
    if (typeof node !== "object" || node === null) return false;
    node = (node as Record<string, unknown>)[key];
  }
  const last = keys.at(-1);
  if (typeof node !== "object" || node === null || last === undefined) return false;
  (node as Record<string, unknown>)[last] = value;
  return true;
}

const emptyObject = (value: unknown) => value === null || (typeof value === "object" && Object.values(value).every((v) => v === null));

@Injectable()
export class ProcessingService {
  private readonly logger = new Logger(ProcessingService.name);
  private readonly model: AgentModel;

  constructor(
    @Inject(DB) private readonly db: Database,
    ai: AiClientService,
    private readonly transcription: TranscriptionService,
    private readonly storage: StorageService,
    private readonly openItemsService: OpenItemsService,
  ) {
    this.model = {
      complete: async (request) =>
        (await ai.run({ name: request.name, system: request.system, messages: [{ role: "user", content: request.user }], documents: [], maxTokens: request.maxTokens, timeoutMs: 120_000 })).output,
    };
  }

  private async transcribeMedia(mediaId: string): Promise<string> {
    const [row] = await this.db.select().from(media).where(eq(media.id, mediaId));
    if (!row) throw new Error("Media not found.");
    if (row.durationSeconds !== null && row.durationSeconds < 1) return "";
    return this.transcription.transcribe(await this.storage.read("media", mediaId), row.mimeType);
  }

  async processEntry(entryId: string) {
    try {
      const [entry] = await this.db.select().from(entries).where(eq(entries.id, entryId));
      if (!entry) return;
      const transcript = await this.transcribeMedia(entry.audioMediaId);
      if (transcript === "") {
        await this.db.update(entries).set({ status: "failed", transcript: "" }).where(eq(entries.id, entryId));
        return;
      }
      await this.db.update(entries).set({ status: "processed", transcript }).where(eq(entries.id, entryId));
      try {
        const open = await this.openItemsService.openForSite(entry.siteId, entry.localDate);
        const result = await interpretEntry(this.model, {
          transcript,
          services: [],
          openItems: open.map((o) => ({ id: o.id, title: o.title, kind: o.kind, openedOn: o.openedOn })),
        });
        const valid = new Set(open.map((o) => o.id));
        const openItemIds = result.openItemIds.filter((id) => valid.has(id));
        await this.db.update(entries).set({ title: result.title, tags: result.tags, openItemIds }).where(eq(entries.id, entryId));
      } catch (error) {
        this.logger.warn(`interpretEntry failed for ${entryId}: ${String(error)}`);
      }
      await this.askAboutOpenItem(entry.id, entry.siteId, entry.localDate).catch((error: unknown) => this.logger.warn(`askAboutOpenItem failed for ${entryId}: ${String(error)}`));
    } catch (error) {
      this.logger.error(`processEntry failed for ${entryId}: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`);
      await this.db.update(entries).set({ status: "failed" }).where(eq(entries.id, entryId));
    }
  }

  private readonly closeOrKeep = [
    { id: "close", label: "Já resolveu, pode fechar" },
    { id: "keep", label: "Continua em aberto" },
  ];

  private async askAboutOpenItem(entryId: string, siteId: string, localDate: string) {
    const open = await this.openItemsService.openForSite(siteId, localDate);
    if (open.length === 0) return;
    const dayEntries = await this.db.select({ id: entries.id, openItemIds: entries.openItemIds }).from(entries).where(and(eq(entries.siteId, siteId), eq(entries.localDate, localDate)));
    const cited = new Set(dayEntries.flatMap((e) => e.openItemIds));
    const asked = await this.db
      .select({ openItemId: questions.openItemId })
      .from(questions)
      .where(and(inArray(questions.entryId, dayEntries.map((e) => e.id)), eq(questions.kind, "open_item")));
    const askedIds = new Set(asked.map((q) => q.openItemId));
    const next = open.find((o) => !cited.has(o.id) && !askedIds.has(o.id));
    if (!next) return;
    const [, month, day] = next.openedOn.split("-");
    await this.db.insert(questions).values({
      entryId,
      kind: "open_item",
      openItemId: next.id,
      text: `Ficou em aberto desde ${day}/${month}: ${next.title}. Como está?`,
      options: this.closeOrKeep,
    });
  }

  async answerSpoken(questionId: string, mediaId: string) {
    try {
      const text = await this.transcribeMedia(mediaId);
      const [row] = await this.db.select().from(questions).where(eq(questions.id, questionId));
      if (!row?.answer) return;
      await this.db.update(questions).set({ answer: { ...row.answer, text: text || null } }).where(eq(questions.id, questionId));
    } catch (error) {
      this.logger.error(`answerSpoken failed for ${questionId}: ${String(error)}`);
    }
  }

  private fill(base: Content, fields: ReportFields, serviceIds: Set<string>, equipmentIds: Set<string>, openIds: Set<string>, openTitles: Set<string>): Content {
    const next: Content = { ...base };
    const incoming = fields as Record<string, unknown> & ReportFields;
    if (incoming.workday) next.workday = { startTime: base.workday.startTime ?? incoming.workday.startTime ?? null, endTime: base.workday.endTime ?? incoming.workday.endTime ?? null, breakMinutes: base.workday.breakMinutes ?? incoming.workday.breakMinutes ?? null };
    if (incoming.weather) {
      next.weather = base.weather.map((w) => {
        const ai = incoming.weather?.find((x) => x.shift === w.shift);
        return { ...w, weather: w.weather ?? ai?.weather ?? null, condition: w.condition ?? ai?.condition ?? null };
      });
    }
    if (emptyObject(base.weatherStoppage) && incoming.weatherStoppage) next.weatherStoppage = { hours: incoming.weatherStoppage.hours, serviceIds: (incoming.weatherStoppage.serviceIds ?? []).filter((id) => serviceIds.has(id)) };
    if (base.rainfallMm === null && incoming.rainfallMm !== undefined) next.rainfallMm = incoming.rainfallMm;
    if (base.laborNotes === null && incoming.laborNotes !== undefined) next.laborNotes = incoming.laborNotes;
    if (base.labor.length === 0 && incoming.labor) next.labor = incoming.labor;
    if (incoming.equipment) {
      next.equipment = base.equipment.map((e) => {
        const ai = incoming.equipment?.find((x) => x.equipmentId === e.equipmentId && equipmentIds.has(x.equipmentId ?? ""));
        return { ...e, status: e.status ?? ai?.status ?? null, operatingHours: e.operatingHours ?? ai?.operatingHours ?? null };
      });
    }
    const cleanServices = (list: string[] | null | undefined) => (list ?? []).filter((id) => serviceIds.has(id));
    if (base.activities.length === 0 && incoming.activities) {
      next.activities = incoming.activities.map((a) => ({ ...a, id: randomUUID(), service: a.service && serviceIds.has(a.service.id ?? "") ? a.service : null }));
    }
    if (base.occurrences.length === 0 && incoming.occurrences) {
      next.occurrences = incoming.occurrences.map((o) => ({ ...o, id: randomUUID(), affectedServiceIds: cleanServices(o.affectedServiceIds) })) as unknown as Content["occurrences"];
    }
    if (base.openItemReviews.length === 0 && incoming.openItemReviews) next.openItemReviews = incoming.openItemReviews.filter((r) => openIds.has(r.openItemId ?? ""));
    if (base.newOpenItems.length === 0 && incoming.newOpenItems) {
      next.newOpenItems = incoming.newOpenItems.filter((n) => !openTitles.has((n.title ?? "").trim().toLowerCase())).map((n) => ({ ...n, id: randomUUID() }));
    }
    return next;
  }

  private check(content: Content) {
    return validateReport(content, { minPhotosPerReport: MIN_PHOTOS, maxPhotosPerReport: MAX_PHOTOS });
  }

  private autoQuestion(path: string, content: Content): AgentQuestion | null {
    const [head, index, leaf] = path.split(".");
    const i = Number(index);
    const q = (text: string, options: AgentQuestion["options"] = []): AgentQuestion => ({ kind: "missing_field", text, field: path, options });
    if (path === "workday.startTime") return q("A que horas começou a jornada?");
    if (path === "workday.endTime") return q("A que horas terminou a jornada?");
    if (path === "workday.breakMinutes") return q("Quantos minutos de intervalo teve?");
    if (head === "weather" && leaf === "weather") return q(`Como estava o tempo ${periodName(i)}?`, weatherOptions);
    if (head === "weather" && leaf === "condition") return q(`O tempo permitiu trabalhar ${periodName(i)}?`, conditionOptions);
    if (path === "labor") return q("Quantas pessoas trabalharam hoje e em quais funções?");
    if (path === "activities") return q("Quais atividades foram feitas hoje?");
    if (head === "labor" && leaf === "employment") {
      const l = content.labor[i] as { role?: string; count?: number } | undefined;
      return q(`${l?.count ?? ""} ${l?.role ?? "da equipe"}: são próprios ou terceirizados?`.trim(), [{ id: "own", label: "Próprios" }, { id: "third_party", label: "Terceirizados" }]);
    }
    if (head === "equipment" && (leaf === "status" || leaf === "operatingHours")) {
      const name = content.equipment[i]?.name ?? "O equipamento";
      return leaf === "status"
        ? q(`Como ficou ${name} hoje?`, [{ id: "operating", label: "Operando" }, { id: "stopped", label: "Parado" }, { id: "under_maintenance", label: "Em manutenção" }])
        : q(`Quantas horas ${name} operou hoje?`);
    }
    if (head === "labor" && leaf === "company") return q("Qual é a empresa terceirizada dessa equipe?");
    if (head === "occurrences" && leaf === "endTime") return q(`A que horas terminou: ${content.occurrences[i]?.description ?? "a ocorrência"}?`);
    if (head === "occurrences" && leaf === "safety") return { kind: "safety", text: "Há indício de acidente: informe o tipo, se teve DDS e se o EPI estava em uso.", field: path, options: [] };
    if (path === "photos" || head === "activities" || head === "occurrences") return null;
    return q(`Faltou informar: ${path}.`);
  }

  async buildReport(reportId: string) {
    let note = "Argos preencheu o RDO a partir dos registros do dia";
    try {
      const [row] = await this.db.select().from(reports).where(eq(reports.id, reportId));
      if (!row) return;
      const [site] = await this.db.select().from(sites).where(eq(sites.id, row.siteId));
      if (!site) return;
      for (let wait = 0; wait < 30; wait++) {
        const pending = await this.db.select({ id: entries.id }).from(entries).where(and(eq(entries.siteId, row.siteId), eq(entries.localDate, row.localDate), eq(entries.status, "processing")));
        if (pending.length === 0) break;
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
      const dayEntries = await this.db.select().from(entries).where(and(eq(entries.siteId, row.siteId), eq(entries.localDate, row.localDate), eq(entries.status, "processed"))).orderBy(asc(entries.capturedAt));
      const spoken = dayEntries.filter((e) => e.transcript);
      const base = row.content as unknown as Content;
      let content = base;
      let agentQuestions: AgentQuestion[] = [];
      const openRows = await this.openItemsService.openForSite(site.id, row.localDate);
      const citedIds = new Set(dayEntries.flatMap((e) => e.openItemIds));
      const openIds = new Set(openRows.map((o) => o.id));
      const openTitles = new Set(openRows.map((o) => o.title.trim().toLowerCase()));
      if (spoken.length === 0) {
        note = "Nenhum registro pôde ser transcrito: preencha o RDO à mão";
      } else {
        const [serviceRows, equipmentRows] = await Promise.all([
          this.db.select().from(services).where(eq(services.siteId, site.id)).orderBy(asc(services.code)),
          this.db.select().from(equipment).where(eq(equipment.siteId, site.id)),
        ]);
        const result = await assembleReport(this.model, {
          siteType: (base.site as { type: "private" | "public" | "financed" }).type,
          localDate: row.localDate,
          timezone: dayEntries[0]?.timezone ?? "America/Sao_Paulo",
          entries: spoken.map((e) => ({ capturedAt: e.capturedAt.toISOString(), transcript: e.transcript ?? "" })),
          services: serviceRows.map((s) => ({ id: s.id, code: s.code, description: s.description, unit: s.unit })),
          equipment: equipmentRows.map((e) => ({ equipmentId: e.id, name: e.name, identifier: e.identifier })),
          openItems: openRows.map((o) => ({ id: o.id, title: o.title, kind: o.kind, openedOn: o.openedOn, lastUpdate: o.lastUpdate ? `${o.lastUpdate.localDate}: ${o.lastUpdate.note}` : null, cited: citedIds.has(o.id) })),
        });
        let merged = this.fill(base, result.fields, new Set(serviceRows.map((s) => s.id)), new Set(equipmentRows.map((e) => e.id)), openIds, openTitles);
        const structural = this.check(merged).structuralErrors;
        if (structural.length > 0) {
          const bad = new Set(structural.map((e) => e.path.split(".")[0]));
          this.logger.warn(`Dropping invalid AI fields: ${[...bad].join(", ")}`);
          merged = { ...merged, ...Object.fromEntries([...bad].map((k) => [k as string, base[k as string]])) };
        }
        content = merged;
        agentQuestions = result.questions;
      }
      const answeredRows = await this.db
        .select()
        .from(questions)
        .where(and(inArray(questions.entryId, dayEntries.length ? dayEntries.map((e) => e.id) : [randomUUID()]), eq(questions.kind, "open_item"), eq(questions.status, "answered")));
      const answered = answeredRows.flatMap((q) => {
        if (!q.openItemId || !openIds.has(q.openItemId) || !q.answer) return [];
        const outcome = q.answer.optionId === "close" || q.answer.optionId === "keep" || q.answer.optionId === "update" ? q.answer.optionId : "update";
        return [{ openItemId: q.openItemId, outcome, note: q.answer.text }];
      });
      if (answered.length > 0) {
        const answeredIds = new Set(answered.map((a) => a.openItemId));
        content = { ...content, openItemReviews: [...(content.openItemReviews as { openItemId: string }[]).filter((r) => !answeredIds.has(r.openItemId)), ...answered] };
      }
      const reviewedIds = new Set((content.openItemReviews as { openItemId: string }[]).map((r) => r.openItemId));
      const openQuestions = openRows
        .filter((o) => !reviewedIds.has(o.id) && !citedIds.has(o.id))
        .map((o) => ({ kind: "open_item" as const, text: `Ficou em aberto: ${o.title}. Como está?`, field: null, options: this.closeOrKeep, openItemId: o.id }));
      const missing = this.check(content).missingFields;
      const pathsAsked = new Set(agentQuestions.map((q) => q.field));
      for (const m of missing) {
        if (pathsAsked.has(m.path)) continue;
        const auto = this.autoQuestion(m.path, content);
        if (auto) agentQuestions.push(auto);
      }
      const wanted = new Set(missing.map((m) => m.path));
      const kept = agentQuestions.filter((q) => q.kind !== "open_item" && (q.field === null || wanted.has(q.field) || q.kind === "service_match"));
      await this.db.transaction(async (tx) => {
        await tx.delete(questions).where(and(eq(questions.reportId, reportId), eq(questions.status, "open")));
        if (kept.length > 0) {
          await tx.insert(questions).values(kept.map((q) => ({ reportId, kind: q.kind, text: q.text, field: q.field, options: q.options })));
        }
        if (openQuestions.length > 0) {
          await tx.insert(questions).values(openQuestions.map((q) => ({ reportId, kind: q.kind, text: q.text, field: q.field, openItemId: q.openItemId, options: q.options })));
        }
        await tx
          .update(reports)
          .set({ content: content, status: "draft", history: sql`${reports.history} || ${JSON.stringify([{ at: new Date().toISOString(), actor: "agent", description: note }])}::jsonb`, updatedAt: new Date() })
          .where(eq(reports.id, reportId));
      });
    } catch (error) {
      this.logger.error(`buildReport failed for ${reportId}: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`);
      await this.db
        .update(reports)
        .set({ status: "draft", history: sql`${reports.history} || ${JSON.stringify([{ at: new Date().toISOString(), actor: "agent", description: "Não deu pra preencher com a IA agora: preencha à mão ou gere de novo" }])}::jsonb`, updatedAt: new Date() })
        .where(eq(reports.id, reportId));
    }
  }

  async voiceCorrection(reportId: string, audioMediaId: string, section: string | null) {
    let description = "Não deu pra aplicar a correção falada: tente de novo ou corrija à mão";
    let content: Content | null = null;
    try {
      const [row] = await this.db.select().from(reports).where(eq(reports.id, reportId));
      if (!row) return;
      const serviceRows = await this.db.select().from(services).where(eq(services.siteId, row.siteId)).orderBy(asc(services.code));
      const instruction = await this.transcribeMedia(audioMediaId);
      if (instruction === "") {
        description = "A correção falada não tinha fala audível";
      } else {
        const base = row.content as unknown as Content;
        const current = Object.fromEntries(Object.entries(base).filter(([key]) => !["site", "localDate", "photos"].includes(key)));
        const result = await correctReport(this.model, {
          current: current,
          instruction,
          section,
          services: serviceRows.map((s) => ({ id: s.id, code: s.code, description: s.description, unit: s.unit })),
        });
        const ids = new Set(serviceRows.map((s) => s.id));
        const candidate: Content = { ...base, ...(result.fields as Record<string, unknown>) };
        const idOf = (x: { id?: string | null }) => (typeof x.id === "string" && x.id.length === 36 ? x.id : randomUUID());
        const acts = candidate.activities as unknown as { id?: string; service?: { id: string } | null }[];
        candidate.activities = acts.map((a) => ({ ...a, id: idOf(a), service: a.service && ids.has(a.service.id) ? a.service : null }));
        candidate.occurrences = (candidate.occurrences as unknown as { id?: string }[]).map((o) => ({ ...o, id: idOf(o) })) as unknown as Content["occurrences"];
        candidate.newOpenItems = (candidate.newOpenItems as unknown as { id?: string }[]).map((n) => ({ ...n, id: idOf(n) }));
        if (this.check(candidate).structuralErrors.length === 0) {
          content = candidate;
          description = `Corrigiu por voz${section ? ` (${section})` : ""}: ${result.summary || instruction.slice(0, 120)}`;
        } else {
          description = "A correção falada gerou dados inválidos e não foi aplicada";
        }
      }
    } catch (error) {
      this.logger.error(`voiceCorrection failed for ${reportId}: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`);
    }
    await this.db
      .update(reports)
      .set({ ...(content ? { content: content } : {}), status: "draft", history: sql`${reports.history} || ${JSON.stringify([{ at: new Date().toISOString(), actor: "engineer", description }])}::jsonb`, updatedAt: new Date() })
      .where(eq(reports.id, reportId));
  }

  isStale(updatedAt: Date) {
    return Date.now() - updatedAt.getTime() > STALE_MS;
  }

  async mediaIds(ids: string[]) {
    return ids.length ? this.db.select({ id: media.id, kind: media.kind }).from(media).where(inArray(media.id, ids)) : [];
  }
}
