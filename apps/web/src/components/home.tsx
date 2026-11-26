"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Schemas } from "@argos/contract";
import { api, timezoneParams } from "@/lib/api";
import { deviceHeader, getPosition, type Position } from "@/lib/geo";
import { dayStateLabel, distanceLabel, firstName, greeting } from "@/lib/format";
import { unwrap, useLoad } from "@/lib/hooks";
import { MainNav } from "@/components/main-nav";
import { Page, Status } from "@/components/ui";

type Site = Schemas["SiteSummary"];
type Filter = "near" | "todo" | "all";

const NEAR_METERS = 15_000;

function mapLabel(sites: Site[]) {
  const near = sites.filter((s) => s.distanceMeters !== null && s.distanceMeters <= NEAR_METERS).length;
  if (near > 0) return `${near} ${near === 1 ? "obra" : "obras"} em até 15 km`;
  return `${sites.length} ${sites.length === 1 ? "obra" : "obras"} em andamento`;
}

function nearestName(sites: Site[]) {
  const first = sites.find((s) => s.distanceMeters !== null) ?? sites[0];
  return first ? (first.name.split(" · ")[0] ?? first.name) : "";
}

const pending = (s: Site) => s.today.state !== "approved" || s.pendingDays.length > 0;

const pinPath = "M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z";

const stateBadge: Record<string, string> = {
  no_entries: "bg-[#EFE3FA] text-[#5B2E86]",
  in_progress: "bg-[#EFE3FA] text-[#5B2E86]",
  draft: "bg-[#EFE3FA] text-[#5B2E86]",
  approved: "bg-[#E3ECFF] text-[#0B3699]",
};

function SiteCard({ site, radius, primary }: { site: Site; radius: number; primary: boolean }) {
  const badge = primary ? "bg-[#CCA6ED] text-[#2D2D2B]" : (stateBadge[site.today.state] ?? stateBadge.no_entries);
  return (
    <Link href={`/obra?id=${site.id}`} className={`flex w-[214px] flex-none flex-col overflow-hidden rounded-[18px] shadow-[0_8px_20px_-14px_rgba(45,45,43,0.45)] ${primary ? "bg-[#2D2D2B] text-white" : "bg-white text-[#2D2D2B]"}`}>
      <div className={`box-border flex h-[74px] items-end px-2.5 py-2 ${primary ? "bg-[#3A3A37]" : "bg-[#DCDFE8]"}`}>
        <span className={`rounded-full px-2 py-[3px] text-[11px] font-semibold ${badge}`}>{dayStateLabel[site.today.state]}</span>
      </div>
      <div className="flex flex-col gap-0.5 px-3 pb-3 pt-2.5">
        <span className="font-[family-name:var(--font-anybody)] text-[15px] font-bold">{site.name}</span>
        <span className={`text-xs ${primary ? "text-[#CFCFCB]" : "text-[#5B5F6B]"}`}>{distanceLabel(site.distanceMeters, radius) ?? site.address}</span>
      </div>
    </Link>
  );
}

function Pin({ color, className = "" }: { color: string; className?: string }) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={pinPath} />
      <circle cx="12" cy="9.5" r="2.5" />
    </svg>
  );
}

function MapPreview({ label, siteName }: { label: string; siteName: string }) {
  return (
    <div className="relative mx-4 h-[168px] overflow-hidden rounded-[18px] bg-[#DCE3F0]" aria-hidden="true">
      <div className="absolute inset-x-0 top-[70px] h-3.5 bg-[#F4F5F9]" />
      <div className="absolute inset-y-0 left-[150px] w-3 bg-[#F4F5F9]" />
      <div className="absolute inset-y-0 left-[270px] w-2 rotate-[18deg] bg-[#EEF1F7]" />
      <div className="absolute left-2.5 top-[104px] h-11 w-[120px] rounded-[10px] bg-[#CFE0D2]" />
      <div className="absolute left-[140px] top-[60px] flex size-[34px] items-center justify-center rounded-full bg-[rgba(21,99,255,0.18)]">
        <span className="box-border size-3.5 rounded-full border-[3px] border-white bg-[#1563FF]" />
      </div>
      <div className="absolute left-[176px] top-7 flex flex-col items-center">
        <span className="max-w-[120px] truncate rounded-lg bg-[#2D2D2B] px-[7px] py-[3px] text-[11px] font-semibold text-white">{siteName}</span>
        <Pin color="#2D2D2B" />
      </div>
      <Pin color="#7A3FB3" className="absolute left-9 top-5" />
      <Pin color="#1563FF" className="absolute left-[290px] top-[100px]" />
      <span className="absolute bottom-2.5 left-2.5 rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-[#2D2D2B]">{label}</span>
    </div>
  );
}

