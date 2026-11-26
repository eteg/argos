"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Schemas } from "@argos/contract";
import { api, timezoneParams } from "@/lib/api";
import { errorMessage, fullDate } from "@/lib/format";
import { useOnline } from "@/lib/online";
import { ApiError, unwrap, useLoad } from "@/lib/hooks";
import { agePill, ageLabel, localToday } from "@/lib/open-items";
import { uploadFile } from "@/lib/send-entry";
import { Back, Page, Status, Title } from "@/components/ui";

type Report = Schemas["Report"];
const tz = timezoneParams();
const HIGHLIGHT_DAYS = 4;
const weatherLabel = { good: "Bom", cloudy: "Nublado", light_rain: "Chuva fraca", heavy_rain: "Chuva forte" } as const;
const conditionLabel = { workable: "Praticável", partially_workable: "Parcialmente praticável", unworkable: "Impraticável" } as const;
const statusLabel = { started: "iniciada", in_progress: "em andamento", completed: "concluída", stopped: "parada" } as const;
const occurrenceLabel = { stoppage: "Paralisação", accident: "Acidente", material_shortage: "Falta de material", equipment_failure: "Falha de equipamento", inspection_order: "Ordem da fiscalização", visit: "Visita", external_interference: "Interferência externa", other: "Outra" } as const;
const siteTypeLabel = { private: "Privada", public: "Pública", financed: "Financiada" } as const;

const field = "h-11 w-full min-w-0 box-border rounded-[10px] border-[1.5px] border-[#CDD1DD] bg-white px-2.5 text-[15px] text-[#2D2D2B] disabled:opacity-100";
const missingField = "!border-[#A673D6] !bg-[#F7F0FD]";
const rotulo = "text-[13px] text-[#5B5F6B]";
const hint = "text-[13px] leading-[1.45] text-[#4A2470]";

function readSession(name: string) {
  try {
    return sessionStorage.getItem(name);
  } catch {
    return null;
  }
}

function writeSession(name: string, value: string | null) {
  try {
    if (value === null) sessionStorage.removeItem(name);
    else sessionStorage.setItem(name, value);
  } catch {
    return;
  }
}

