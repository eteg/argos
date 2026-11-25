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
          <p className="m-0 text-[13px] leading-[1.45] text-[#5B5F6B]">Os destinos, como WhatsApp, e-mail e salvar na nuvem, são os do seu celular. Toque em Compartilhar para abri-los.</p>
          {message && <div role="status" className="rounded-xl bg-[#E3ECFF] p-3 text-sm text-[#0B3699]">{message}</div>}
          <div className="flex flex-col gap-2">
            <button type="button" onClick={() => void share()} className="flex min-h-[52px] items-center justify-center rounded-[14px] bg-[#1563FF] text-[15px] font-semibold text-white">Compartilhar</button>
            <button type="button" onClick={() => saveBlob(pdf)} className="flex min-h-11 items-center justify-center rounded-[14px] border-[1.5px] border-[#2D2D2B] text-[15px] font-semibold">Baixar PDF</button>
            <Link href={`/rdo/aprovado?id=${id}`} className="flex min-h-[52px] items-center justify-center rounded-[14px] bg-[#F4F5F9] text-[15px] font-semibold">Cancelar</Link>
          </div>
        </div>
      </div>
    </Page>
  );
}
