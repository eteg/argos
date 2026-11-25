"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import type { Schemas } from "@argos/contract";
import { api, timezoneParams } from "@/lib/api";
import { errorMessage, shortDate, statusLabel } from "@/lib/format";
import { useOnline } from "@/lib/online";
import { ApiError, unwrap, useLoad } from "@/lib/hooks";
import { Page, Primary, Sheet, Status } from "@/components/ui";

const hints: Record<Schemas["SiteStatus"], string> = {
  not_started: "A obra ainda não começou. Não aparece na hora de registrar o dia.",
  in_progress: "Aparece na hora de registrar o dia e recebe RDO.",
  paused: "Não aparece na hora de registrar. Para lançar RDO, volte para em andamento.",
  completed: "Não aparece na hora de registrar. Os RDOs ficam guardados para consulta.",
};

export function SiteStatus() {
  const router = useRouter();
  const online = useOnline();
  const siteId = useSearchParams().get("id") ?? "";
  const [state, retry] = useLoad(() => unwrap(api.GET("/v1/sites/{siteId}", { params: { path: { siteId }, ...timezoneParams() } })), [siteId]);
  const [picked, setChoice] = useState<Schemas["SiteStatus"] | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const site = state.status === "ok" ? state.data : null;
  const choice = picked ?? site?.status ?? null;
  if (!site || !choice) return <Page><Status state={state.status === "ok" ? { status: "loading" } : state} retry={retry} /></Page>;

  const openDays = [
    ...site.pendingDays.map((d) => ({ localDate: d.localDate, entriesCount: d.entriesCount })),
    ...(site.today.entriesCount > 0 ? [{ localDate: site.today.localDate, entriesCount: site.today.entriesCount }] : []),
  ];
  const blocked = choice === "completed" && openDays.length > 0;

  async function save() {
    setError(null);
    try {
      await unwrap(api.PUT("/v1/sites/{siteId}/status", { params: { path: { siteId }, ...timezoneParams() }, body: { status: choice! } }));
      router.push(`/obra?id=${siteId}`);
    } catch (e) {
      setError(e instanceof ApiError ? e : new ApiError("UNAVAILABLE"));
    }
  }

  return (
    <Sheet closeHref={`/obra?id=${siteId}`}>
      <div className="flex flex-col gap-3.5">
        <div className="flex flex-col gap-1 px-1">
          <h1 className="m-0 font-[family-name:var(--font-anybody)] text-2xl font-extrabold">Status da obra</h1>
          <span className="text-[13px] text-[#5B5F6B]">{site.name} · hoje {statusLabel[site.status].toLowerCase()}</span>
        </div>
        <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
          <legend className="mb-2 px-1 text-[13px] text-[#5B5F6B]">Mudar para</legend>
          {(Object.keys(statusLabel) as Schemas["SiteStatus"][]).map((s) => (
            <label key={s} className={`flex cursor-pointer items-start gap-3 rounded-2xl bg-white p-3.5 ${choice === s ? "border-2 border-[#1563FF]" : "border-[1.5px] border-[#DDE0EA]"}`}>
              <input type="radio" name="status" className="sr-only" checked={choice === s} onChange={() => setChoice(s)} />
              <span className={`mt-px size-[22px] flex-none rounded-full box-border ${choice === s ? "border-[7px] border-[#1563FF]" : "border-2 border-[#9AA3B8]"}`} />
              <span className="flex flex-col gap-0.5"><span className="text-[15px] font-semibold">{statusLabel[s]}</span><span className="text-[13px] leading-[1.45] text-[#5B5F6B]">{hints[s]}</span></span>
            </label>
          ))}
        </fieldset>
        {blocked && (
          <div className="flex flex-col gap-1 rounded-[14px] bg-white px-3.5 py-3">
            <span className="text-[15px] font-semibold">Falta finalizar {openDays.length} RDO para concluir</span>
            <span className="text-[13px] text-[#5B5F6B]">A obra só pode ser concluída sem RDO em aberto.</span>
            {openDays.map((d) => (
              <Link key={d.localDate} href={`/dia?id=${siteId}&date=${d.localDate}`} className="flex items-start gap-2.5 pt-2.5 text-[#2D2D2B]">
                <svg className="mt-px flex-none" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5B5F6B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16.5v.1" /></svg>
                <span className="flex flex-col gap-0.5">
                  <span className="text-[15px]">{d.localDate === site.today.localDate ? `RDO de hoje, ${shortDate(d.localDate)}` : `RDO de ${shortDate(d.localDate)}`}</span>
                  <span className="text-[13px] text-[#5B5F6B]">{d.entriesCount} {d.entriesCount === 1 ? "registro" : "registros"} · ainda não finalizado</span>
                </span>
              </Link>
            ))}
          </div>
        )}
        {error && <div role="alert" className="rounded-xl bg-[#FFE9C7] p-3 text-sm text-[#6B3A00]">{errorMessage(error.code)}</div>}
        <div className="mt-auto flex flex-col gap-2">
          <Primary disabled={!online || blocked || choice === site.status} onClick={() => void save()}>{choice === "completed" ? "Concluir obra" : "Salvar status"}</Primary>
          <Link href={`/obra?id=${siteId}`} className="flex min-h-11 items-center justify-center text-[15px] font-semibold">Cancelar</Link>
        </div>
      </div>
    </Sheet>
  );
}