export function Home() {
  const [position, setPosition] = useState<Position | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("near");

  useEffect(() => {
    void getPosition().then(setPosition);
  }, []);

  const [state, retry] = useLoad(
    async () => {
      const [me, config, sites, away] = await Promise.all([
        unwrap(api.GET("/v1/me", { params: { header: timezoneParams().header } })),
        unwrap(api.GET("/v1/config", { params: timezoneParams() })),
        unwrap(api.GET("/v1/sites", { params: { header: { ...timezoneParams().header, ...deviceHeader(position) }, query: search ? { search } : {} } })),
        unwrap(api.GET("/v1/sites", { params: { header: timezoneParams().header, query: { status: "not_started,paused,completed" } } })),
      ]);
      return { me, config, sites: sites.items, awayCount: away.items.length };
    },
    [position, search],
  );

  const data = state.status === "ok" ? state.data : null;
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setSearch(debounced), 300);
    return () => clearTimeout(t);
  }, [debounced]);

  const todo = data?.sites.filter(pending) ?? [];
  const chips: { id: Filter | "away"; label: string }[] = [
    { id: "near", label: "Perto de mim" },
    { id: "todo", label: `RDOs a fazer · ${todo.length}` },
    { id: "all", label: "Todas" },
  ];

  return (
    <Page>
      <div className="flex items-center gap-2.5 px-[18px] pt-[18px]">
        <Link href="/menu" aria-label="Abrir menu" className="flex size-11 items-center justify-center rounded-full bg-white shadow-[0_4px_14px_-8px_rgba(45,45,43,0.35)]">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2D2D2B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
        </Link>
        <span className="flex-1 font-[family-name:var(--font-anybody)] text-xl font-extrabold text-[#1563FF]">Argos</span>
        <Link href="/obras/nova" className="flex h-11 items-center gap-1.5 rounded-full bg-[#E3ECFF] px-3.5 text-[13px] font-semibold text-[#0B3699]">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0B3699" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
          Nova obra
        </Link>
        <span className="flex size-11 items-center justify-center rounded-full bg-[#CCA6ED] text-sm font-bold text-[#2D2D2B]">{data ? data.me.name.split(" ").map((p) => p[0]).slice(0, 2).join("") : ""}</span>
      </div>
      <div className="flex flex-1 flex-col gap-3.5 pb-[120px] pt-3.5">
        <div className="flex flex-col gap-0.5 px-5">
          <p className="m-0 text-[13px] text-[#5B5F6B]">{data ? `${greeting()}, ${firstName(data.me.name)}` : greeting()}</p>
          <h1 className="m-0 font-[family-name:var(--font-anybody)] text-[26px] font-extrabold tracking-[-0.02em]">Suas obras hoje</h1>
        </div>
        <div className="px-4">
          <label className="sr-only" htmlFor="busca">Buscar obra</label>
          <div className="flex h-12 items-center gap-2.5 rounded-[14px] border border-[#DDE0EA] bg-white px-3.5">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5B5F6B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></svg>
            <input id="busca" value={debounced} onChange={(e) => setDebounced(e.target.value)} placeholder="Buscar obra, endereço ou cliente" className="min-w-0 flex-1 border-0 bg-transparent text-sm text-[#2D2D2B] outline-none" />
          </div>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto px-4 py-0.5">
          {chips.map((c) => (
            <button key={c.id} type="button" onClick={() => setFilter(c.id as Filter)} className={`box-border inline-flex h-10 flex-none items-center rounded-full border px-4 text-[13px] leading-none ${filter === c.id ? "border-[#2D2D2B] bg-[#2D2D2B] font-semibold text-white" : "border-[#DDE0EA] bg-white font-medium text-[#2D2D2B]"}`}>{c.label}</button>
          ))}
          <Link href="/obras/fora-de-andamento" className="box-border inline-flex h-10 flex-none items-center rounded-full border border-[#DDE0EA] bg-white px-4 text-[13px] font-medium leading-none text-[#2D2D2B]">Fora de andamento · {data?.awayCount ?? 0}</Link>
        </div>
        {state.status !== "ok" && <Status state={state} retry={retry} />}
        {data && data.sites.length === 0 && <p className="px-5 text-sm text-[#5B5F6B]">Nenhuma obra em andamento. Cadastre a primeira em “Nova obra”.</p>}
        {data && data.sites.length > 0 && <MapPreview label={mapLabel(data.sites)} siteName={nearestName(data.sites)} />}
        {data && filter !== "todo" && data.sites.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between px-5">
              <span className="font-[family-name:var(--font-anybody)] text-[17px] font-bold">Perto de você</span>
              <button type="button" onClick={() => setFilter("all")} className="text-[13px] font-semibold text-[#1563FF]">Ver todas</button>
            </div>
            <div className="flex gap-2.5 overflow-x-auto px-4 pb-3.5 pt-0.5">
              {data.sites.map((s, i) => (
                <SiteCard key={s.id} site={s} radius={data.config.geofenceRadiusMeters} primary={i === 0 && s.distanceMeters !== null} />
              ))}
            </div>
          </div>
        )}
        {data && todo.length > 0 && (
          <div className="flex flex-col gap-2 px-4">
            <span className="px-1 font-[family-name:var(--font-anybody)] text-[17px] font-bold">RDOs a fazer</span>
            <div className="rounded-[18px] bg-white px-3.5 py-0.5 shadow-[0_8px_20px_-14px_rgba(45,45,43,0.35)]">
              {todo.flatMap((s) => [
                ...(s.pendingDays.length > 0
                  ? [{ key: `${s.id}-p`, title: `${s.name} · ${s.pendingDays.length} ${s.pendingDays.length === 1 ? "dia" : "dias"}`, sub: s.pendingDays.every((d) => d.offline) ? "Capturados sem internet, falta finalizar" : "Dias anteriores sem RDO aprovado, falta finalizar", dot: "bg-[#1563FF]", badge: "bg-[#1563FF] px-2.5 py-1 text-white", label: "Finalizar", href: "/dias-anteriores" }]
                  : []),
                ...(s.today.state !== "approved"
                  ? [{ key: s.id, title: s.name, sub: s.today.state === "no_entries" ? "RDO de hoje ainda não começou" : "RDO de hoje em andamento", dot: "bg-[#A673D6]", badge: "bg-[#EFE3FA] px-2 py-[3px] text-[#5B2E86]", label: "Hoje", href: `/obra?id=${s.id}` }]
                  : []),
              ]).map((row) => (
                <Link key={row.key} href={row.href} className="flex min-h-14 items-center gap-3 border-b border-[#E3E5EE] text-[#2D2D2B] last:border-b-0">
                  <span className={`size-2.5 flex-none rounded-full ${row.dot}`} />
                  <div className="flex flex-1 flex-col"><span className="text-sm font-semibold">{row.title}</span><span className="text-xs text-[#5B5F6B]">{row.sub}</span></div>
                  <span className={`flex-none rounded-full text-[11px] font-semibold ${row.badge}`}>{row.label}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
      <MainNav active="home" variant="home" />
    </Page>
  );
}
