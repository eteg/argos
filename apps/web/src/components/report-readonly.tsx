"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { api, timezoneParams } from "@/lib/api";
import { errorMessage, fullDate, siteTypeLabel } from "@/lib/format";
import { ApiError, unwrap, useLoad } from "@/lib/hooks";
import { fetchReportPdf, saveBlob } from "@/lib/pdf";
import { Back, Page, Status } from "@/components/ui";

const tz = timezoneParams();
const weatherLabel = { good: "Bom", cloudy: "Nublado", light_rain: "Chuva fraca", heavy_rain: "Chuva forte" } as const;
const conditionLabel = { workable: "praticável", partially_workable: "parcialmente praticável", unworkable: "impraticável" } as const;
const activityLabel = { started: "iniciada", in_progress: "em andamento", completed: "concluída", stopped: "parada" } as const;
const equipmentLabel = { operating: "operando", stopped: "parado", under_maintenance: "em manutenção" } as const;
const occurrenceLabel = {
  stoppage: "Paralisação", accident: "Acidente", material_shortage: "Falta de material", equipment_failure: "Falha de equipamento",
  inspection_order: "Ordem da fiscalização", visit: "Visita", external_interference: "Interferência externa", other: "Outra",
} as const;
const clock = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

const Block = ({ title, children, accent }: { title: string; children: React.ReactNode; accent?: boolean }) => (
  <section className={`flex flex-col gap-3 rounded-2xl bg-white p-3.5 ${accent ? "border-[1.5px] border-[#CCA6ED]" : ""}`}><h2 className="m-0 text-[15px] font-semibold">{title}</h2>{children}</section>
);
const Item = ({ title, sub }: { title: string; sub?: string }) => (
  <div className="flex flex-col gap-0.5 border-b border-[#E3E5EE] py-2.5 first:pt-0 last:border-b-0 last:pb-0"><span className="text-[15px]">{title}</span>{sub && <span className="text-[13px] text-[#5B5F6B]">{sub}</span>}</div>
);
const Info = ({ k, v, wide }: { k: string; v: string; wide?: boolean }) => (
  <div className={`flex min-w-0 flex-col gap-1 ${wide ? "col-span-2" : ""}`}><span className="text-[13px] text-[#5B5F6B]">{k}</span><span className="text-[15px]">{v}</span></div>
);

