"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { api, timezoneParams } from "@/lib/api";
import { documentTypeLabel, errorMessage, siteTypeLabel, statusLabel } from "@/lib/format";
import { useOnline } from "@/lib/online";
import { ApiError, unwrap, useLoad } from "@/lib/hooks";
import { Page, Pill, Status } from "@/components/ui";

const Row = ({ k, children }: { k: string; children: React.ReactNode }) => (
  <div className="grid grid-cols-[112px_1fr] gap-2.5 border-b border-[#E3E5EE] py-2.5 text-[15px] last:border-b-0"><span className="text-[13px] text-[#5B5F6B]">{k}</span><span>{children}</span></div>
);

export function SiteFolder() {
  const router = useRouter();
  const online = useOnline();
  const id = useSearchParams().get("id") ?? "";
  const [genError, setGenError] = useState<string | null>(null);
  const [state, retry] = useLoad(() => unwrap(api.GET("/v1/sites/{siteId}", { params: { path: { siteId: id }, ...timezoneParams() } })), [id]);
  if (state.status !== "ok") return <Page><Status state={state} retry={retry} /></Page>;
  const s = state.data;
  const city = s.address.split("·").pop()?.trim() ?? s.address;
  return (
    <Page>
      <div className="flex flex-col gap-4 rounded-b-[28px] bg-[#2D2D2B] px-[18px] pb-[22px] pt-[18px] text-white">
        <Link href="/" aria-label="Voltar para suas obras" className="flex size-11 items-center justify-center rounded-full bg-[#3A3A37]">←</Link>
        <div className="flex flex-col gap-1">
          <h1 className="m-0 font-[family-name:var(--font-anybody)] text-[26px] font-bold leading-[1.15]">{s.name}</h1>
          <span className="text-[13px] text-[#CFCFCB]">{city} · {siteTypeLabel[s.type]}</span>
        </div>
      </div>
      <div className="flex flex-col gap-6 px-4 pb-32 pt-5">
        {s.status === "in_progress" && (
          <Link href={`/dia?id=${s.id}`} className="flex items-center gap-3 rounded-2xl border-[1.5px] border-[#1563FF] bg-white px-4 py-3.5">
            <div className="flex flex-1 flex-col gap-0.5"><span className="text-[15px] font-semibold">RDO de hoje</span>
              <span className="text-[13px] text-[#5B5F6B]">{s.today.entriesCount === 0 ? "Nenhum registro ainda" : `${s.today.entriesCount} ${s.today.entriesCount === 1 ? "registro" : "registros"} · falta fechar o dia`}</span></div>
            <span className="rounded-full bg-[#1563FF] px-3.5 py-2.5 text-[13px] font-semibold text-white">{s.today.entriesCount === 0 ? "Registrar" : "Continuar"}</span>
          </Link>
        )}
        {s.status === "in_progress" && (s.today.entriesCount > 0 || s.today.reportId) && (
          <>
            <button type="button" disabled={!online} onClick={() => void (async () => {
              setGenError(null);
              if (s.today.state === "approved" && s.today.reportId) return router.push(`/rdo?id=${s.today.reportId}`);
              try {
                const report = await unwrap(api.POST("/v1/sites/{siteId}/days/{localDate}/report", { params: { path: { siteId: s.id, localDate: s.today.localDate }, ...timezoneParams() } }));
                router.push(`/rdo?id=${report.id}`);
              } catch (e) { setGenError(errorMessage(e instanceof ApiError ? e.code : "UNAVAILABLE")); }
            })()} className="flex min-h-[52px] items-center justify-center rounded-[14px] bg-[#2D2D2B] text-[15px] font-semibold text-white">{s.today.state === "approved" ? "Ver RDO de hoje" : "Gerar RDO"}</button>
            {genError && <div role="alert" className="rounded-xl bg-[#FFE9C7] p-3 text-sm text-[#6B3A00]">{genError}</div>}
          </>
        )}
        {s.pendingDays.length > 0 && <Pill tone="amber">{s.pendingDays.length} dia(s) capturado(s) sem internet</Pill>}
        <section className="flex flex-col gap-2.5">
          <div className="flex items-baseline justify-between px-0.5"><h2 className="m-0 text-[15px] font-semibold">RDOs aprovados</h2><span className="text-[13px] text-[#5B5F6B]">{s.approvedReportsCount} no total</span></div>
          <ul className="m-0 list-none rounded-2xl bg-white p-3.5 text-[13px] text-[#5B5F6B]">
            {s.recentReports.length === 0 ? <li>Nenhum RDO aprovado ainda.</li> : s.recentReports.map((r) => <li key={r.id}>Nº {String(r.number).padStart(3, "0")} · {r.localDate}</li>)}
          </ul>
        </section>
        <section className="flex flex-col gap-2.5">
          <div className="flex items-baseline justify-between px-0.5"><h2 className="m-0 text-[15px] font-semibold">Dados da obra</h2>
            <Link href={`/obra/editar?id=${s.id}`} className="py-3 text-[13px] font-semibold text-[#1563FF]">Editar</Link></div>
          <div className="rounded-2xl bg-white px-3.5 py-0.5">
            <Row k="Status"><span className="flex items-center justify-between">{statusLabel[s.status]}<Link href={`/obra/status?id=${s.id}`} className="py-3 text-[13px] font-semibold text-[#1563FF]">Alterar</Link></span></Row>
            <Row k="Tipo">{siteTypeLabel[s.type]}</Row>
            <Row k="Endereço">{s.address}</Row>
            <Row k="Contratante">{s.client.name}</Row>
            <Row k="Contratada">{s.contractor.name}</Row>
            <Row k="Responsável">{s.technicalManager.name} · ART {s.technicalManager.artNumber}</Row>
            {s.publicContract && <Row k="Contrato">{s.publicContract.number} · restam {s.publicContract.remainingDays} dias</Row>}
            <Row k="Serviços">{s.servicesCount}{s.servicesFileName && `, de ${s.servicesFileName}`}</Row>
            <Row k="Equipamentos">{s.equipment.length ? s.equipment.map((e) => e.name).join(", ") : "Nenhum"}</Row>
            <Row k="Documentos">{s.documents.length ? s.documents.map((d) => (<a key={d.id} href={d.url} target="_blank" rel="noreferrer" className="block text-[#1563FF]">{documentTypeLabel[d.type]}</a>)) : "Nenhum"}</Row>
          </div>
        </section>
      </div>
    </Page>
  );
}