const joinList = (items: string[]) => (items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} e ${items.at(-1)}`);
const clock = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

function MicIcon({ color = "#1563FF", size = 18 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M12 18v3" />
    </svg>
  );
}

function MicButton({ label, active, disabled, onClick }: { label: string; active: boolean; disabled: boolean; onClick: () => void }) {
  return (
    <button type="button" aria-label={label} disabled={disabled} onClick={onClick} className={`flex size-11 flex-none items-center justify-center rounded-full disabled:opacity-50 ${active ? "bg-[#CCA6ED]" : "bg-[#E3ECFF]"}`}>
      <MicIcon />
    </button>
  );
}

function Bloco({ id, title, mic, accent, children }: { id: string; title: string; mic?: React.ReactNode; accent?: boolean; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className={`flex flex-col gap-3 rounded-2xl bg-white p-3.5 ${accent ? "border-[1.5px] border-[#CCA6ED]" : ""}`}>
      {mic ? (
        <div className="flex items-center justify-between gap-2"><h2 id={id} className="m-0 text-[15px] font-semibold">{title}</h2>{mic}</div>
      ) : (
        <h2 id={id} className="m-0 text-[15px] font-semibold">{title}</h2>
      )}
      {children}
    </section>
  );
}

function Publico({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5 border-t border-dashed border-[#CDD1DD] pt-3">
      <span className="text-xs font-semibold tracking-[0.02em] text-[#5B5F6B]">{title}</span>
      {children}
    </div>
  );
}

function Info({ k, v, wide }: { k: string; v: string; wide?: boolean }) {
  return (
    <div className={`flex min-w-0 flex-col gap-1 ${wide ? "col-span-2" : ""}`}><span className={rotulo}>{k}</span><span className="text-[15px]">{v}</span></div>
  );
}

function Item({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-0.5 border-b border-[#E3E5EE] py-2.5 last:border-b-0 last:pb-0">{children}</div>;
}

const period = (i: string | undefined) => (i === "0" ? "da manhã" : "da tarde");

function fieldLabel(path: string) {
  const [head, index, leaf] = path.split(".");
  if (path === "workday.startTime") return "início da jornada";
  if (path === "workday.endTime") return "fim da jornada";
  if (path === "workday.breakMinutes") return "intervalo";
  if (head === "weather" && leaf === "weather") return `tempo ${period(index)}`;
  if (head === "weather" && leaf === "condition") return `condição ${period(index)}`;
  if (head === "weather") return "clima";
  if (head === "weatherStoppage") return "horas paradas por clima";
  if (head === "labor" && leaf === "employment") return "vínculo do efetivo";
  if (head === "labor" && leaf === "company") return "empresa terceirizada";
  if (head === "labor") return "efetivo";
  if (head === "equipment") return leaf === "operatingHours" ? "horas do equipamento" : "situação do equipamento";
  if (head === "activities" && index !== undefined && leaf === undefined) return "foto da atividade";
  if (head === "activities") return leaf === "service" ? "serviço da atividade" : leaf === "quantity" ? "quantidade da atividade" : "atividades";
  if (head === "occurrences" && index !== undefined && leaf === undefined) return "foto da ocorrência";
  if (head === "occurrences") return leaf === "safety" ? "registro de segurança" : leaf === "endTime" ? "fim da ocorrência" : "ocorrências";
  if (head === "photos") return "fotos (mínimo 3)";
  return path;
}


function useVoiceCorrection(reportId: string, onStarted: (r: Report) => void, onError: (e: ApiError) => void) {
  const [section, setSection] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const startedAt = useRef("");
  const began = useRef(0);

  async function toggle(target: string | null) {
    if (recording) return rec.current?.stop();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const r = new MediaRecorder(stream);
      chunks.current = [];
      r.ondataavailable = (e) => chunks.current.push(e.data);
      r.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        const blob = new Blob(chunks.current, { type: r.mimeType || "audio/webm" });
        const mediaId = crypto.randomUUID();
        void (async () => {
          try {
            await uploadFile({ id: mediaId, blob, capturedAt: startedAt.current, durationSeconds: Math.round((Date.now() - began.current) / 1000) }, "audio", null);
            onStarted(await unwrap(api.POST("/v1/reports/{reportId}/voice-corrections", { params: { path: { reportId }, ...tz }, body: { audioMediaId: mediaId, ...(target ? { section: target } : {}) } })));
          } catch (e) {
            onError(e instanceof ApiError ? e : new ApiError("UNAVAILABLE"));
          }
        })();
      };
      startedAt.current = new Date().toISOString();
      began.current = Date.now();
      rec.current = r;
      setSection(target);
      r.start();
      setRecording(true);
    } catch {
      onError(new ApiError("UNAVAILABLE"));
    }
  }

  return { recording, section, toggle };
}

export function ReportReview() {
  const router = useRouter();
  const online = useOnline();
  const id = useSearchParams().get("id") ?? "";
  const [state, retry] = useLoad(() => unwrap(api.GET("/v1/reports/{reportId}", { params: { path: { reportId: id }, ...tz } })), [id]);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const [services, setServices] = useState<Schemas["Service"][] | null>(null);
  const [showAll, setShowAll] = useState(false);
  const current = report ?? (state.status === "ok" ? state.data : null);
  const generating = current?.status === "generating";
  const [dayState] = useLoad(async () => (current ? unwrap(api.GET("/v1/sites/{siteId}/days/{localDate}", { params: { path: { siteId: current.siteId, localDate: current.localDate }, ...tz } })) : null), [current?.siteId, current?.localDate]);
  const voice = useVoiceCorrection(id, setReport, setError);
  const approvalKeys = useRef<Record<string, string>>({});
  useEffect(() => {
    if (!generating) return;
    const t = setInterval(() => {
      void unwrap(api.GET("/v1/reports/{reportId}", { params: { path: { reportId: id }, ...tz } })).then(setReport, () => undefined);
    }, 3000);
    return () => clearInterval(t);
  }, [generating, id]);
  const isApproved = current?.status === "approved";
  useEffect(() => {
    if (isApproved) router.replace(`/rdo/aprovado?id=${id}`);
  }, [isApproved, id, router]);
  const siteForServices = current?.siteId;
  useEffect(() => {
    if (!siteForServices) return;
    let alive = true;
    void unwrap(api.GET("/v1/sites/{siteId}/services", { params: { path: { siteId: siteForServices }, ...tz } })).then(
      (result) => alive && setServices(result.items),
      () => undefined,
    );
    return () => {
      alive = false;
    };
  }, [siteForServices]);
  if (!current) return <Page><Status state={state.status === "ok" ? { status: "loading" } : state} retry={retry} /></Page>;
  const r = current;
  const approved = r.status === "approved";
  const busyAi = r.status === "generating";
  const isPublic = r.site.type !== "private";
  const openList = (dayState.status === "ok" ? (dayState.data?.openItems ?? []) : []).filter((i) => i.openedOn < r.localDate);
  const openQuestions = r.questions.filter((q) => q.status === "open");
  const missing = new Set(r.missingFields.map((m) => m.field));
  const isInline = (q: Schemas["Question"]) => q.field !== null && (q.field.startsWith("weather.") || /^activities\.\d+\.service$/.test(q.field));
  const inlineHint = (match: (field: string) => boolean) => openQuestions.filter((q) => q.field !== null && isInline(q) && match(q.field) && missing.has(q.field));
  const listed = openQuestions.filter((q) => !isInline(q));
  const lockUi = approved || busyAi || !online;
  const today = localToday(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const dayWord = r.localDate === today ? "hoje" : fullDate(r.localDate).slice(0, 5);
  const labels = [...new Set(r.missingFields.map((m) => fieldLabel(m.field)))];
  const noun = r.missingFields.length === 1 ? "campo obrigatório" : "campos obrigatórios";
  const bannerText = r.missingFields.length > 0 ? `Faltam ${r.missingFields.length} ${noun}: ${joinList(labels)}. Nada é salvo antes da sua aprovação.` : "Tudo preenchido. Nada é salvo antes da sua aprovação.";

  async function patch(body: Schemas["UpdateReportRequest"]) {
    setError(null);
    try {
      setReport(await unwrap(api.PATCH("/v1/reports/{reportId}", { params: { path: { reportId: id }, ...tz }, body })));
    } catch (e) {
      setError(e instanceof ApiError ? e : new ApiError("UNAVAILABLE"));
    }
  }
  function setReview(openItemId: string, outcome: string, note: string | null) {
    const others = r.openItemReviews.filter((x) => x.openItemId !== openItemId);
    return patch({ openItemReviews: outcome ? [...others, { openItemId, outcome: outcome as "close" | "keep" | "update", note }] : others });
  }
  function approvalKey() {
    const name = `argos:approval-key:${id}`;
    const key = approvalKeys.current[id] ?? readSession(name) ?? crypto.randomUUID();
    approvalKeys.current[id] = key;
    writeSession(name, key);
    return key;
  }
  function forgetApprovalKey() {
    delete approvalKeys.current[id];
    writeSession(`argos:approval-key:${id}`, null);
  }
  async function approve() {
    setBusy(true);
    setError(null);
    try {
      await unwrap(api.POST("/v1/reports/{reportId}/approve", { params: { path: { reportId: id }, header: { ...tz.header, "Idempotency-Key": approvalKey() } } }));
      forgetApprovalKey();
      return router.push(`/rdo/aprovado?id=${id}`);
    } catch (e) {
      const err = e instanceof ApiError ? e : new ApiError("UNAVAILABLE");
      if (err.code === "REPORT_INCOMPLETE" && err.errors.some((x) => x.field.endsWith(".safety"))) return router.push(`/rdo/seguranca?id=${id}`);
      setError(err);
    }
    setBusy(false);
  }
  async function answerQuestion(questionId: string, body: Schemas["AnswerQuestionRequest"]) {
    setError(null);
    try {
      await unwrap(api.POST("/v1/questions/{questionId}/answer", { params: { path: { questionId }, ...tz }, body }));
      setReport(await unwrap(api.GET("/v1/reports/{reportId}", { params: { path: { reportId: id }, ...tz } })));
    } catch (e) {
      setError(e instanceof ApiError ? e : new ApiError("UNAVAILABLE"));
    }
  }
  async function loadServices() {
    if (!services) setServices((await unwrap(api.GET("/v1/sites/{siteId}/services", { params: { path: { siteId: r.siteId }, ...tz } }))).items);
  }
  function mic(section: string, label: string) {
    return <MicButton label={label} active={voice.recording && voice.section === section} disabled={busyAi || !online} onClick={() => void voice.toggle(section)} />;
  }
  const w = r.workday;
  const setWorkday = (key: "startTime" | "endTime", value: string) => patch({ workday: { ...w, [key]: value || null } });
  const setWeather = (index: number, change: Partial<Report["weather"][number]>) => patch({ weather: r.weather.map((y, j) => (j === index ? { ...y, ...change } : y)) });
  const setLabor = (index: number, change: Partial<Report["labor"][number]>) => patch({ labor: r.labor.map((y, j) => (j === index ? { ...y, ...change } : y)) });
  const thirdParty = r.labor.filter((l) => l.employment === "third_party" && l.company);
  const shiftName = (shift: string) => (shift === "morning" ? "manhã" : "tarde");

  return (
    <Page>
      <div className="flex items-center gap-3 px-5 pb-3 pt-5">
        <Back href={`/dia?id=${r.siteId}&date=${r.localDate}`} label="Voltar para o RDO de hoje" />
        <div className="flex flex-col gap-0.5">
          <Title>Revise o RDO</Title>
          <span className="text-[13px] text-[#5B5F6B]">Montado a partir {r.entriesCount === 1 ? "do 1 registro" : `dos ${r.entriesCount} registros`} de {dayWord}</span>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-3 px-4 pb-4 pt-1">
        {!online && <div role="status" className="rounded-xl bg-[#FFE9C7] p-3 text-sm text-[#6B3A00]">Sem internet: dá para ler o último RDO carregado, mas editar, corrigir falando e aprovar precisam de internet.</div>}
        {busyAi && <div role="status" className="rounded-xl bg-[#E3ECFF] p-3 text-sm text-[#0B3699]">O Argos está montando o RDO com o que você falou. Isso leva alguns segundos…</div>}
        {error && <div role="alert" className="rounded-xl bg-[#FFE9C7] p-3 text-sm text-[#6B3A00]">{errorMessage(error.code)}{error.errors.length > 0 && ` (${error.errors.map((e) => e.field).join(", ")})`}</div>}
        {!approved && (
          <div className="flex items-start gap-2.5 rounded-xl bg-[#EFE3FA] px-3.5 py-3">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5B2E86" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mt-px flex-none"><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16.5v.1" /></svg>
            <span className={hint}>{isPublic ? "Obra pública: mais campos são obrigatórios e ficam marcados abaixo. " : ""}{bannerText}</span>
          </div>
        )}
        {!approved && r.missingFields.some((m) => m.field.endsWith(".safety")) && (
          <Link href={`/rdo/seguranca?id=${id}`} className="flex items-center gap-2.5 rounded-xl bg-[#EFE3FA] px-3.5 py-3 text-[13px] font-semibold text-[#4A2470]">Registro de segurança pendente: toque para preencher antes de aprovar →</Link>
        )}
        {!approved && !busyAi && listed.length > 0 && (
          <Bloco id="b-perguntas" title="O Argos perguntou" accent>
            {listed.slice(0, showAll ? undefined : 3).map((q) => (
              <div key={q.id} className="flex flex-col gap-2 border-b border-[#E3E5EE] pb-3 last:border-b-0 last:pb-0">
                <span className="text-[15px] leading-[1.4]">{q.text}</span>
                <div className="flex flex-wrap gap-2">
                  {q.options.map((o) => <button key={o.id} type="button" className="min-h-11 rounded-full border border-[#DDE0EA] bg-[#F4F5F9] px-3.5 text-[13px] font-medium" onClick={() => void answerQuestion(q.id, { optionId: o.id })}>{o.label}</button>)}
                  {q.options.length === 0 && q.kind !== "safety" && !isStructured(q.field) && <QuestionText onSend={(text) => void answerQuestion(q.id, { text })} />}
                  {q.options.length === 0 && q.kind !== "safety" && isStructured(q.field) && <FieldShortcut field={q.field ?? ""} />}
                  {q.kind === "safety" && <Link href={`/rdo/seguranca?id=${id}`} className="min-h-11 rounded-full bg-[#E3ECFF] px-3.5 py-3 text-[13px] font-semibold text-[#0B3699]">Registrar segurança</Link>}
                </div>
              </div>
            ))}
            {!showAll && listed.length > 3 && (
              <button type="button" onClick={() => setShowAll(true)} className="min-h-11 text-left text-[13px] font-semibold text-[#1563FF]">Ver as outras {listed.length - 3} perguntas</button>
            )}
          </Bloco>
        )}

        <Bloco id="b-id" title="Identificação">
          <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
            <Info k="RDO" v={`Nº ${String(r.number).padStart(3, "0")} · ${fullDate(r.localDate)}`} /><Info k="Obra" v={r.site.name} />
            <Info k="Tipo" v={siteTypeLabel[r.site.type]} /><Info k="Responsável" v={`${r.site.technicalManager.name} · ART ${r.site.technicalManager.artNumber}`} />
            <Info wide k="Endereço" v={r.site.address} />
            <Info wide k="Contratante" v={`${r.site.client.name} · CNPJ ${r.site.client.taxId}`} />
            <Info wide k="Contratada" v={`${r.site.contractor.name} · CNPJ ${r.site.contractor.taxId}`} />
          </div>
          {r.site.publicContract && (
            <Publico title="OBRIGATÓRIO EM OBRA PÚBLICA">
              <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
                <Info k="Contrato" v={`Nº ${r.site.publicContract.number}`} /><Info k="Empenho" v={r.site.publicContract.commitmentOrAgreement} />
                <Info k="Fiscal do contrato" v={r.site.publicContract.inspectorName} /><Info k="Ordem de serviço" v={fullDate(r.site.publicContract.serviceOrderDate)} />
                <Info k="Prazo" v={`${r.site.publicContract.durationDays} dias · ${r.site.publicContract.amendments.length === 0 ? "sem aditivos" : `${r.site.publicContract.amendments.length} aditivo(s)`}`} />
                <Info k="Decorrido" v={`${r.site.publicContract.elapsedDays} dias · faltam ${r.site.publicContract.remainingDays}`} />
              </div>
            </Publico>
          )}
          <span className={rotulo}>Vem do cadastro da obra.{isPublic ? " Decorrido e a vencer são calculados." : ""}</span>
        </Bloco>

        <Bloco id="b-clima" title="Jornada e clima" mic={mic("workday", "Corrigir jornada e clima por voz")}>
          <div className="grid grid-cols-3 gap-2.5">
            <div className="flex min-w-0 flex-col gap-1"><label htmlFor="entrada" className={rotulo}>Entrada</label>
              <input id="entrada" type="time" disabled={lockUi} className={`${field} ${w.startTime ? "" : missingField}`} value={w.startTime ?? ""} onChange={(e) => void setWorkday("startTime", e.target.value)} /></div>
            <div className="flex min-w-0 flex-col gap-1"><label htmlFor="saida" className={rotulo}>Saída</label>
              <input id="saida" type="time" disabled={lockUi} className={`${field} ${w.endTime ? "" : missingField}`} value={w.endTime ?? ""} onChange={(e) => void setWorkday("endTime", e.target.value)} /></div>
            <div className="flex min-w-0 flex-col gap-1"><label htmlFor="intervalo" className={rotulo}>Intervalo (min)</label>
              <input id="intervalo" type="number" disabled={lockUi} className={`${field} ${w.breakMinutes === null ? missingField : ""}`} value={w.breakMinutes ?? ""} onChange={(e) => void patch({ workday: { ...w, breakMinutes: e.target.value === "" ? null : Number(e.target.value) } })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {r.weather.flatMap((x, i) => [
              <div key={`${x.shift}-w`} className="flex min-w-0 flex-col gap-1"><label htmlFor={`tempo-${x.shift}`} className={rotulo}>Tempo · {shiftName(x.shift)}</label>
                <select id={`tempo-${x.shift}`} disabled={lockUi} className={`${field} ${x.weather ? "" : missingField}`} value={x.weather ?? ""} onChange={(e) => void setWeather(i, { weather: (e.target.value || null) as typeof x.weather })}>
                  <option value="">Escolher</option>{Object.entries(weatherLabel).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>,
              <div key={`${x.shift}-c`} className="flex min-w-0 flex-col gap-1"><label htmlFor={`cond-${x.shift}`} className={rotulo}>Condição · {shiftName(x.shift)}</label>
                <select id={`cond-${x.shift}`} disabled={lockUi} className={`${field} ${x.condition ? "" : missingField}`} value={x.condition ?? ""} onChange={(e) => void setWeather(i, { condition: (e.target.value || null) as typeof x.condition })}>
                  <option value="">Escolher</option>{Object.entries(conditionLabel).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>,
            ])}
          </div>
          {inlineHint((f) => f.startsWith("weather.")).map((q) => <span key={q.id} className={hint}>{q.text}</span>)}
          {isPublic && (
            <Publico title="OBRIGATÓRIO EM OBRA PÚBLICA">
              <div className="flex min-w-0 flex-col gap-1"><label htmlFor="horas-paradas" className={rotulo}>Horas paradas por clima</label>
                <input id="horas-paradas" type="number" step="0.5" disabled={lockUi} className={`${field} ${r.weatherStoppage ? "" : missingField}`} value={r.weatherStoppage?.hours ?? ""}
                  onChange={(e) => void patch({ weatherStoppage: e.target.value === "" ? null : { hours: Number(e.target.value), serviceIds: r.weatherStoppage?.serviceIds ?? [] } })} /></div>
              <ServicePicker label="Serviços afetados" services={services} loadServices={() => void loadServices()} disabled={lockUi} value={r.weatherStoppage?.serviceIds ?? []}
                onChange={(ids) => void patch({ weatherStoppage: { hours: r.weatherStoppage?.hours ?? 0, serviceIds: ids } })} />
            </Publico>
          )}
        </Bloco>

        <Bloco id="b-efetivo" title="Efetivo" mic={mic("labor", "Corrigir o efetivo por voz")}>
          {r.labor.length > 0 && (
            <div className="grid grid-cols-[minmax(0,1fr)_64px_112px] items-center gap-x-2.5 gap-y-2">
              {r.labor.flatMap((l, i) => [
                <label key={`${i}-n`} htmlFor={`q-${i}`} className="text-[15px]">{l.role}</label>,
                <input key={`${i}-q`} id={`q-${i}`} type="number" disabled={lockUi} className={`${field} text-center`} value={l.count} onChange={(e) => void setLabor(i, { count: Number(e.target.value) })} />,
                <select key={`${i}-e`} aria-label={`Vínculo de ${l.role}`} disabled={lockUi} className={field} value={l.employment ?? ""} onChange={(e) => void setLabor(i, { employment: e.target.value as "own" | "third_party" })}>
                  <option value="">Vínculo</option><option value="own">Próprio</option><option value="third_party">Terceiro</option></select>,
              ])}
            </div>
          )}
          {thirdParty.length > 0 && <span className={rotulo}>Terceirizados: {thirdParty.map((l) => `${l.role} (${l.company})`).join(" · ")}</span>}
          {!approved && <LaborAdd onAdd={(l) => void patch({ labor: [...r.labor, l] })} />}
          {missing.has("labor") && <span className={hint}>Informe ao menos uma função.</span>}
        </Bloco>

        <Bloco id="b-equip" title="Equipamentos" mic={mic("equipment", "Corrigir os equipamentos por voz")}>
          {isPublic ? (
            <Publico title="OBRIGATÓRIO EM OBRA PÚBLICA">
              <span className={rotulo}>Do cadastro da obra. Aqui vai só a situação do dia.</span>
              <EquipmentList r={r} lock={lockUi} patch={patch} showId />
            </Publico>
          ) : (
            <>
              <EquipmentList r={r} lock={lockUi} patch={patch} showId={false} />
              <span className={rotulo}>Do cadastro da obra. Aqui vai só a situação do dia.</span>
            </>
          )}
        </Bloco>

        <Bloco id="b-ativ" title="Atividades" mic={mic("activities", "Corrigir as atividades por voz")}>
          <div>
            {r.activities.map((a, i) => (
              <Item key={a.id}>
                <span className="text-[15px]">{a.description}</span>
                <span className={rotulo}>{[a.location, statusLabel[a.status]].filter(Boolean).join(" · ")}</span>
                <div className="mt-1.5 flex min-w-0 flex-col gap-1"><label htmlFor={`srv-${i}`} className={rotulo}>Serviço da planilha</label>
                  <select id={`srv-${i}`} disabled={lockUi} className={`${field} ${a.service ? "" : missingField}`} value={a.service?.id ?? ""} onFocus={() => void loadServices()}
                    onChange={(e) => { const chosen = services?.find((sv) => sv.id === e.target.value); if (chosen) void patch({ activities: r.activities.map((y, j) => (j === i ? { ...y, service: chosen, unit: y.unit ?? chosen.unit } : y)) }); }}>
                    {!a.service && <option value="">Escolher serviço</option>}
                    {a.service && !services && <option value={a.service.id}>{a.service.code} · {a.service.description}</option>}
                    {(services ?? []).map((sv) => <option key={sv.id} value={sv.id}>{sv.code} · {sv.description}</option>)}
                  </select></div>
                {isPublic && (
                  <div className="mt-1.5 grid grid-cols-[minmax(0,1fr)_104px] items-center gap-2.5">
                    <label htmlFor={`qt-${i}`} className={rotulo}>Quantidade no dia{(a.unit ?? a.service?.unit) ? ` (${a.unit ?? a.service?.unit})` : ""}</label>
                    <input id={`qt-${i}`} type="number" disabled={lockUi} className={`${field} ${a.quantity === null ? missingField : ""}`} value={a.quantity ?? ""}
                      onChange={(e) => void patch({ activities: r.activities.map((y, j) => (j === i ? { ...y, quantity: e.target.value === "" ? null : Number(e.target.value), unit: y.unit ?? y.service?.unit ?? null } : y)) })} />
                  </div>
                )}
              </Item>
            ))}
          </div>
          {inlineHint((f) => /^activities\.\d+\.service$/.test(f)).map((q) => <span key={q.id} className={hint}>{q.text}</span>)}
          {!approved && <ActivityAdd services={services} loadServices={() => void loadServices()} onAdd={(a) => void patch({ activities: [...r.activities, a] })} />}
          {missing.has("activities") && <span className={hint}>Informe ao menos uma atividade.</span>}
        </Bloco>

        <Bloco id="b-ocor" title="Ocorrências" mic={mic("occurrences", "Corrigir as ocorrências por voz")}>
          <div>
            {r.occurrences.map((o) => (
              <Item key={o.id}>
                <span className="text-[15px]">{o.description}</span>
                <span className={rotulo}>{occurrenceLabel[o.type]} · {o.startTime ?? "sem hora"}{o.endTime ? ` às ${o.endTime}` : ""} · {o.status === "closed" ? "encerrada" : "aberta"}</span>
                {isPublic && <span className={rotulo}>Serviços afetados: {o.affectedServiceIds.length}{o.source ? ` · Origem: ${o.source.origin}${o.source.document ? ` · Documento: ${o.source.document}` : ""}` : ""}</span>}
                {o.type === "accident" && !approved && <Link href={`/rdo/seguranca?id=${id}&occ=${o.id}`} className="py-1 text-[13px] font-semibold text-[#1563FF]">{o.safety ? "Editar segurança" : "Registrar segurança"}</Link>}
              </Item>
            ))}
          </div>
          {!approved && <OccurrenceAdd isPublic={isPublic} services={services} loadServices={() => void loadServices()} onAdd={(o) => void patch({ occurrences: [...r.occurrences, o] })} />}
          {missing.has("occurrences") && <span className={hint}>Complete as ocorrências (horário, serviços afetados, fonte).</span>}
        </Bloco>

        <Bloco id="b-pend" title="Itens em aberto" accent>
          <span className={rotulo}>{openList.length === 0 && r.newOpenItems.length > 0 ? "Nenhum item de dias anteriores nesta obra. Estes nascem hoje:" : openList.length === 0 ? "Nenhum item de dias anteriores nesta obra." : "Vão para amanhã do jeito que você confirmar aqui."}</span>
          <div className="flex flex-col gap-3">
            {openList.map((i) => {
              const review = r.openItemReviews.find((x) => x.openItemId === i.id);
              return (
                <div key={i.id} className="flex min-w-0 flex-col gap-1">
                  <div className="flex items-baseline justify-between gap-2"><label htmlFor={`p-${i.id}`} className="text-[15px]">{i.title}</label><span className={`flex-none rounded-full px-2 py-[3px] text-xs font-semibold ${agePill(i.openedOn, r.localDate, HIGHLIGHT_DAYS)}`}>{ageLabel(i.openedOn, r.localDate)}</span></div>
                  <select id={`p-${i.id}`} disabled={lockUi} className={field} value={review?.outcome ?? ""} onChange={(e) => void setReview(i.id, e.target.value, review?.note ?? null)}>
                    <option value="">Escolher desfecho</option><option value="close">Fechar</option><option value="keep">Manter</option><option value="update">Atualizar</option>
                  </select>
                  {review && review.outcome !== "keep" && (
                    <input aria-label="Observação do item" placeholder={review.outcome === "close" ? "Como foi resolvido (opcional)" : "O que mudou"} disabled={lockUi} defaultValue={review.note ?? ""} className={field}
                      onBlur={(e) => e.target.value !== (review.note ?? "") && void setReview(i.id, review.outcome, e.target.value || null)} />
                  )}
                </div>
              );
            })}
            {r.newOpenItems.map((n, idx) => (
              <div key={n.id} className="flex min-w-0 flex-col gap-1">
                <div className="flex items-baseline justify-between gap-2"><label htmlFor={`n-${n.id}`} className="text-[15px]">{n.title}</label><span className="flex-none rounded-full bg-[#E3ECFF] px-2 py-[3px] text-xs font-semibold text-[#0B3699]">novo</span></div>
                <select id={`n-${n.id}`} disabled={lockUi} className={field} value={n.track ? "yes" : "no"} onChange={(e) => void patch({ newOpenItems: r.newOpenItems.map((y, j) => (j === idx ? { ...y, track: e.target.value === "yes" } : y)) })}>
                  <option value="yes">Abrir item</option><option value="no">Não acompanhar</option>
                </select>
              </div>
            ))}
          </div>
        </Bloco>

        <Bloco id="b-fotos" title={`Fotos · ${r.photos.length} de 20`}>
          <span className={`-mt-2 ${rotulo}`}>{isPublic ? "Em obra pública, uma foto por atividade e por ocorrência. " : ""}Cada foto guarda data, hora e local.</span>
          <div className="grid grid-cols-2 gap-2">
            {r.photos.map((p) => (
              <div key={p.id} className="flex min-w-0 flex-col gap-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={p.caption ?? "Foto do RDO"} className="h-[76px] w-full rounded-[10px] bg-[#DCDFE8] object-cover" />
                {lockUi ? (
                  <span className={rotulo}>{clock(p.capturedAt)}{p.caption ? ` · ${p.caption}` : ""}</span>
                ) : (
                  <>
                    <span className={rotulo}>{clock(p.capturedAt)}</span>
                    <input aria-label="Legenda da foto" placeholder="Legenda" defaultValue={p.caption ?? ""} className={field} onBlur={(e) => e.target.value !== (p.caption ?? "") && void patch({ photos: [{ id: p.id, caption: e.target.value || null }] })} />
                    {(isPublic || r.photoRequirements.length > 0) && (
                      <select aria-label="Foto de qual atividade ou ocorrência" className={field} value={p.linkedTo ? `${p.linkedTo.type}:${p.linkedTo.id}` : ""}
                        onChange={(e) => { const [type, ...rest] = e.target.value.split(":"); void patch({ photos: [{ id: p.id, linkedTo: e.target.value ? { type: type as "activity" | "occurrence", id: rest.join(":") } : null }] }); }}>
                        <option value="">Vincular a…</option>
                        {r.activities.map((a) => <option key={a.id} value={`activity:${a.id}`}>Atividade: {a.description}</option>)}
                        {r.occurrences.map((o) => <option key={o.id} value={`occurrence:${o.id}`}>Ocorrência: {o.description}</option>)}
                      </select>
                    )}
                  </>
                )}
              </div>
            ))}
            {!approved && r.photoRequirements.map((q) => (
              <div key={`${q.linkedTo.type}:${q.linkedTo.id}`} className="flex min-w-0 flex-col gap-1">
                <Link href={`/registro?id=${r.siteId}`} className="box-border flex h-[76px] items-center justify-center rounded-[10px] border-[1.5px] border-dashed border-[#A673D6] bg-[#F7F0FD] text-[13px] font-semibold text-[#4A2470]">Adicionar foto</Link>
                <span className="text-[13px] text-[#4A2470]">Falta: {q.label}</span>
              </div>
            ))}
          </div>
          {missing.has("photos") && <span className={hint}>É preciso ao menos 3 fotos no dia. Tire mais fotos num novo registro e gere o RDO de novo.</span>}
        </Bloco>

        <Bloco id="b-valid" title="Validação">
          <div className="grid grid-cols-2 gap-x-3 gap-y-2.5"><Info k="Status" v="Rascunho" /><Info k="Aprovação" v={r.site.technicalManager.name} /></div>
          <span className={rotulo}>Data e hora entram quando você aprovar.</span>
          {isPublic && (
            <Publico title="HISTÓRICO DE ALTERAÇÕES · OBRIGATÓRIO EM OBRA PÚBLICA">
              <div>
                {r.history.map((h, i) => (
                  <Item key={i}><span className="text-[15px]">{h.actor === "agent" ? "Argos" : "Você"}: {h.description}</span><span className={rotulo}>{fullDate(h.at.slice(0, 10)).slice(0, 5)} · {clock(h.at)}</span></Item>
                ))}
              </div>
            </Publico>
          )}
        </Bloco>
      </div>
      {!approved && (
        <div className="sticky bottom-0 z-10 flex gap-2.5 border-t border-[#E3E5EE] bg-white px-4 pb-[22px] pt-3">
          <button type="button" disabled={busyAi || !online} onClick={() => void voice.toggle(null)} className={`box-border flex min-h-[52px] flex-1 items-center justify-center gap-1.5 rounded-[14px] border-[1.5px] border-[#2D2D2B] text-[15px] font-semibold text-[#2D2D2B] disabled:opacity-50 ${voice.recording && voice.section === null ? "bg-[#CCA6ED]" : ""}`}>
            <MicIcon color="#2D2D2B" />{voice.recording && voice.section === null ? "Parar e corrigir" : "Corrigir falando"}
          </button>
          <button type="button" disabled={!online || busy || busyAi || r.missingFields.length > 0} onClick={() => void approve()} className="flex min-h-[52px] flex-[1.3] items-center justify-center rounded-[14px] bg-[#1563FF] text-[15px] font-semibold text-white disabled:bg-[#DDE0EA] disabled:text-[#5B5F6B]">
            {busy ? "Aprovando…" : "Aprovar RDO"}
          </button>
        </div>
      )}
    </Page>
  );
}