export function ReportReadonly() {
  const id = useSearchParams().get("id") ?? "";
  const [state, retry] = useLoad(() => unwrap(api.GET("/v1/reports/{reportId}", { params: { path: { reportId: id }, ...tz } })), [id]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (state.status !== "ok") return <Page><Status state={state} retry={retry} /></Page>;
  const r = state.data;

  async function download() {
    setBusy(true);
    setError(null);
    try {
      saveBlob(await fetchReportPdf(id));
    } catch (e) {
      setError(errorMessage(e instanceof ApiError ? e.code : "UNAVAILABLE"));
    }
    setBusy(false);
  }

  const [y = 0, m = 1, d = 1] = r.localDate.split("-").map(Number);
  const weekday = new Intl.DateTimeFormat("pt-BR", { weekday: "long", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, d)));
  const w = r.workday;
  const contract = r.site.publicContract;
  const tracked = r.newOpenItems.filter((n) => n.track);

  return (
    <Page>
      <div className="flex items-center gap-3 px-5 pb-3 pt-5">
        <Back href={`/obra/rdos?id=${r.siteId}`} label="Voltar para os RDOs da obra" />
        <div className="flex flex-col gap-0.5">
          <h1 className="m-0 font-[family-name:var(--font-anybody)] text-[26px] font-bold leading-[1.15] tracking-[-0.02em]">RDO {String(r.number).padStart(3, "0")}</h1>
          <span className="text-[13px] text-[#5B5F6B]">{weekday.charAt(0).toUpperCase() + weekday.slice(1)}, {fullDate(r.localDate)} · {r.site.name}</span>
        </div>
      </div>
      <div className="flex flex-col gap-3 px-4 pb-28 pt-1">
        {r.approval ? (
          <div className="flex items-center gap-3 rounded-2xl border-[1.5px] border-[#CCA6ED] bg-white px-3.5 py-3">
            <span className="flex size-9 flex-none items-center justify-center rounded-full bg-[#CCA6ED]">✓</span>
            <div className="flex flex-col gap-0.5"><span className="text-[15px] font-semibold">Aprovado por {r.approval.approvedBy}</span>
              <span className="text-[13px] text-[#5B5F6B]">{new Date(r.approval.approvedAt).toLocaleDateString("pt-BR")} às {clock(r.approval.approvedAt)} · só leitura</span></div>
          </div>
        ) : (
          <div className="rounded-2xl bg-[#FFE9C7] p-3.5 text-sm text-[#6B3A00]">Este RDO ainda é um rascunho. <Link href={`/rdo?id=${r.id}`} className="font-semibold underline">Abrir para revisar</Link></div>
        )}
        <Block title="Identificação">
          <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
            <Info k="Obra" v={r.site.name} /><Info k="Tipo" v={siteTypeLabel[r.site.type].replace("obra ", "").replace(/^./, (c) => c.toUpperCase())} />
            <Info wide k="Responsável" v={`${r.site.technicalManager.name} · ART ${r.site.technicalManager.artNumber}`} />
            <Info wide k="Endereço" v={r.site.address} />
            <Info wide k="Contratante" v={`${r.site.client.name} · CNPJ ${r.site.client.taxId}`} />
            <Info wide k="Contratada" v={`${r.site.contractor.name} · CNPJ ${r.site.contractor.taxId}`} />
            {contract && <Info wide k="Contrato" v={`Nº ${contract.number} · empenho ${contract.commitmentOrAgreement} · fiscal ${contract.inspectorName} · ${contract.elapsedDays} dias decorridos, faltam ${contract.remainingDays}`} />}
          </div>
        </Block>
        <Block title="Jornada e clima">
          <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
            <Info wide k="Jornada" v={w.startTime && w.endTime ? `${w.startTime} às ${w.endTime}${w.breakMinutes !== null ? ` · intervalo ${w.breakMinutes} min` : ""}` : "Não informada"} />
            {r.weather.map((x) => <Info key={x.shift} k={x.shift === "morning" ? "Manhã" : "Tarde"} v={`${x.weather ? weatherLabel[x.weather] : "?"} · ${x.condition ? conditionLabel[x.condition] : "?"}`} />)}
            {r.weatherStoppage && <Info wide k="Horas paradas por clima" v={`${r.weatherStoppage.hours} h`} />}
          </div>
        </Block>
        <Block title="Efetivo">
          {r.labor.length === 0 ? <span className="text-sm text-[#5B5F6B]">Não informado.</span> : r.labor.map((l, i) => <Item key={i} title={`${l.count} ${l.role.toLowerCase()}`} sub={l.employment === "own" ? "Próprio" : `Terceiro${l.company ? ` · ${l.company}` : ""}`} />)}
        </Block>
        {r.equipment.length > 0 && (
          <Block title="Equipamentos">{r.equipment.map((e) => <Item key={e.equipmentId} title={e.name} sub={`${e.identifier ? `${e.identifier} · ` : ""}${e.status ? equipmentLabel[e.status] : "sem situação"}${e.operatingHours !== null ? ` · ${e.operatingHours} h` : ""}`} />)}</Block>
        )}
        <Block title="Atividades">
          {r.activities.length === 0 ? <span className="text-sm text-[#5B5F6B]">Nenhuma.</span> : r.activities.map((a) => (
            <Item key={a.id} title={`${a.service ? `${a.service.code} · ` : ""}${a.description}`} sub={`${a.location ?? "sem local"} · ${activityLabel[a.status]}${a.quantity !== null ? ` · ${a.quantity}${a.unit ? ` ${a.unit}` : ""}` : ""}`} />
          ))}
        </Block>
        <Block title="Ocorrências">
          {r.occurrences.length === 0 ? <span className="text-sm text-[#5B5F6B]">Nenhuma.</span> : r.occurrences.map((o) => (
            <Item key={o.id} title={o.description} sub={`${occurrenceLabel[o.type]} · ${o.startTime ?? "sem hora"}${o.endTime ? ` às ${o.endTime}` : ""} · ${o.status === "closed" ? "encerrada" : "aberta"}${o.source ? ` · ${o.source.origin}${o.source.document ? `, ${o.source.document}` : ""}` : ""}${o.safety ? ` · DDS ${o.safety.dds ? "feito" : "não feito"}, EPI ${o.safety.ppeInUse ? "em uso" : "sem uso"}` : ""}`} />
          ))}
        </Block>
        {(tracked.length > 0 || r.openItemReviews.length > 0) && (
          <Block title="Itens em aberto no fim do dia" accent>
            {r.openItemReviews.map((x) => <Item key={x.openItemId} title={x.note ?? "Item em aberto da obra"} sub={x.outcome === "close" ? "Fechado" : x.outcome === "keep" ? "Mantido" : "Atualizado"} />)}
            {tracked.map((n) => <Item key={n.id} title={n.title} sub="Novo" />)}
          </Block>
        )}
        <Block title={`Fotos · ${r.photos.length} de 20`}>
          <div className="grid grid-cols-2 gap-2">
            {r.photos.map((p) => (
              <div key={p.id} className="flex flex-col gap-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={p.caption ?? "Foto do RDO"} className="h-[76px] w-full rounded-[10px] bg-[#DCDFE8] object-cover" />
                <span className="text-[13px] text-[#5B5F6B]">{clock(p.capturedAt)}{p.caption ? ` · ${p.caption}` : ""}</span>
              </div>
            ))}
          </div>
        </Block>
        <Block title="Validação">
          <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
            <Info k="Status" v={r.status === "approved" ? "Aprovado" : "Rascunho"} />
            {r.approval && <Info k="Aprovado por" v={r.approval.approvedBy} />}
            {r.approval && <Info wide k="Data e hora" v={`${new Date(r.approval.approvedAt).toLocaleDateString("pt-BR")} · ${clock(r.approval.approvedAt)}`} />}
          </div>
          {r.history.map((h, i) => <span key={i} className="text-[13px] text-[#5B5F6B]">{clock(h.at)} · {h.actor === "agent" ? "Argos" : "Você"}: {h.description}</span>)}
        </Block>
        {error && <div role="alert" className="rounded-xl bg-[#FFE9C7] p-3 text-sm text-[#6B3A00]">{error}</div>}
      </div>
      {r.status === "approved" && (
        <div className="fixed inset-x-0 bottom-0 mx-auto flex w-full max-w-[430px] gap-2.5 border-t border-[#E3E5EE] bg-white px-4 pb-[22px] pt-3">
          <Link href={`/rdo/compartilhar?id=${r.id}`} className="flex min-h-[52px] flex-1 items-center justify-center rounded-[14px] border-[1.5px] border-[#2D2D2B] text-[15px] font-semibold">Compartilhar</Link>
          <button type="button" disabled={busy} onClick={() => void download()} className="flex min-h-[52px] flex-[1.3] items-center justify-center rounded-[14px] bg-[#1563FF] text-[15px] font-semibold text-white disabled:opacity-60">{busy ? "Baixando…" : "Baixar PDF"}</button>
        </div>
      )}
    </Page>
  );
}
