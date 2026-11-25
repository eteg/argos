"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import type { Schemas } from "@argos/contract";
import { api, timezoneParams } from "@/lib/api";
import { errorMessage, fullDate } from "@/lib/format";
import { ApiError, unwrap, useLoad } from "@/lib/hooks";
import { Back, Page, Pill, Primary, Status, Title, field } from "@/components/ui";

type Report = Schemas["Report"];
const tz = timezoneParams();
const weatherLabel = { good: "Bom", cloudy: "Nublado", light_rain: "Chuva fraca", heavy_rain: "Chuva forte" } as const;
const conditionLabel = { workable: "Praticável", partially_workable: "Parcialmente praticável", unworkable: "Impraticável" } as const;
const statusLabel = { started: "Iniciada", in_progress: "Em andamento", completed: "Concluída", stopped: "Parada" } as const;
const Block = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="flex flex-col gap-2.5 rounded-2xl bg-white p-3.5"><h2 className="m-0 text-[15px] font-semibold">{title}</h2>{children}</section>
);

export function ReportReview() {
  const id = useSearchParams().get("id") ?? "";
  const [state, retry] = useLoad(() => unwrap(api.GET("/v1/reports/{reportId}", { params: { path: { reportId: id }, ...tz } })), [id]);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const [services, setServices] = useState<Schemas["Service"][] | null>(null);
  const current = report ?? (state.status === "ok" ? state.data : null);
  if (!current) return <Page><Status state={state.status === "ok" ? { status: "loading" } : state} retry={retry} /></Page>;
  const r = current;
  const approved = r.status === "approved";

  async function patch(body: Schemas["UpdateReportRequest"]) {
    setError(null);
    try {
      setReport(await unwrap(api.PATCH("/v1/reports/{reportId}", { params: { path: { reportId: id }, ...tz }, body })));
    } catch (e) {
      setError(e instanceof ApiError ? e : new ApiError("UNAVAILABLE"));
    }
  }
  async function approve() {
    setBusy(true);
    setError(null);
    try {
      setReport(await unwrap(api.POST("/v1/reports/{reportId}/approve", { params: { path: { reportId: id }, header: { ...tz.header, "Idempotency-Key": crypto.randomUUID() } } })));
    } catch (e) {
      setError(e instanceof ApiError ? e : new ApiError("UNAVAILABLE"));
    }
    setBusy(false);
  }
  async function loadServices() {
    if (!services) setServices((await unwrap(api.GET("/v1/sites/{siteId}/services", { params: { path: { siteId: r.siteId }, ...tz } }))).items);
  }
  const miss = (prefix: string) => r.missingFields.some((m) => m.field.startsWith(prefix));
  const w = r.workday;
  const wd = (k: "startTime" | "endTime") => (
    <input aria-label={k === "startTime" ? "Início da jornada" : "Fim da jornada"} type="time" disabled={approved} className={field} value={w.startTime && k === "startTime" ? w.startTime : w.endTime && k === "endTime" ? w.endTime : ""}
      onChange={(e) => void patch({ workday: { ...w, [k]: e.target.value || null } })} />
  );

  return (
    <Page>
      <div className="flex items-center gap-3 px-5 pb-3 pt-5"><Back href={`/obra?id=${r.siteId}`} /><Title>{approved ? "RDO aprovado" : "Revise o RDO"}</Title></div>
      <div className="flex flex-col gap-3 px-4 pb-8">
        <div className="flex items-center gap-2 px-1"><Pill tone={approved ? "blue" : "purple"}>{approved ? "Aprovado" : "Rascunho"}</Pill><span className="text-[13px] text-[#5B5F6B]">Nº {String(r.number).padStart(3, "0")} · {fullDate(r.localDate)} · {r.entriesCount} registros</span></div>
        {!approved && r.missingFields.length > 0 && <div role="alert" className="rounded-xl bg-[#FFE9C7] p-3 text-sm text-[#6B3A00]">Faltam {r.missingFields.length} campos obrigatórios: {r.missingFields.map((m) => m.field).join(", ")}</div>}
        {approved && r.approval && <div className="rounded-xl bg-[#E3ECFF] p-3 text-sm text-[#0B3699]">Aprovado por {r.approval.approvedBy} em {new Date(r.approval.approvedAt).toLocaleString("pt-BR")} e salvo na obra.</div>}
        {error && <div role="alert" className="rounded-xl bg-[#FFE9C7] p-3 text-sm text-[#6B3A00]">{errorMessage(error.code)}{error.errors.length > 0 && ` (${error.errors.map((e) => e.field).join(", ")})`}</div>}
        <Block title="Obra"><span className="text-[15px]">{r.site.name}</span><span className="text-[13px] text-[#5B5F6B]">{r.site.address} · {r.site.technicalManager.name} · ART {r.site.technicalManager.artNumber}</span></Block>
        <Block title="Jornada">
          <div className="grid grid-cols-3 gap-2">{wd("startTime")}{wd("endTime")}
            <input aria-label="Intervalo em minutos" type="number" placeholder="Intervalo (min)" disabled={approved} className={field} value={w.breakMinutes ?? ""} onChange={(e) => void patch({ workday: { ...w, breakMinutes: e.target.value === "" ? null : Number(e.target.value) } })} /></div>
          {miss("workday") && <span className="text-xs text-[#6B3A00]">Preencha a jornada.</span>}
        </Block>
        <Block title="Clima">
          {r.weather.map((x, i) => (
            <div key={x.shift} className="grid grid-cols-[72px_1fr_1fr] items-center gap-2"><span className="text-[13px]">{x.shift === "morning" ? "Manhã" : "Tarde"}</span>
              <select aria-label={`Tempo ${x.shift}`} disabled={approved} className={field} value={x.weather ?? ""} onChange={(e) => void patch({ weather: r.weather.map((y, j) => (j === i ? { ...y, weather: (e.target.value || null) as typeof x.weather } : y)) })}>
                <option value="">Tempo</option>{Object.entries(weatherLabel).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
              <select aria-label={`Condição ${x.shift}`} disabled={approved} className={field} value={x.condition ?? ""} onChange={(e) => void patch({ weather: r.weather.map((y, j) => (j === i ? { ...y, condition: (e.target.value || null) as typeof x.condition } : y)) })}>
                <option value="">Condição</option>{Object.entries(conditionLabel).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
          ))}
        </Block>
        <Block title="Efetivo">
          {r.labor.map((l, i) => <div key={i} className="flex items-center gap-2 text-[15px]">{l.role} · {l.count} · {l.employment === "own" ? "Próprio" : `Terceiro${l.company ? ` (${l.company})` : ""}`}</div>)}
          {!approved && <LaborAdd onAdd={(l) => void patch({ labor: [...r.labor, l] })} />}
          {miss("labor") && <span className="text-xs text-[#6B3A00]">Informe ao menos uma função.</span>}
        </Block>
        <Block title="Equipamentos">
          {r.equipment.length === 0 && <span className="text-[13px] text-[#5B5F6B]">Nenhum cadastrado na obra.</span>}
          {r.equipment.map((e, i) => (
            <div key={e.equipmentId} className="flex items-center justify-between gap-2 text-[15px]">{e.name}
              <select aria-label={`Situação de ${e.name}`} disabled={approved} className={`${field} !w-40`} value={e.status ?? ""} onChange={(ev) => void patch({ equipment: r.equipment.map((y, j) => (j === i ? { ...y, status: (ev.target.value || null) as typeof e.status } : y)) })}>
                <option value="">Situação</option><option value="operating">Operando</option><option value="stopped">Parado</option><option value="under_maintenance">Em manutenção</option></select></div>
          ))}
        </Block>
        <Block title="Atividades">
          {r.activities.map((a) => <div key={a.id} className="text-[15px]">{a.description} · {a.location ?? "sem local"} · {statusLabel[a.status]}<br /><span className="text-[13px] text-[#5B5F6B]">{a.service ? `${a.service.code} ${a.service.description}` : "Sem serviço da planilha"}</span></div>)}
          {!approved && <ActivityAdd services={services} loadServices={() => void loadServices()} onAdd={(a) => void patch({ activities: [...r.activities, a] })} />}
          {miss("activities") && <span className="text-xs text-[#6B3A00]">Informe ao menos uma atividade.</span>}
        </Block>
        <Block title={`Fotos · ${r.photos.length} de 20`}>
          <div className="flex flex-wrap gap-2">{r.photos.map((p) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={p.id} src={p.url} alt={p.caption ?? "Foto do RDO"} className="size-20 rounded-lg object-cover" />))}</div>
          {miss("photos") && <span className="text-xs text-[#6B3A00]">É preciso ao menos 3 fotos no dia.</span>}
        </Block>
        <Block title="Histórico">{r.history.map((h, i) => <span key={i} className="text-[13px] text-[#5B5F6B]">{new Date(h.at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} · {h.actor === "agent" ? "Argos" : "Você"}: {h.description}</span>)}</Block>
        {!approved && <Primary disabled={busy || r.missingFields.length > 0} onClick={() => void approve()}>{busy ? "Aprovando…" : "Aprovar RDO"}</Primary>}
      </div>
    </Page>
  );
}

function LaborAdd({ onAdd }: { onAdd: (l: Report["labor"][number]) => void }) {
  const [role, setRole] = useState("");
  const [count, setCount] = useState("");
  const [third, setThird] = useState(false);
  const [company, setCompany] = useState("");
  return (
    <div className="flex flex-col gap-2 border-t border-[#E3E5EE] pt-2">
      <div className="grid grid-cols-[1fr_80px] gap-2"><input aria-label="Função" placeholder="Função" className={field} value={role} onChange={(e) => setRole(e.target.value)} />
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
      <input aria-label="Descrição da atividade" placeholder="O que foi feito" className={field} value={description} onChange={(e) => setDescription(e.target.value)} />
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
