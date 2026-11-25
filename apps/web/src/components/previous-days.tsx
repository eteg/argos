"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, timezoneParams } from "@/lib/api";
import { errorMessage, shortDate } from "@/lib/format";
import { deviceHeader, getPosition, type Position } from "@/lib/geo";
import { ApiError, unwrap, useLoad } from "@/lib/hooks";
import { listQueue, type QueuedEntry } from "@/lib/offline-queue";
import { useOnline } from "@/lib/online";
import { retryFailed } from "@/lib/send-entry";
import { Page, Pill, Status } from "@/components/ui";

const tz = timezoneParams();
const CalendarIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2.5" /><path d="M4 10h16M9 3v4M15 3v4" /></svg>
);
const LockIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5B5F6B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
);
const yesterdayIso = () => new Intl.DateTimeFormat("en-CA", { timeZone: tz.header["X-Timezone"] }).format(new Date(Date.now() - 86_400_000));
const weekday = (iso: string) => {
  const [y = 0, m = 1, d = 1] = iso.split("-").map(Number);
  const day = new Intl.DateTimeFormat("pt-BR", { weekday: "short", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, d))).replace(".", "");
  return day.charAt(0).toUpperCase() + day.slice(1);
};

export function PreviousDays() {
  const router = useRouter();
  const online = useOnline();
  const [position, setPosition] = useState<Position | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [queue, setQueue] = useState<QueuedEntry[]>([]);

  useEffect(() => {
    void getPosition().then((p) => {
      setPosition(p);
      setReady(true);
    });
  }, []);
  useEffect(() => {
    const refresh = () => void listQueue().then(setQueue, () => setQueue([]));
    const first = setTimeout(refresh, 0);
    window.addEventListener("argos:queue-changed", refresh);
    return () => {
      clearTimeout(first);
      window.removeEventListener("argos:queue-changed", refresh);
    };
  }, []);

  const [state, retry] = useLoad(async () => {
    if (!ready) return null;
    return unwrap(api.GET("/v1/pending-days", { params: { header: { ...tz.header, ...deviceHeader(position) } } }));
  }, [ready, position]);

  async function open(siteId: string, localDate: string) {
    setError(null);
    setBusy(`${siteId}|${localDate}`);
    try {
      const report = await unwrap(api.POST("/v1/sites/{siteId}/days/{localDate}/report", { params: { path: { siteId, localDate }, ...tz } }));
      router.push(`/rdo?id=${report.id}`);
    } catch (e) {
      const code = e instanceof ApiError ? e.code : "UNAVAILABLE";
      setError(code === "PREVIOUS_DAY_PENDING" ? "Falta fechar um dia anterior desta obra antes deste." : errorMessage(code));
      setBusy(null);
    }
  }

  const waiting = queue.filter((i) => !i.error);
  const failed = queue.filter((i) => i.error);

  return (
    <Page>
      <div className="flex flex-1 flex-col justify-end bg-[#8E9099]">
        <Link href="/" aria-label="Fechar" className="min-h-10 flex-1" />
        <div className="flex flex-col gap-3 rounded-t-[28px] bg-[#F4F5F9] px-4 pb-[26px] pt-2.5">
          <span className="h-[5px] w-11 self-center rounded-[3px] bg-[#CDD1DD]" aria-hidden="true" />
          <div className="flex flex-col gap-1 px-1 pt-1">
            <h1 className="m-0 font-[family-name:var(--font-anybody)] text-2xl font-extrabold tracking-[-0.02em]">Registrar dia anterior</h1>
            <span className="text-[13px] text-[#5B5F6B]">Estes dias ficaram sem RDO. Em cada obra, os dias são fechados em ordem, do mais antigo para o mais novo.</span>
          </div>
          {!online && <div role="status" className="rounded-[14px] bg-[#FFE9C7] px-3.5 py-2.5 text-[13px] text-[#6B3A00]">Sem internet: dá para ver a lista, mas gerar o RDO precisa de internet.</div>}
          {waiting.length > 0 && (
            <div className="flex flex-col gap-1 rounded-[14px] bg-[#E3ECFF] px-3.5 py-2.5 text-[13px] text-[#0B3699]">
              <span className="font-semibold">{waiting.length} {waiting.length === 1 ? "registro guardado" : "registros guardados"} no celular</span>
              <span>Sobem sozinhos quando a internet voltar.</span>
            </div>
          )}
          {failed.length > 0 && (
            <div role="alert" className="flex flex-col gap-2 rounded-[14px] bg-[#FFE9C7] px-3.5 py-2.5 text-[13px] text-[#6B3A00]">
              <span>{failed.length} {failed.length === 1 ? "registro não foi aceito" : "registros não foram aceitos"} ({[...new Set(failed.map((f) => errorMessage(f.error ?? "")))].join(" ")})</span>
              <button type="button" disabled={!online} onClick={() => void retryFailed()} className="min-h-11 self-start rounded-xl border-[1.5px] border-[#6B3A00] px-3 font-semibold disabled:opacity-50">Tentar de novo</button>
            </div>
          )}
          {state.status !== "ok" || !state.data ? (
            <Status state={state.status === "ok" ? { status: "loading" } : state} retry={retry} />
          ) : state.data.items.length === 0 ? (
            <p className="m-0 rounded-2xl bg-white p-3.5 text-sm text-[#5B5F6B]">Nenhum dia anterior ficou sem RDO.</p>
          ) : (
            state.data.items.map((group) => (
              <section key={group.site.id} className="flex flex-col gap-3" aria-label={group.site.name}>
                <span className="px-1 pt-1 text-xs font-semibold text-[#5B5F6B]">{group.site.name} · {group.days.length} {group.days.length === 1 ? "dia" : "dias"} na fila</span>
                {group.days.map((d, i) => {
                  const detail = [d.offline ? "Capturado sem internet" : null, `${d.audiosCount} ${d.audiosCount === 1 ? "áudio" : "áudios"}`, `${d.photosCount} ${d.photosCount === 1 ? "foto" : "fotos"}`].filter(Boolean).join(" · ");
                  const label = d.localDate === yesterdayIso() ? `Ontem · ${weekday(d.localDate).toLowerCase()}, ${shortDate(d.localDate)}` : `${weekday(d.localDate)}, ${shortDate(d.localDate)}`;
                  if (!d.isNext) {
                    const before = group.days[i - 1];
                    return (
                      <div key={d.localDate} aria-disabled="true" className="flex items-center gap-3 rounded-2xl border border-dashed border-[#CDD1DD] bg-[#EEF0F5] p-3.5 text-[#5B5F6B]">
                        <span className="flex size-[42px] flex-none items-center justify-center rounded-xl bg-[#E3E5EE]"><LockIcon /></span>
                        <div className="flex flex-1 flex-col gap-0.5"><span className="text-[15px] font-semibold text-[#2D2D2B]">{label}</span><span className="text-xs">Libera depois de aprovar o RDO de {before ? shortDate(before.localDate) : "dia anterior"}</span></div>
                        <Pill tone="gray">Na fila</Pill>
                      </div>
                    );
                  }
                  const key = `${group.site.id}|${d.localDate}`;
                  return (
                    <button key={d.localDate} type="button" disabled={!online || busy !== null} onClick={() => void open(group.site.id, d.localDate)} className="flex items-center gap-3 rounded-2xl border-2 border-[#1563FF] bg-white p-3.5 text-left disabled:opacity-60">
                      <span className="flex size-[42px] flex-none items-center justify-center rounded-xl bg-[#1563FF]"><CalendarIcon /></span>
                      <div className="flex flex-1 flex-col gap-0.5"><span className="text-[15px] font-semibold">{label}</span><span className="text-xs text-[#5B5F6B]">{detail}</span></div>
                      <Pill tone="blue">{busy === key ? "Montando…" : "Próximo"}</Pill>
                    </button>
                  );
                })}
              </section>
            ))
          )}
          {error && <div role="alert" className="rounded-xl bg-[#FFE9C7] p-3 text-sm text-[#6B3A00]">{error}</div>}
          <div className="flex items-center gap-2.5 rounded-[14px] bg-[#E3E5EE] px-3.5 py-2.5 text-[13px] text-[#45484F]">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#45484F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="flex-none"><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>
            <span className="flex-1">O RDO sai com a data da captura, e as pendências passam para o dia seguinte da fila.</span>
          </div>
          <Link href="/" className="mt-1 rounded-[14px] border-2 border-[#2D2D2B] p-3.5 text-center text-[15px] font-semibold">Cancelar</Link>
        </div>
      </div>
    </Page>
  );
}
