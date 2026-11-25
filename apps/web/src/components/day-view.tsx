"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api, timezoneParams } from "@/lib/api";
import { clock, errorMessage, fullDate } from "@/lib/format";
import { getPosition, type Position } from "@/lib/geo";
import { useOnline } from "@/lib/online";
import { ApiError, unwrap, useLoad } from "@/lib/hooks";
import { Page, Status } from "@/components/ui";

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
  const [error, setError] = useState<string | null>(null);
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
      setError(errorMessage(e instanceof ApiError ? e.code : "UNAVAILABLE"));
      setBusy(false);
    }
  }

  return (
    <Page>
      <div className="flex flex-col gap-4 rounded-b-[28px] bg-[#2D2D2B] px-[18px] pb-[22px] pt-[18px] text-white">
        <div className="flex items-center justify-between">
          <Link href={`/obra?id=${siteId}`} aria-label="Voltar para a pasta da obra" className="flex size-11 items-center justify-center rounded-full bg-[#3A3A37]">←</Link>
          {onSite && <span className="flex items-center gap-2 rounded-full bg-[#3A3A37] px-3 py-1.5 text-[13px] font-semibold"><span className="size-2 rounded-full bg-[#CCA6ED]" />No canteiro</span>}
          <span className="size-11" />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[13px] text-[#CFCFCB]">{long.charAt(0).toUpperCase() + long.slice(1)}</span>
          <h1 className="m-0 font-[family-name:var(--font-anybody)] text-[26px] font-bold leading-[1.15] tracking-[-0.02em]">{approved ? "RDO do dia" : "RDO de hoje"}</h1>
          <span className="text-[13px] text-[#CFCFCB]">{site.name}</span>
        </div>
      </div>
      <div className="flex flex-col gap-6 px-4 pb-32 pt-5">
        {day.openItems.length > 0 && (
          <section className="flex flex-col gap-2.5" aria-labelledby="mem">
            <div className="flex items-center gap-2.5 px-0.5"><h2 id="mem" className="m-0 flex-1 text-[15px] font-semibold">Ficou dos dias anteriores</h2><span className="text-[13px] text-[#5B5F6B]">{day.openItems.length} itens</span></div>
            <ul className="m-0 list-none rounded-2xl border-[1.5px] border-[#CCA6ED] bg-white px-3.5 py-0.5">
              {day.openItems.map((i) => (
                <li key={i.id} className="flex min-h-[60px] items-center gap-3 border-b border-[#E3E5EE] last:border-b-0">
                  <div className="flex flex-1 flex-col gap-0.5 py-2.5"><span className="text-[15px] font-medium">{i.title}</span>
                    <span className="text-[13px] text-[#5B5F6B]">{i.mentionedToday ? `citado às ${new Date(i.mentionedToday.capturedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : "não citado hoje"}</span></div>
                  <span className="flex-none rounded-full bg-[#CCA6ED] px-2 py-1 text-xs font-semibold">desde {fullDate(i.openedOn)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
        {count > 0 && (
          <div className="flex flex-col gap-2">
            <button type="button" disabled={busy || !online} onClick={() => void open()} className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3.5 text-left shadow-sm">
              <div className="flex flex-1 flex-col gap-0.5"><span className="text-[15px] font-semibold">{approved ? "RDO aprovado" : "Pronto para fechar o dia?"}</span>
                <span className="text-[13px] text-[#5B5F6B]">{approved ? "Abra para consultar." : `O Argos monta o RDO com os ${count} ${count === 1 ? "registro" : "registros"} para você revisar.`}</span></div>
              <span className="flex-none rounded-full bg-[#1563FF] px-3.5 py-2.5 text-[13px] font-semibold text-white">{busy ? "Montando…" : approved ? "Ver RDO" : day.report ? "Revisar RDO" : "Gerar RDO"}</span>
            </button>
            {error && <div role="alert" className="rounded-xl bg-[#FFE9C7] p-3 text-sm text-[#6B3A00]">{error}</div>}
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
                <li key={e.id} className="relative flex gap-3 pb-3.5">
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
      {site.status === "in_progress" && !approved && (
        <nav aria-label="Registrar" className="fixed inset-x-0 bottom-0 mx-auto flex h-[88px] w-full max-w-[430px] items-start justify-center rounded-t-3xl bg-white shadow-[0_-8px_24px_-14px_rgba(45,45,43,0.35)]">
          <div className="flex flex-col items-center"><Link href={`/registro?id=${siteId}`} aria-label="Novo registro por voz ou foto" className="-mt-[26px] flex size-[68px] items-center justify-center rounded-full border-[5px] border-[#F4F5F9] bg-[#1563FF] shadow-lg">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg></Link>
            <span className="mt-1 text-xs font-semibold text-[#1563FF]">Registrar</span></div>
        </nav>
      )}
    </Page>
  );
}
