"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { api, timezoneParams } from "@/lib/api";
import { errorMessage } from "@/lib/format";
import { ApiError, unwrap, useLoad } from "@/lib/hooks";
import { fetchReportPdf, saveBlob, shareReportPdf, type ReportPdf } from "@/lib/pdf";
import { Page, Status } from "@/components/ui";

const tz = timezoneParams();
const clock = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

function Destino({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="flex flex-1 flex-col items-center gap-1.5 text-center text-xs leading-[1.3] text-[#2D2D2B]">
      <span className="flex size-[54px] items-center justify-center rounded-2xl bg-[#F4F5F9]">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2D2D2B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
      </span>
      {label}
    </button>
  );
}

export function ReportShare() {
  const id = useSearchParams().get("id") ?? "";
  const [state, retry] = useLoad(async () => {
    const report = await unwrap(api.GET("/v1/reports/{reportId}", { params: { path: { reportId: id }, ...tz } }));
    const pdf = await fetchReportPdf(id);
    return { report, pdf };
  }, [id]);
  const [message, setMessage] = useState<string | null>(null);

  if (state.status !== "ok") {
    return <Page><Status state={state} retry={retry} /></Page>;
  }
  const { report, pdf }: { report: typeof state.data.report; pdf: ReportPdf } = state.data;
  const sizeKb = Math.max(1, Math.round(pdf.blob.size / 1024));

  async function share() {
    setMessage(null);
    try {
      const result = await shareReportPdf(pdf, pdf.fileName);
      if (result === "downloaded") setMessage("Este aparelho não abre o compartilhamento: o PDF foi baixado.");
    } catch (e) {
      setMessage(errorMessage(e instanceof ApiError ? e.code : "UNAVAILABLE"));
    }
  }

  return (
    <Page>
      <div className="relative flex min-h-dvh flex-col">
        <div aria-hidden="true" className="absolute inset-x-0 top-0 h-[250px] rounded-b-[32px] bg-[#2D2D2B]" />
        <div aria-hidden="true" className="relative flex flex-col items-center gap-1.5 px-6 pb-5 pt-20 text-center text-white">
          <span className="font-[family-name:var(--font-anybody)] text-[26px] font-bold">RDO aprovado</span>
          <span className="text-[13px] text-[#CFCFCB]">Aprovado por você às {report.approval ? clock(report.approval.approvedAt) : "--:--"} e salvo na obra</span>
        </div>
        <div aria-hidden="true" className="relative h-[260px] w-[310px] max-w-[calc(100%-32px)] self-center rounded-lg bg-white" />
        <Link href={`/rdo/aprovado?id=${id}`} aria-label="Fechar compartilhamento" className="absolute inset-0 bg-[rgba(30,30,28,0.55)]" />
        <div role="dialog" aria-labelledby="sh-titulo" className="absolute inset-x-0 bottom-0 flex flex-col gap-[18px] rounded-t-[28px] bg-white px-[18px] pb-6 pt-2.5">
          <span aria-hidden="true" className="h-[5px] w-11 self-center rounded-[3px] bg-[#CDD1DD]" />
          <div className="flex items-center gap-3">
            <span className="flex h-[52px] w-11 items-center justify-center rounded-lg bg-[#E3ECFF] text-xs font-semibold text-[#0B3699]">PDF</span>
            <div className="flex flex-1 flex-col gap-0.5">
              <span id="sh-titulo" className="break-all text-[15px] font-semibold">{pdf.fileName}</span>
              <span className="text-[13px] text-[#5B5F6B]">{sizeKb} KB · aprovado às {report.approval ? clock(report.approval.approvedAt) : "--:--"}</span>
            </div>
          </div>
          {message && <div role="status" className="rounded-xl bg-[#E3ECFF] p-3 text-sm text-[#0B3699]">{message}</div>}
          <div className="flex gap-1.5">
            <Destino label="WhatsApp" onClick={() => void share()}><path d="M4 18.5l1.3-3.6A7.5 7.5 0 1 1 9 19l-5-.5z" /></Destino>
            <Destino label="E-mail" onClick={() => void share()}><rect x="3" y="5.5" width="18" height="13" rx="2" /><path d="M3.5 7l8.5 6 8.5-6" /></Destino>
            <Destino label="Salvar na nuvem" onClick={() => void share()}><path d="M7 18h10a4 4 0 0 0 .5-8 6 6 0 0 0-11.4 1.6A3.3 3.3 0 0 0 7 18z" /><path d="M12 15v-4M10 13l2-2 2 2" /></Destino>
            <Destino label="Baixar PDF" onClick={() => saveBlob(pdf)}><path d="M12 4v11M7 10l5 5 5-5" /><path d="M5 20h14" /></Destino>
          </div>
          <Link href={`/rdo/aprovado?id=${id}`} className="flex min-h-[52px] items-center justify-center rounded-[14px] bg-[#F4F5F9] text-[15px] font-semibold text-[#2D2D2B]">Cancelar</Link>
        </div>
      </div>
    </Page>
  );
}
