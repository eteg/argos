"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { Schemas } from "@argos/contract";
import { api, timezoneParams } from "@/lib/api";
import { errorMessage, fullDate } from "@/lib/format";
import { ApiError, unwrap, useLoad } from "@/lib/hooks";
import { fetchReportPdf, saveBlob } from "@/lib/pdf";
import { Page, Status } from "@/components/ui";

type Report = Schemas["Report"];
const tz = timezoneParams();
const weatherLabel = { good: "Bom", cloudy: "Nublado", light_rain: "Chuva fraca", heavy_rain: "Chuva forte" } as const;
const conditionLabel = { workable: "praticável", partially_workable: "parcialmente praticável", unworkable: "impraticável" } as const;
const clock = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

const Line = ({ k, v, last }: { k: string; v: string; last?: boolean }) => (
  <div className={`grid grid-cols-[72px_1fr] gap-2 py-[5px] ${last ? "" : "border-b border-[#ECEEF3]"}`}><span className="text-[#5B5F6B]">{k}</span><span>{v}</span></div>
);

export function summaryOf(r: Report) {
  const w = r.workday;
  const weather = r.weather.map((x) => `${x.shift === "morning" ? "Manhã" : "tarde"} ${x.weather ? weatherLabel[x.weather].toLowerCase() : "?"}${x.condition ? `, ${conditionLabel[x.condition]}` : ""}`).join(" · ");
  const labor = r.labor.map((l) => `${l.count} ${l.role.toLowerCase()}${l.employment === "third_party" ? " (terceiros)" : ""}`).join(" · ");
  const activities = r.activities.map((a) => a.description).join(" · ");
  const occurrences = r.occurrences.map((o) => o.description).join(" · ");
  const tracked = r.newOpenItems.filter((n) => n.track).length + r.openItemReviews.filter((x) => x.outcome !== "close").length;
  const closed = r.openItemReviews.filter((x) => x.outcome === "close").length;
  return {
    workday: w.startTime && w.endTime ? `${w.startTime} às ${w.endTime}${w.breakMinutes !== null ? ` · intervalo ${w.breakMinutes} min` : ""}` : "Não informada",
    weather,
    labor,
    activities,
    occurrences: occurrences || "Nenhuma",
    open: `${tracked} ${tracked === 1 ? "item segue" : "itens seguem"} para amanhã · ${closed} ${closed === 1 ? "fechado" : "fechados"}`,
  };
}

export function ReportApproved() {
  const router = useRouter();
  const id = useSearchParams().get("id") ?? "";
  const [state, retry] = useLoad(() => unwrap(api.GET("/v1/reports/{reportId}", { params: { path: { reportId: id }, ...tz } })), [id]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const report = state.status === "ok" ? state.data : null;
  useEffect(() => {
    if (report && report.status !== "approved") router.replace(`/rdo?id=${id}`);
  }, [report, id, router]);
  if (!report || report.status !== "approved" || !report.approval) return <Page><Status state={state.status === "ok" ? { status: "loading" } : state} retry={retry} /></Page>;

  const sum = summaryOf(report);
  const asked = [
    ...report.openItemReviews.filter((x) => x.outcome !== "close").map((x) => x.note ?? "Item em aberto da obra"),
    ...report.newOpenItems.filter((n) => n.track).map((n) => n.title),
  ];

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

  return (
    <Page>
      <div className="relative flex min-h-dvh flex-col">
        <div className="absolute inset-x-0 top-0 h-[250px] rounded-b-[32px] bg-[#2D2D2B]" />
        <div className="relative flex justify-end px-[18px] pt-[18px]">
          <Link href={`/obra?id=${report.siteId}`} aria-label="Fechar e voltar à obra" className="flex size-11 items-center justify-center rounded-full bg-[#3A3A37]"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg></Link>
        </div>
        <div className="relative flex flex-col items-center gap-1.5 px-6 pb-5 text-center text-white">
          <span className="flex size-[52px] items-center justify-center rounded-full bg-[#CCA6ED]">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#2D2D2B" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
          </span>
          <h1 className="m-0 mt-1.5 font-[family-name:var(--font-anybody)] text-[26px] font-bold leading-[1.15] tracking-[-0.02em]">RDO aprovado</h1>
          <span className="text-[13px] text-[#CFCFCB]">Aprovado por você às {clock(report.approval.approvedAt)} e salvo na obra</span>
        </div>
        <div className="relative flex w-[310px] max-w-[calc(100%-32px)] flex-col gap-2.5 self-center rounded-lg bg-white p-4 text-[11px] leading-[1.4] shadow-[0_24px_40px_-24px_rgba(45,45,43,0.55)]">
          <div className="flex items-start justify-between border-b-2 border-[#1563FF] pb-2">
            <div className="flex flex-col"><span className="font-[family-name:var(--font-anybody)] text-[13px] font-bold">Relatório Diário de Obra</span><span className="text-[#5B5F6B]">{report.site.name}</span></div>
            <div className="flex flex-col items-end"><span className="font-semibold">Nº {String(report.number).padStart(3, "0")}</span><span className="text-[#5B5F6B]">{fullDate(report.localDate)}</span></div>
          </div>
          <div>
            <Line k="Jornada" v={sum.workday} /><Line k="Clima" v={sum.weather} /><Line k="Efetivo" v={sum.labor || "Não informado"} />
            <Line k="Atividades" v={sum.activities || "Nenhuma"} /><Line k="Ocorrências" v={sum.occurrences} /><Line last k="Em aberto" v={sum.open} />
          </div>
          <div className="flex items-end justify-between gap-2">
            <div className="flex flex-col"><span>Responsável: {report.site.technicalManager.name}</span><span className="text-[#5B5F6B]">ART {report.site.technicalManager.artNumber}</span></div>
            <span className="rounded border-[1.5px] border-[#1563FF] px-1.5 py-0.5 text-[10px] font-semibold text-[#0B3699]">Aprovado {clock(report.approval.approvedAt)}</span>
          </div>
        </div>
        {asked.length > 0 && (
          <div className="relative mx-4 mt-4 flex flex-col gap-1 rounded-2xl border-[1.5px] border-[#CCA6ED] bg-white px-3.5 py-3">
            <span className="text-[13px] font-semibold text-[#5B2E86]">Amanhã o Argos vai perguntar por</span>
            <span className="text-[15px] leading-[1.45]">{asked.join(", ")}.</span>
          </div>
        )}
        <div className="relative mt-auto flex flex-col gap-1.5 px-4 pb-[22px] pt-3.5">
          {error && <div role="alert" className="rounded-xl bg-[#FFE9C7] p-3 text-sm text-[#6B3A00]">{error}</div>}
          <div className="flex gap-2.5">
            <Link href={`/rdo/compartilhar?id=${id}`} className="flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-2xl bg-white text-[15px] font-semibold shadow-[0_6px_18px_-12px_rgba(45,45,43,0.5)]"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2D2D2B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 15V4M7.5 8.5L12 4l4.5 4.5" /><path d="M5 12v7h14v-7" /></svg>Compartilhar</Link>
            <button type="button" disabled={busy} onClick={() => void download()} className="flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-2xl bg-[#1563FF] text-[15px] font-semibold text-white disabled:opacity-60"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5" /><path d="M5 20h14" /></svg>{busy ? "Baixando…" : "Baixar PDF"}</button>
          </div>
          <Link href="/" className="flex min-h-11 items-center justify-center text-[15px] font-semibold text-[#5B5F6B]">Voltar ao início</Link>
        </div>
      </div>
    </Page>
  );
}
