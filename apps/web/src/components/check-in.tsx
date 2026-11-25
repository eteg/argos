"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, timezoneParams } from "@/lib/api";
import { deviceHeader, getPosition, type Position } from "@/lib/geo";
import { distanceLabel } from "@/lib/format";
import { unwrap, useLoad } from "@/lib/hooks";
import { Back, Page, Pill, Status, Title } from "@/components/ui";

const H = ({ children }: { children: React.ReactNode }) => <span className="px-1 pt-1 text-xs font-semibold text-[#5B5F6B]">{children}</span>;

export function CheckIn() {
  const [position, setPosition] = useState<Position | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => { void getPosition().then((p) => { setPosition(p); setReady(true); }); }, []);
  const [state, retry] = useLoad(async () => {
    if (!ready) return null;
    const [config, sites] = await Promise.all([
      unwrap(api.GET("/v1/config", { params: timezoneParams() })),
      unwrap(api.GET("/v1/sites", { params: { header: { ...timezoneParams().header, ...deviceHeader(position) } } })),
    ]);
    return { radius: config.geofenceRadiusMeters, sites: sites.items };
  }, [ready, position]);
  if (state.status !== "ok" || !state.data) return <Page><div className="p-5"><Back href="/" /></div><Status state={state.status === "ok" ? { status: "loading" } : state} retry={retry} /></Page>;
  const { radius, sites } = state.data;
  const here = sites.find((s) => s.distanceMeters !== null && s.distanceMeters <= radius && s.today.state !== "approved");
  const others = sites.filter((s) => s !== here && s.today.state !== "approved" && s.today.entriesCount === 0);
  const worked = sites.filter((s) => s !== here && s.today.state !== "approved" && s.today.entriesCount > 0);
  const approved = sites.filter((s) => s.today.state === "approved");
  const pending = sites.filter((s) => s.pendingDays.length > 0);
  const card = (s: (typeof sites)[number], hl: boolean) => (
    <Link key={s.id} href={`/registro?id=${s.id}`} className={`flex items-center gap-3 rounded-2xl bg-white p-3.5 ${hl ? "border-2 border-[#1563FF]" : "border border-[#E3E5EE]"}`}>
      <div className="flex flex-1 flex-col gap-0.5"><span className="text-[15px] font-semibold">{s.name}</span>
        <span className="text-xs text-[#5B5F6B]">{[distanceLabel(s.distanceMeters, radius), s.today.entriesCount ? `${s.today.entriesCount} registros hoje` : "nenhum registro hoje"].filter(Boolean).join(" · ")}</span></div>
      <Pill>{s.today.entriesCount ? "Em andamento" : "Pendente"}</Pill>
    </Link>
  );
  return (
    <Page>
      <div className="flex items-center gap-3 px-5 pb-3 pt-5"><Back href="/" label="Cancelar" /><Title>Registrar o dia</Title></div>
      <div className="flex flex-col gap-3 px-4 pb-8">
        <span className="px-1 text-[13px] text-[#5B5F6B]">Escolha a obra. Aparecem só as que ainda não têm o RDO de hoje aprovado.</span>
        {sites.length === 0 && <p className="text-sm">Nenhuma obra em andamento.</p>}
        {here && (<><H>Você está aqui</H>{card(here, true)}</>)}
        {worked.length > 0 && (<><H>Com registro hoje</H>{worked.map((s) => card(s, false))}</>)}
        {others.length > 0 && (<><H>Outras obras sem registro hoje</H>{others.map((s) => card(s, false))}</>)}
        {pending.length > 0 && (<><H>Pendentes · capturados sem internet</H>{pending.map((s) => (<div key={s.id} className="rounded-2xl border border-[#E3E5EE] bg-white p-3.5 text-[15px]"><b>{s.name}</b> · {s.pendingDays.length} dia(s)</div>))}</>)}
        {approved.map((s) => <div key={s.id} className="rounded-[14px] bg-[#E3E5EE] px-3.5 py-2.5 text-[13px] text-[#5B5F6B]">{s.name}: RDO de hoje já aprovado</div>)}
      </div>
    </Page>
  );
}