function EquipmentList({ r, lock, patch, showId }: { r: Report; lock: boolean; patch: (body: Schemas["UpdateReportRequest"]) => Promise<void>; showId: boolean }) {
  if (r.equipment.length === 0) return <span className={rotulo}>Nenhum cadastrado na obra.</span>;
  return (
    <div>
      {r.equipment.map((e, i) => (
        <Item key={e.equipmentId}>
          <span className="text-[15px]">{e.name}</span>
          {showId && e.identifier && <span className={rotulo}>{e.identifier}</span>}
          <div className="mt-1.5 flex min-w-0 flex-col gap-1"><label htmlFor={`eq-${i}`} className={rotulo}>Situação</label>
            <select id={`eq-${i}`} disabled={lock} className={`${field} ${e.status ? "" : missingField}`} value={e.status ?? ""} onChange={(ev) => void patch({ equipment: r.equipment.map((y, j) => (j === i ? { ...y, status: (ev.target.value || null) as typeof e.status } : y)) })}>
              <option value="">Escolher</option><option value="operating">Operando</option><option value="stopped">Parado</option><option value="under_maintenance">Em manutenção</option></select></div>
        </Item>
      ))}
    </div>
  );
}

function LaborAdd({ onAdd }: { onAdd: (l: Report["labor"][number]) => void }) {
  const [role, setRole] = useState("");
  const [count, setCount] = useState("");
  const [third, setThird] = useState(false);
  const [company, setCompany] = useState("");
  return (
    <div className="flex flex-col gap-2 border-t border-[#E3E5EE] pt-2">
      <div className="grid grid-cols-[1fr_80px] gap-2"><input id="add-labor" aria-label="Função" placeholder="Função" className={field} value={role} onChange={(e) => setRole(e.target.value)} />
        <input aria-label="Quantidade" type="number" placeholder="Qtd" className={field} value={count} onChange={(e) => setCount(e.target.value)} /></div>
      <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={third} onChange={(e) => setThird(e.target.checked)} />Terceirizado</label>
      {third && <input aria-label="Empresa" placeholder="Empresa" className={field} value={company} onChange={(e) => setCompany(e.target.value)} />}
      <button type="button" disabled={!role || count === "" || (third && !company)} className="min-h-11 rounded-xl border-[1.5px] border-dashed border-[#9AA3B8] font-semibold text-[#0B3699] disabled:opacity-50"
        onClick={() => { onAdd({ role, count: Number(count), employment: third ? "third_party" : "own", company: third ? company : null, category: null }); setRole(""); setCount(""); setThird(false); setCompany(""); }}>Adicionar função</button>
    </div>
  );
}

