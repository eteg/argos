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
const occurrenceLabel = { stoppage: "Paralisação", accident: "Acidente", material_shortage: "Falta de material", equipment_failure: "Falha de equipamento", inspection_order: "Ordem da fiscalização", visit: "Visita", external_interference: "Interferência externa", other: "Outra" } as const;
const Info = ({ k, v, wide }: { k: string; v: string; wide?: boolean }) => (
  <div className={`flex min-w-0 flex-col gap-1 ${wide ? "col-span-2" : ""}`}><span className="text-[13px] text-[#5B5F6B]">{k}</span><span className="text-[15px]">{v}</span></div>
);
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
  const isPublic = r.site.type !== "private";

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
        {isPublic && !approved && <div className="rounded-xl bg-[#EFE3FA] p-3 text-[13px] leading-[1.45] text-[#4A2470]">Obra pública: mais campos são obrigatórios e ficam marcados abaixo.{r.missingFields.length > 0 && ` Faltam ${r.missingFields.length}.`}</div>}
        <Block title="Identificação">
          <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
            <Info k="RDO" v={`Nº ${String(r.number).padStart(3, "0")} · ${fullDate(r.localDate)}`} /><Info k="Obra" v={r.site.name} />
            <Info k="Tipo" v={{ private: "Privada", public: "Pública", financed: "Financiada" }[r.site.type]} /><Info k="Responsável" v={`${r.site.technicalManager.name} · ART ${r.site.technicalManager.artNumber}`} />
            <Info wide k="Endereço" v={r.site.address} /><Info wide k="Contratante" v={`${r.site.client.name} · CNPJ ${r.site.client.taxId}`} /><Info wide k="Contratada" v={`${r.site.contractor.name} · CNPJ ${r.site.contractor.taxId}`} />
          </div>
          {r.site.publicContract && (
            <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 border-t border-dashed border-[#CDD1DD] pt-3">
              <span className="col-span-2 text-xs font-semibold tracking-wide text-[#5B5F6B]">OBRIGATÓRIO EM OBRA PÚBLICA</span>
              <Info k="Contrato" v={`Nº ${r.site.publicContract.number}`} /><Info k="Empenho" v={r.site.publicContract.commitmentOrAgreement} />
              <Info k="Fiscal do contrato" v={r.site.publicContract.inspectorName} /><Info k="Ordem de serviço" v={fullDate(r.site.publicContract.serviceOrderDate)} />
              <Info k="Prazo" v={`${r.site.publicContract.durationDays} dias · ${r.site.publicContract.amendments.length === 0 ? "sem aditivos" : `${r.site.publicContract.amendments.length} aditivo(s)`}`} />
              <Info k="Decorrido" v={`${r.site.publicContract.elapsedDays} dias · faltam ${r.site.publicContract.remainingDays}`} />
            </div>
          )}
          <span className="text-[13px] text-[#5B5F6B]">Vem do cadastro da obra. Decorrido e a vencer são calculados.</span>
        </Block>
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
        {isPublic && (
          <Block title="Horas paradas por clima">
            <span className="text-xs font-semibold tracking-wide text-[#5B5F6B]">OBRIGATÓRIO EM OBRA PÚBLICA</span>
            <input aria-label="Horas paradas por clima" type="number" step="0.5" placeholder="Horas" disabled={approved} className={field} value={r.weatherStoppage?.hours ?? ""}
              onChange={(e) => void patch({ weatherStoppage: e.target.value === "" ? null : { hours: Number(e.target.value), serviceIds: r.weatherStoppage?.serviceIds ?? [] } })} />
            <ServicePicker label="Serviços afetados" services={services} loadServices={() => void loadServices()} disabled={approved} value={r.weatherStoppage?.serviceIds ?? []}
              onChange={(ids) => void patch({ weatherStoppage: { hours: r.weatherStoppage?.hours ?? 0, serviceIds: ids } })} />
            {miss("weatherStoppage") && <span className="text-xs text-[#6B3A00]">Informe as horas paradas (0 se não parou).</span>}
          </Block>
        )}
        <Block title="Efetivo">
          {r.labor.map((l, i) => <div key={i} className="flex items-center gap-2 text-[15px]">{l.role} · {l.count} · {l.employment === "own" ? "Próprio" : `Terceiro${l.company ? ` (${l.company})` : ""}`}</div>)}
          {!approved && <LaborAdd onAdd={(l) => void patch({ labor: [...r.labor, l] })} />}
          {miss("labor") && <span className="text-xs text-[#6B3A00]">Informe ao menos uma função.</span>}
        </Block>
        <Block title="Equipamentos">
          {isPublic && <span className="text-xs font-semibold tracking-wide text-[#5B5F6B]">OBRIGATÓRIO EM OBRA PÚBLICA · do cadastro da obra, aqui vai só a situação do dia</span>}
          {r.equipment.length === 0 && <span className="text-[13px] text-[#5B5F6B]">Nenhum cadastrado na obra.</span>}
          {r.equipment.map((e, i) => (
            <div key={e.equipmentId} className="flex items-center justify-between gap-2 text-[15px]"><span>{e.name}{isPublic && e.identifier && <span className="block text-[13px] text-[#5B5F6B]">{e.identifier}</span>}</span>
              <select aria-label={`Situação de ${e.name}`} disabled={approved} className={`${field} !w-40`} value={e.status ?? ""} onChange={(ev) => void patch({ equipment: r.equipment.map((y, j) => (j === i ? { ...y, status: (ev.target.value || null) as typeof e.status } : y)) })}>
                <option value="">Situação</option><option value="operating">Operando</option><option value="stopped">Parado</option><option value="under_maintenance">Em manutenção</option></select></div>
          ))}
        </Block>
        <Block title="Atividades">
          {r.activities.map((a, i) => (
            <div key={a.id} className="flex flex-col gap-1.5 border-b border-[#E3E5EE] pb-2.5 text-[15px] last:border-b-0">
              <span>{a.description} · {a.location ?? "sem local"} · {statusLabel[a.status]}</span>
              <span className="text-[13px] text-[#5B5F6B]">{a.service ? `${a.service.code} ${a.service.description}` : "Sem serviço da planilha"}</span>
              {isPublic && (
                <div className="grid grid-cols-[1fr_96px] items-center gap-2"><span className="text-[13px] text-[#5B5F6B]">Quantidade no dia</span>
                  <div className="grid grid-cols-2 gap-1">
                    <input aria-label={`Quantidade de ${a.description}`} type="number" disabled={approved} className={`${field} ${a.quantity === null ? "border-[#A673D6] bg-[#F7F0FD]" : ""}`} value={a.quantity ?? ""} onChange={(e) => void patch({ activities: r.activities.map((y, j) => (j === i ? { ...y, quantity: e.target.value === "" ? null : Number(e.target.value) } : y)) })} />
                    <input aria-label={`Unidade de ${a.description}`} placeholder="un" disabled={approved} className={field} value={a.unit ?? a.service?.unit ?? ""} onChange={(e) => void patch({ activities: r.activities.map((y, j) => (j === i ? { ...y, unit: e.target.value || null } : y)) })} />
                  </div></div>
              )}
            </div>
          ))}
          {!approved && <ActivityAdd services={services} loadServices={() => void loadServices()} onAdd={(a) => void patch({ activities: [...r.activities, a] })} />}
          {miss("activities") && <span className="text-xs text-[#6B3A00]">Informe ao menos uma atividade.</span>}
        </Block>
        <Block title="Ocorrências">
          {r.occurrences.map((o) => (
            <div key={o.id} className="flex flex-col gap-0.5 border-b border-[#E3E5EE] pb-2.5 last:border-b-0">
              <span className="text-[15px]">{o.description}</span>
              <span className="text-[13px] text-[#5B5F6B]">{occurrenceLabel[o.type]} · {o.startTime ?? "sem hora"}{o.endTime ? ` às ${o.endTime}` : ""} · {o.status === "closed" ? "encerrada" : "aberta"}</span>
              {isPublic && <span className="text-[13px] text-[#5B5F6B]">Serviços afetados: {o.affectedServiceIds.length}{o.source ? ` · Origem: ${o.source.origin}${o.source.document ? ` · ${o.source.document}` : ""}` : ""}</span>}
            </div>
          ))}
          {!approved && <OccurrenceAdd isPublic={isPublic} services={services} loadServices={() => void loadServices()} onAdd={(o) => void patch({ occurrences: [...r.occurrences, o] })} />}
          {miss("occurrences") && <span className="text-xs text-[#6B3A00]">Complete as ocorrências (horário, serviços afetados, fonte).</span>}
        </Block>
        <Block title={`Fotos · ${r.photos.length} de 20`}>
          <span className="text-[13px] text-[#5B5F6B]">{isPublic ? "Em obra pública, uma foto por atividade e por ocorrência. " : ""}Cada foto guarda data, hora e local.</span>
          <div className="grid grid-cols-2 gap-2">
            {r.photos.map((p) => (
              <div key={p.id} className="flex flex-col gap-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={p.caption ?? "Foto do RDO"} className="h-[76px] w-full rounded-[10px] object-cover" />
                <input aria-label="Legenda da foto" placeholder="Legenda" disabled={approved} defaultValue={p.caption ?? ""} className={field} onBlur={(e) => e.target.value !== (p.caption ?? "") && void patch({ photos: [{ id: p.id, caption: e.target.value || null }] })} />
                {(isPublic || r.photoRequirements.length > 0) && (
                  <select aria-label="Foto de qual atividade ou ocorrência" disabled={approved} className={field} value={p.linkedTo ? `${p.linkedTo.type}:${p.linkedTo.id}` : ""}
                    onChange={(e) => { const [type, ...rest] = e.target.value.split(":"); void patch({ photos: [{ id: p.id, linkedTo: e.target.value ? { type: type as "activity" | "occurrence", id: rest.join(":") } : null }] }); }}>
                    <option value="">Vincular a…</option>
                    {r.activities.map((a) => <option key={a.id} value={`activity:${a.id}`}>Atividade: {a.description}</option>)}
                    {r.occurrences.map((o) => <option key={o.id} value={`occurrence:${o.id}`}>Ocorrência: {o.description}</option>)}
                  </select>
                )}
              </div>
            ))}
          </div>
          {r.photoRequirements.map((q) => <span key={`${q.linkedTo.type}:${q.linkedTo.id}`} className="rounded-lg bg-[#F7F0FD] px-2.5 py-2 text-[13px] font-semibold text-[#4A2470]">Falta foto: {q.label}</span>)}
          {miss("photos") && <span className="text-xs text-[#6B3A00]">É preciso ao menos 3 fotos no dia. Tire mais fotos num novo registro e gere o RDO de novo.</span>}
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
      <select aria-label="Tipo da ocorrência" className={field} value={type} onChange={(e) => setType(e.target.value as typeof type)}>{Object.entries(occurrenceLabel).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
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
