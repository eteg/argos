"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api, timezoneParams } from "@/lib/api";
import { clock } from "@/lib/format";
import { getPosition, type Position } from "@/lib/geo";
import { useOnline } from "@/lib/online";
import { ApiError, unwrap, useLoad } from "@/lib/hooks";
import { MainNav } from "@/components/main-nav";
import { ErrorAlert, Page, Status } from "@/components/ui";

const tz = timezoneParams();

function meters(a: Position, b: { lat: number; lng: number }) {
  const rad = Math.PI / 180;
  const h = Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(((b.lng - a.lng) * rad) / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

const Icon = ({ photo }: { photo: boolean }) => (
  <span className="flex size-9 flex-none items-center justify-center rounded-full bg-[#E3ECFF]">
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#0B3699" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {photo ? <><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></> : <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></>}
    </svg>
  </span>
);

export function DayView() {
  const router = useRouter();
  const online = useOnline();
  const params = useSearchParams();
  const siteId = params.get("id") ?? "";
  const [position, setPosition] = useState<Position | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { void getPosition().then(setPosition); }, []);
  const [state, retry] = useLoad(async () => {
    const [site, config] = await Promise.all([
      unwrap(api.GET("/v1/sites/{siteId}", { params: { path: { siteId }, ...tz } })),
      unwrap(api.GET("/v1/config", { params: tz })),
    ]);
    const localDate = params.get("date") ?? site.today.localDate;
    const day = await unwrap(api.GET("/v1/sites/{siteId}/days/{localDate}", { params: { path: { siteId, localDate }, ...tz } }));
    return { site, config, day, localDate };
  }, [siteId, params]);
  if (state.status !== "ok") return <Page><Status state={state} retry={retry} /></Page>;
  const { site, config, day, localDate } = state.data;
  const approved = day.report?.status === "approved";
  const onSite = position && site.location ? meters(position, site.location) <= config.geofenceRadiusMeters : false;
  const [y = 0, m = 1, d = 1] = localDate.split("-").map(Number);
  const long = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, d)));
  const count = day.entries.length;

  async function open() {
    setError(null);
    if (day.report && approved) return router.push(`/rdo?id=${day.report.id}`);
    setBusy(true);
    try {
      const report = await unwrap(api.POST("/v1/sites/{siteId}/days/{localDate}/report", { params: { path: { siteId, localDate }, ...tz } }));
      router.push(`/rdo?id=${report.id}`);
    } catch (e) {
      setError(e instanceof ApiError ? e : new ApiError("UNAVAILABLE"));
      setBusy(false);
    }
  }

  return (
    <Page>
      <div className="flex flex-col gap-4 rounded-b-[28px] bg-[#2D2D2B] px-[18px] pb-[22px] pt-[18px] text-white">
        <div className="flex items-center justify-between">
          <Link href={`/obra?id=${siteId}`} aria-label="Voltar para a pasta da obra" className="flex size-11 items-center justify-center rounded-full bg-[#3A3A37]"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg></Link>
          {onSite && <span className="flex items-center gap-2 rounded-full bg-[#3A3A37] px-3 py-1.5 text-[13px] font-semibold"><span className="size-2 rounded-full bg-[#CCA6ED]" />No canteiro</span>}
          <Link href="/menu" aria-label="Abrir menu" className="flex size-11 items-center justify-center rounded-full bg-[#3A3A37]"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg></Link>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[13px] text-[#CFCFCB]">{`${long.replace("-feira", "").charAt(0).toUpperCase()}${long.replace("-feira", "").slice(1)} · ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`}</span>
          <h1 className="m-0 font-[family-name:var(--font-anybody)] text-[26px] font-bold leading-[1.15] tracking-[-0.02em]">{approved ? "RDO do dia" : "RDO de hoje"}</h1>
          <span className="text-[13px] text-[#CFCFCB]">{site.name}</span>
        </div>
      </div>
      <div className="flex flex-col gap-6 px-4 pb-[120px] pt-5">
        {day.openItems.length > 0 && (
          <section className="flex flex-col gap-2.5" aria-labelledby="mem">
            <div className="flex items-center gap-2.5 px-0.5">
              <span className="flex size-7 flex-none items-center justify-center rounded-full bg-[#EFE3FA]"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5B2E86" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg></span>
              <h2 id="mem" className="m-0 flex-1 text-[15px] font-semibold">Ficou dos dias anteriores</h2>
              <span className="text-[13px] text-[#5B5F6B]">{day.openItems.length} {day.openItems.length === 1 ? "item" : "itens"}</span>
            </div>
            <p className="m-0 px-0.5 text-[13px] leading-[1.45] text-[#5B5F6B]">O Argos pergunta pelos itens que você não citar antes de fechar o dia.</p>
            <ul className="m-0 list-none rounded-2xl border-[1.5px] border-[#CCA6ED] bg-white px-3.5 py-0.5">
              {day.openItems.map((i) => {
                const age = Math.max(0, Math.round((Date.parse(`${localDate}T00:00:00Z`) - Date.parse(`${i.openedOn}T00:00:00Z`)) / 86_400_000));
                const ageText = age <= 0 ? "hoje" : age === 1 ? "desde ontem" : `há ${age} dias`;
                const sub = [i.lastUpdate?.note, i.mentionedToday ? `citado às ${new Date(i.mentionedToday.capturedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : "não citado hoje"].filter(Boolean).join(" · ");
                return (
                  <li key={i.id} className="flex min-h-[60px] items-center gap-3 border-b border-[#E3E5EE] last:border-b-0">
                    <div className="flex flex-1 flex-col gap-0.5 py-2.5"><span className="text-[15px] font-medium">{i.title}</span><span className="text-[13px] text-[#5B5F6B]">{sub}</span></div>
                    <span className={`flex-none rounded-full px-[9px] py-1 text-xs font-semibold ${age >= config.openItemHighlightDays ? "bg-[#CCA6ED] text-[#2D2D2B]" : "bg-[#F4F5F9] text-[#5B5F6B]"}`}>{ageText}</span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
        {count > 0 && (
          <div className="flex flex-col gap-2">
            <button type="button" disabled={busy || !online} onClick={() => void open()} className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3.5 text-left shadow-[0_6px_18px_-14px_rgba(45,45,43,0.5)]">
              <div className="flex flex-1 flex-col gap-0.5"><span className="text-[15px] font-semibold">{approved ? "RDO aprovado" : "Pronto para fechar o dia?"}</span>
                <span className="text-[13px] text-[#5B5F6B]">{approved ? "Abra para consultar." : `O Argos monta o RDO com os ${count} ${count === 1 ? "registro" : "registros"} para você revisar.`}</span></div>
              <span className="flex-none rounded-full bg-[#1563FF] px-3.5 py-2.5 text-[13px] font-semibold text-white">{busy ? "Montando…" : approved ? "Ver RDO" : day.report ? "Revisar RDO" : "Gerar RDO"}</span>
            </button>
            {error && <ErrorAlert error={error} />}
          </div>
        )}
        <section className="flex flex-col gap-2.5" aria-labelledby="linha">
          <div className="flex items-baseline justify-between px-0.5"><h2 id="linha" className="m-0 text-[15px] font-semibold">Linha do dia</h2><span className="text-[13px] text-[#5B5F6B]">{count} {count === 1 ? "registro" : "registros"}</span></div>
          {count === 0 && <p className="m-0 rounded-2xl bg-white p-3.5 text-sm text-[#5B5F6B]">Nenhum registro ainda. Toque em Registrar para gravar o primeiro.</p>}
          <ol className="m-0 flex list-none flex-col p-0">
            {day.entries.map((e, i) => {
              const time = new Date(e.capturedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: e.timezone });
              const photo = e.photos.length > 0;
              return (
                <li key={e.id} className="relative flex gap-3 pb-3.5 last:pb-0">
                  {i < count - 1 && <span aria-hidden="true" className="absolute bottom-0 left-[17px] top-[38px] w-0.5 bg-[#DDE0EA]" />}
                  <Icon photo={photo && !e.audio} />
                  <div className="flex flex-1 flex-col gap-0.5 rounded-2xl bg-white px-3 py-2.5">
                    <div className="flex items-baseline justify-between gap-2"><span className="text-[15px] font-medium">{e.title ?? `Registro ${count - i}`}</span><span className="text-[13px] text-[#5B5F6B]">{time}</span></div>
                    <span className="text-[13px] text-[#5B5F6B]">{[e.audio ? `Áudio${e.audio.durationSeconds !== null ? ` · ${clock(e.audio.durationSeconds)}` : ""}` : null, photo ? `${e.photos.length} ${e.photos.length === 1 ? "foto" : "fotos"}` : null].filter(Boolean).join(" · ")}</span>
                    {e.offline && <span className="text-[13px] text-[#5B2E86]">Capturado sem internet</span>}
                    {e.openItemIds.length > 0 && <span className="text-[13px] text-[#5B2E86]">Atualiza um item em aberto</span>}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      </div>
      {site.status === "in_progress" && !approved && <MainNav active="none" registerHref={`/registro?id=${siteId}`} />}
    </Page>
  );
}