function ActivityAdd({ services, loadServices, onAdd }: { services: Schemas["Service"][] | null; loadServices: () => void; onAdd: (a: Report["activities"][number]) => void }) {
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [status, setStatus] = useState<Report["activities"][number]["status"]>("in_progress");
  const service = services?.find((s) => s.id === serviceId) ?? null;
  return (
    <div className="flex flex-col gap-2 border-t border-[#E3E5EE] pt-2" onFocus={loadServices}>
      <input id="add-activity" aria-label="Descrição da atividade" placeholder="O que foi feito" className={field} value={description} onChange={(e) => setDescription(e.target.value)} />
      <input aria-label="Local" placeholder="Local (ex.: Bloco B)" className={field} value={location} onChange={(e) => setLocation(e.target.value)} />
      <select aria-label="Serviço da planilha" className={field} value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
        <option value="">Serviço da planilha</option>{services?.map((s) => <option key={s.id} value={s.id}>{s.code} {s.description}</option>)}</select>
      <select aria-label="Situação da atividade" className={field} value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
        {Object.entries(statusLabel).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
      <button type="button" disabled={!description || !service} className="min-h-11 rounded-xl border-[1.5px] border-dashed border-[#9AA3B8] font-semibold text-[#0B3699] disabled:opacity-50"
        onClick={() => { onAdd({ id: crypto.randomUUID(), description, service, location: location || null, status, quantity: null, unit: null, cumulativeProgressPercent: null, executor: null }); setDescription(""); setLocation(""); setServiceId(""); }}>Adicionar atividade</button>
    </div>
  );
}

function ServicePicker({ label, services, loadServices, value, onChange, disabled }: { label: string; services: Schemas["Service"][] | null; loadServices: () => void; value: string[]; onChange: (ids: string[]) => void; disabled?: boolean }) {
  return (
    <fieldset className="m-0 flex flex-col gap-1 border-0 p-0" onFocus={loadServices} onMouseEnter={loadServices}>
      <legend className="mb-1 text-[13px] text-[#5B5F6B]">{label}</legend>
      <div className="flex max-h-40 flex-col gap-1 overflow-y-auto">
        {(services ?? []).slice(0, 60).map((s) => (
          <label key={s.id} className="flex items-center gap-2 text-[13px]"><input type="checkbox" disabled={disabled} checked={value.includes(s.id)} onChange={(e) => onChange(e.target.checked ? [...value, s.id] : value.filter((x) => x !== s.id))} />{s.code} {s.description}</label>
        ))}
        {!services && <button type="button" onClick={loadServices} className="text-left text-[13px] text-[#1563FF]">Carregar serviços da planilha</button>}
      </div>
    </fieldset>
  );
}

function OccurrenceAdd({ isPublic, services, loadServices, onAdd }: { isPublic: boolean; services: Schemas["Service"][] | null; loadServices: () => void; onAdd: (o: Report["occurrences"][number]) => void }) {
  const [type, setType] = useState<Report["occurrences"][number]["type"]>("stoppage");
  const [description, setDescription] = useState("");
  const [startTime, setStart] = useState("");
  const [endTime, setEnd] = useState("");
  const [affected, setAffected] = useState<string[]>([]);
  const [origin, setOrigin] = useState("");
  const [document, setDocument] = useState("");
  return (
    <div className="flex flex-col gap-2 border-t border-[#E3E5EE] pt-2">
      <select id="add-occurrence" aria-label="Tipo da ocorrência" className={field} value={type} onChange={(e) => setType(e.target.value as typeof type)}>{Object.entries(occurrenceLabel).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
      <input aria-label="Descrição da ocorrência" placeholder="O que aconteceu" className={field} value={description} onChange={(e) => setDescription(e.target.value)} />
      <div className="grid grid-cols-2 gap-2"><input aria-label="Início" type="time" className={field} value={startTime} onChange={(e) => setStart(e.target.value)} /><input aria-label="Fim" type="time" className={field} value={endTime} onChange={(e) => setEnd(e.target.value)} /></div>
      {isPublic && (
        <>
          <ServicePicker label="Serviços afetados (obrigatório em obra pública)" services={services} loadServices={loadServices} value={affected} onChange={setAffected} />
          <input aria-label="Origem da ordem ou comunicação" placeholder="Origem (ex.: relato do engenheiro)" className={field} value={origin} onChange={(e) => setOrigin(e.target.value)} />
          <input aria-label="Documento" placeholder="Documento (ex.: e-mail do fiscal de 23/11)" className={field} value={document} onChange={(e) => setDocument(e.target.value)} />
        </>
      )}
      <button type="button" disabled={!description || !startTime} className="min-h-11 rounded-xl border-[1.5px] border-dashed border-[#9AA3B8] font-semibold text-[#0B3699] disabled:opacity-50"
        onClick={() => { onAdd({ id: crypto.randomUUID(), type, description, startTime, endTime: endTime || null, status: endTime ? "closed" : "open", affectedServiceIds: affected, source: origin ? { origin, document: document || null } : null, materials: null, safety: null }); setDescription(""); setStart(""); setEnd(""); setAffected([]); setOrigin(""); setDocument(""); }}>Adicionar ocorrência</button>
    </div>
  );
}

const shortcuts: Record<string, { label: string; target: string }> = {
  labor: { label: "Adicionar ao efetivo", target: "add-labor" },
  activities: { label: "Adicionar atividade", target: "add-activity" },
  occurrences: { label: "Adicionar ocorrência", target: "add-occurrence" },
  weatherStoppage: { label: "Preencher horas paradas", target: "horas-paradas" },
  workday: { label: "Preencher a jornada", target: "entrada" },
  weather: { label: "Preencher o clima", target: "tempo-morning" },
  equipment: { label: "Preencher os equipamentos", target: "eq-0" },
};

const isStructured = (field: string | null) => field !== null && !field.includes(".");

function FieldShortcut({ field }: { field: string }) {
  const shortcut = shortcuts[field] ?? { label: "Preencher no formulário", target: "b-id" };
  function go() {
    const target = document.getElementById(shortcut.target);
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
    target?.focus({ preventScroll: true });
  }
  return <button type="button" onClick={go} className="min-h-11 rounded-full bg-[#E3ECFF] px-3.5 text-[13px] font-semibold text-[#0B3699]">{shortcut.label}</button>;
}

function QuestionText({ onSend }: { onSend: (text: string) => void }) {
  const [text, setText] = useState("");
  return (
    <div className="flex w-full gap-2">
      <input aria-label="Sua resposta" className={field} value={text} onChange={(e) => setText(e.target.value)} placeholder="Sua resposta" />
      <button type="button" disabled={!text} onClick={() => { onSend(text); setText(""); }} className="min-h-11 rounded-xl bg-[#1563FF] px-4 text-[13px] font-semibold text-white disabled:opacity-50">Enviar</button>
    </div>
  );
}

