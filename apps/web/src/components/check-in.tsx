"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, timezoneParams } from "@/lib/api";
import { deviceHeader, getPosition, type Position } from "@/lib/geo";
import { distanceLabel } from "@/lib/format";
import { unwrap, useLoad } from "@/lib/hooks";
import { Back, Page, Sheet, Status } from "@/components/ui";

const H = ({ children }: { children: React.ReactNode }) => <span className="px-1 pt-1 text-xs font-semibold text-[#5B5F6B]">{children}</span>;

export function CheckIn() {
  const [position, setPosition] = useState<Position | null>(null);
  useEffect(() => { void getPosition().then(setPosition); }, []);
  const [state, retry] = useLoad(async () => {
    const [config, sites] = await Promise.all([
      unwrap(api.GET("/v1/config", { params: timezoneParams() })),
      unwrap(api.GET("/v1/sites", { params: { header: { ...timezoneParams().header, ...deviceHeader(position) } } })),
    ]);
    return { radius: config.geofenceRadiusMeters, sites: sites.items };
  }, [position]);
  if (state.status !== "ok" || !state.data) return <Page><div className="p-5"><Back href="/" /></div><Status state={state.status === "ok" ? { status: "loading" } : state} retry={retry} /></Page>;
  const { radius, sites } = state.data;
  const here = sites.find((s) => s.distanceMeters !== null && s.distanceMeters <= radius && s.today.state !== "approved");
  const others = sites.filter((s) => s !== here && s.today.state !== "approved" && s.today.entriesCount === 0);
  const worked = sites.filter((s) => s !== here && s.today.state !== "approved" && s.today.entriesCount > 0);
  const approved = sites.filter((s) => s.today.state === "approved");
  const pending = sites.filter((s) => s.pendingDays.length > 0);
  const card = (s: (typeof sites)[number], hl: boolean) => (
    <Link key={s.id} href={`/registro?id=${s.id}`} className={`flex items-center gap-3 rounded-2xl bg-white p-3.5 ${hl ? "border-2 border-[#1563FF]" : "border border-[#E3E5EE]"}`}>
      <span className={`flex size-[42px] flex-none items-center justify-center rounded-xl ${hl ? "bg-[#1563FF]" : "bg-[#F4F5F9]"}`}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={hl ? "#FFFFFF" : "#1563FF"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></svg>
      </span>
      <div className="flex flex-1 flex-col gap-0.5"><span className="text-[15px] font-semibold">{s.name}</span>
        <span className="text-xs text-[#5B5F6B]">{[distanceLabel(s.distanceMeters, radius), s.today.entriesCount ? `${s.today.entriesCount} ${s.today.entriesCount === 1 ? "registro" : "registros"} hoje` : "nenhum registro hoje"].filter(Boolean).join(" · ")}</span></div>
      <span className="rounded-full bg-[#EFE3FA] px-2 py-[3px] text-[11px] font-semibold text-[#5B2E86]">{s.today.entriesCount ? "Em andamento" : "Pendente"}</span>
    </Link>
  );
  return (
    <Sheet closeHref="/">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1 px-1 pt-1">
          <h1 className="m-0 font-[family-name:var(--font-anybody)] text-2xl font-extrabold tracking-[-0.02em]">Registrar o dia</h1>
          <span className="text-[13px] text-[#5B5F6B]">Escolha a obra. Aparecem só as que ainda não têm o RDO de hoje aprovado.</span>
        </div>
        {sites.length === 0 && <p className="text-sm">Nenhuma obra em andamento.</p>}
        {here && (<><H>Você está aqui</H>{card(here, true)}</>)}
        {worked.length > 0 && (<><H>Com registro hoje</H>{worked.map((s) => card(s, false))}</>)}
        {others.length > 0 && (<><H>Outras obras sem registro hoje</H>{others.map((s) => card(s, false))}</>)}
        {pending.length > 0 && (<><H>Pendentes · capturados sem internet</H>{pending.map((s) => (<Link key={s.id} href="/dias-anteriores" className="flex items-center gap-3 rounded-2xl border border-[#E3E5EE] bg-white p-3.5"><span className="flex size-[42px] flex-none items-center justify-center rounded-xl bg-[#E3ECFF]"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1563FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 18a4.5 4.5 0 0 1-.6-9 6 6 0 0 1 11.4 1.5A3.8 3.8 0 0 1 17.5 18z" /><path d="M12 11v5M9.8 13.8L12 16l2.2-2.2" /></svg></span><div className="flex flex-1 flex-col gap-0.5"><span className="text-[15px] font-semibold">{s.name} · {s.pendingDays.length} {s.pendingDays.length === 1 ? "dia" : "dias"}</span><span className="text-xs text-[#5B5F6B]">{s.pendingDays.map((d) => d.localDate.slice(8) + "/" + d.localDate.slice(5, 7)).join(" e ")} · prontos para finalizar</span></div><span className="rounded-full bg-[#1563FF] px-2.5 py-1 text-[11px] font-semibold text-white">Finalizar</span></Link>))}</>)}
        {approved.map((s) => <div key={s.id} className="flex items-center gap-2.5 rounded-[14px] bg-[#E3E5EE] px-3.5 py-2.5 text-[13px] text-[#5B5F6B]"><svg className="flex-none" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5B5F6B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M8.5 12.5l2.5 2.5 4.5-5" /></svg><span className="flex-1">{s.name}: RDO de hoje já aprovado</span></div>)}
        <Link href="/" className="mt-1 flex min-h-12 items-center justify-center rounded-[14px] border-2 border-[#2D2D2B] text-[15px] font-semibold">Cancelar</Link>
      </div>
    </Sheet>
  );
}
