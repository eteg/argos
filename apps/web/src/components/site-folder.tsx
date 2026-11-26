"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api, timezoneParams } from "@/lib/api";
import { documentTypeLabel, siteTypeLabel, statusLabel } from "@/lib/format";
import { unwrap, useLoad } from "@/lib/hooks";
import { agePill, ageLabel, openItemKindLabel } from "@/lib/open-items";
import { MainNav } from "@/components/main-nav";
import { Page, Status } from "@/components/ui";

const Row = ({ k, children }: { k: string; children: React.ReactNode }) => (
  <div className="grid grid-cols-[112px_1fr] gap-2.5 border-b border-[#E3E5EE] py-2.5 text-[15px] last:border-b-0"><span className="text-[13px] text-[#5B5F6B]">{k}</span><span>{children}</span></div>
);

export function SiteFolder() {
  const id = useSearchParams().get("id") ?? "";
  const [state, retry] = useLoad(() => unwrap(api.GET("/v1/sites/{siteId}", { params: { path: { siteId: id }, ...timezoneParams() } })), [id]);
  const [cfg] = useLoad(() => unwrap(api.GET("/v1/config", { params: timezoneParams() })), []);
  if (state.status !== "ok") return <Page><Status state={state} retry={retry} /></Page>;
  const s = state.data;
  const city = s.address.split("·").pop()?.trim() ?? s.address;
  const [title = s.name, ...rest] = s.name.split(" · ");
  return (
    <Page>
      <div className="flex flex-col gap-4 rounded-b-[28px] bg-[#2D2D2B] px-[18px] pb-[22px] pt-[18px] text-white">
        <div className="flex items-center justify-between">
          <Link href="/" aria-label="Voltar para suas obras" className="flex size-11 items-center justify-center rounded-full bg-[#3A3A37]">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
          </Link>
          <Link href="/menu" aria-label="Abrir menu" className="flex size-11 items-center justify-center rounded-full bg-[#3A3A37]">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
          </Link>
        </div>
        <div className="flex flex-col gap-1">
          <h1 className="m-0 font-[family-name:var(--font-anybody)] text-[26px] font-bold leading-[1.15] tracking-[-0.02em]">{title}</h1>
          <span className="text-[13px] text-[#CFCFCB]">{[...rest, city, siteTypeLabel[s.type]].join(" · ")}</span>
        </div>
      </div>
      <div className="flex flex-col gap-6 px-4 pb-32 pt-5">
        {s.status === "in_progress" && (
          <Link href={`/dia?id=${s.id}`} className="flex items-center gap-3 rounded-2xl border-[1.5px] border-[#1563FF] bg-white px-4 py-3.5">
            <div className="flex flex-1 flex-col gap-0.5"><span className="text-[15px] font-semibold">RDO de hoje</span>
              <span className="text-[13px] text-[#5B5F6B]">{s.today.state === "approved" ? "Aprovado e salvo na obra" : s.today.entriesCount === 0 ? "Nenhum registro ainda" : `${s.today.entriesCount} ${s.today.entriesCount === 1 ? "registro" : "registros"} · falta fechar o dia`}</span></div>
            <span className="rounded-full bg-[#1563FF] px-3.5 py-2.5 text-[13px] font-semibold text-white">{s.today.state === "approved" ? "Ver" : s.today.entriesCount === 0 ? "Registrar" : "Continuar"}</span>
          </Link>
        )}
        {s.pendingDays.length > 0 && (
          <Link href="/dias-anteriores" className="flex min-h-11 items-center justify-between gap-3 rounded-2xl bg-[#FFE9C7] px-4 py-2.5 text-[13px] text-[#6B3A00]">
            <span>{s.pendingDays.length} {s.pendingDays.length === 1 ? "dia anterior" : "dias anteriores"} sem RDO aprovado</span>
            <span className="font-semibold">Finalizar</span>
          </Link>
        )}
        <section className="flex flex-col gap-2.5" aria-labelledby="s-aberto">
          <div className="flex items-baseline justify-between px-0.5"><h2 id="s-aberto" className="m-0 text-[15px] font-semibold">Em aberto nesta obra</h2><Link href="/pendencias" className="py-3 text-[13px] font-semibold text-[#1563FF]">Ver pendências</Link></div>
          <ul className={`m-0 list-none rounded-2xl bg-white px-3.5 py-0.5 ${s.openItems.length > 0 ? "border-[1.5px] border-[#CCA6ED]" : ""}`}>
            {s.openItems.length === 0 && <li className="py-3.5 text-[13px] text-[#5B5F6B]">Nada em aberto.</li>}
            {s.openItems.map((i) => (
              <li key={i.id} className="flex min-h-14 items-center gap-3 border-b border-[#E3E5EE] last:border-b-0">
                <div className="flex min-w-0 flex-1 flex-col gap-0.5 py-2.5"><span className="text-[15px] font-medium">{i.title}</span><span className="text-[13px] text-[#5B5F6B]">{i.lastUpdate?.note ?? openItemKindLabel[i.kind]}</span></div>
                <span className={`flex-none rounded-full px-[9px] py-1 text-xs font-semibold ${agePill(i.openedOn, s.today.localDate, cfg.status === "ok" ? cfg.data.openItemHighlightDays : 4)}`}>{ageLabel(i.openedOn, s.today.localDate)}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="flex flex-col gap-2.5">
          <div className="flex items-baseline justify-between px-0.5"><h2 className="m-0 text-[15px] font-semibold">RDOs aprovados</h2><span className="text-[13px] text-[#5B5F6B]">{s.approvedReportsCount} no total</span></div>
          {s.recentReports.length === 0 ? (
            <p className="m-0 rounded-2xl bg-white p-3.5 text-[13px] text-[#5B5F6B]">Nenhum RDO aprovado ainda.</p>
          ) : (
            <ul className="m-0 list-none rounded-2xl bg-white px-3.5 py-0.5">
              {s.recentReports.map((r) => {
                const [y = 0, m = 1, d = 1] = r.localDate.split("-").map(Number);
                const day = new Date(Date.UTC(y, m - 1, d));
                const weekday = new Intl.DateTimeFormat("pt-BR", { weekday: "long", timeZone: "UTC" }).format(day);
                const short = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" }).format(day);
                const time = new Date(r.approvedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
                return (
                  <li key={r.id} className="border-b border-[#E3E5EE] last:border-b-0">
                    <Link href={`/rdo/consulta?id=${r.id}`} className="flex min-h-14 items-center gap-3">
                      <div className="flex flex-1 flex-col gap-0.5 py-2.5">
                        <span className="text-[15px] font-medium">Nº {String(r.number).padStart(3, "0")} · {weekday}, {short}</span>
                        <span className="text-[13px] text-[#5B5F6B]">Aprovado às {time} · {r.occurrencesCount === 0 ? "sem ocorrências" : `${r.occurrencesCount} ${r.occurrencesCount === 1 ? "ocorrência" : "ocorrências"}`}</span>
                      </div>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5B5F6B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
          {s.approvedReportsCount > 0 && <Link href={`/obra/rdos?id=${s.id}`} className="py-1 text-[13px] font-semibold text-[#1563FF]">Ver todos os RDOs aprovados</Link>}
        </section>
        <section className="flex flex-col gap-2.5">
          <div className="flex items-baseline justify-between px-0.5"><h2 className="m-0 text-[15px] font-semibold">Dados da obra</h2>
            <Link href={`/obra/editar?id=${s.id}`} className="py-3 text-[13px] font-semibold text-[#1563FF]">Editar</Link></div>
          <div className="rounded-2xl bg-white px-3.5 py-0.5">
            <Row k="Status"><span className="flex items-center justify-between">{statusLabel[s.status]}<Link href={`/obra/status?id=${s.id}`} className="py-3 text-[13px] font-semibold text-[#1563FF]">Alterar</Link></span></Row>
            <Row k="Tipo">{{ private: "Privada", public: "Pública", financed: "Financiada" }[s.type]}</Row>
            <Row k="Endereço">{s.address}</Row>
            <Row k="Contratante">{s.client.name}</Row>
            <Row k="Contratada">{s.contractor.name}</Row>
            <Row k="Responsável">{s.technicalManager.name} · ART {s.technicalManager.artNumber}</Row>
            {s.publicContract && <Row k="Contrato">{s.publicContract.number} · restam {s.publicContract.remainingDays} dias</Row>}
            <Row k="Serviços">{s.servicesCount}, da planilha orçamentária</Row>
            <Row k="Equipamentos">{s.equipment.length ? s.equipment.map((e) => e.name).join(", ") : "Nenhum"}</Row>
            <Row k="Documentos">{s.documents.length ? s.documents.map((d) => (<a key={d.id} href={d.url} target="_blank" rel="noreferrer" className="block text-[#1563FF]">{documentTypeLabel[d.type]}</a>)) : "Nenhum"}</Row>
          </div>
        </section>
      </div>
      <MainNav active="none" registerHref={`/registro?id=${s.id}`} />
    </Page>
  );
}
