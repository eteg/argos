"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Schemas } from "@argos/contract";
import { api, timezoneParams } from "@/lib/api";
import { deviceHeader, getPosition, type Position } from "@/lib/geo";
import { dayStateLabel, distanceLabel, firstName, greeting } from "@/lib/format";
import { unwrap, useLoad } from "@/lib/hooks";
import { Page, Pill, Status, Title } from "@/components/ui";

type Site = Schemas["SiteSummary"];
type Filter = "near" | "todo" | "all";

const pending = (s: Site) => s.today.state !== "approved" || s.pendingDays.length > 0;

function SiteCard({ site, radius, primary }: { site: Site; radius: number; primary: boolean }) {
  return (
    <Link href={`/obra?id=${site.id}`} className={`flex w-[214px] flex-none flex-col overflow-hidden rounded-[18px] shadow-sm ${primary ? "bg-[#2D2D2B] text-white" : "bg-white"}`}>
      <div className={`flex h-[74px] items-end p-2.5 ${primary ? "bg-[#3A3A37]" : "bg-[#DCDFE8]"}`}>
        <Pill tone={site.today.state === "approved" ? "blue" : "purple"}>{dayStateLabel[site.today.state]}</Pill>
      </div>
      <div className="flex flex-col gap-0.5 px-3 pb-3 pt-2.5">
        <span className="font-[family-name:var(--font-anybody)] text-[15px] font-bold">{site.name}</span>
        <span className={`text-xs ${primary ? "text-[#CFCFCB]" : "text-[#5B5F6B]"}`}>{distanceLabel(site.distanceMeters, radius) ?? site.address}</span>
      </div>
    </Link>
  );
}

export function Home() {
  const [position, setPosition] = useState<Position | null>(null);
  const [ready, setReady] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("near");

  useEffect(() => {
    void getPosition().then((p) => {
      setPosition(p);
      setReady(true);
    });
  }, []);

  const [state, retry] = useLoad(
    async () => {
      if (!ready) return null;
      const [me, config, sites, away] = await Promise.all([
        unwrap(api.GET("/v1/me", { params: { header: timezoneParams().header } })),
        unwrap(api.GET("/v1/config", { params: timezoneParams() })),
        unwrap(api.GET("/v1/sites", { params: { header: { ...timezoneParams().header, ...deviceHeader(position) }, query: search ? { search } : {} } })),
        unwrap(api.GET("/v1/sites", { params: { header: timezoneParams().header, query: { status: "not_started,paused,completed" } } })),
      ]);
      return { me, config, sites: sites.items, awayCount: away.items.length };
    },
    [ready, position, search],
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
        <span className="flex-1 font-[family-name:var(--font-anybody)] text-xl font-extrabold text-[#1563FF]">Argos</span>
        <Link href="/obras/nova" className="flex h-11 items-center gap-1.5 rounded-full bg-[#E3ECFF] px-3.5 text-[13px] font-semibold text-[#0B3699]">+ Nova obra</Link>
        {data && <span className="flex size-11 items-center justify-center rounded-full bg-[#CCA6ED] text-sm font-bold">{data.me.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}</span>}
      </div>
      <div className="flex flex-1 flex-col gap-3.5 pb-32 pt-3.5">
        <div className="flex flex-col gap-0.5 px-5">
          <p className="m-0 text-[13px] text-[#5B5F6B]">{data ? `${greeting()}, ${firstName(data.me.name)}` : greeting()}</p>
          <Title>Suas obras hoje</Title>
        </div>
        <div className="px-4">
          <label className="sr-only" htmlFor="busca">Buscar obra</label>
          <input id="busca" value={debounced} onChange={(e) => setDebounced(e.target.value)} placeholder="Buscar obra" className="h-12 w-full rounded-[14px] border border-[#DDE0EA] bg-white px-3.5 text-sm" />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto px-4 py-0.5">
          {chips.map((c) => (
            <button key={c.id} type="button" onClick={() => setFilter(c.id as Filter)} className={`h-10 flex-none rounded-full border px-4 text-[13px] ${filter === c.id ? "border-[#2D2D2B] bg-[#2D2D2B] font-semibold text-white" : "border-[#DDE0EA] bg-white font-medium"}`}>{c.label}</button>
          ))}
          <Link href="/obras/fora-de-andamento" className="flex h-10 flex-none items-center rounded-full border border-[#DDE0EA] bg-white px-4 text-[13px] font-medium">Fora de andamento · {data?.awayCount ?? 0}</Link>
        </div>
        {state.status !== "ok" && <Status state={state} retry={retry} />}
        {data && data.sites.length === 0 && <p className="px-5 text-sm text-[#5B5F6B]">Nenhuma obra em andamento. Cadastre a primeira em “Nova obra”.</p>}
        {data && filter !== "todo" && data.sites.length > 0 && (
          <div className="flex gap-2.5 overflow-x-auto px-4 pb-3.5">
            {data.sites.map((s, i) => (
              <SiteCard key={s.id} site={s} radius={data.config.geofenceRadiusMeters} primary={i === 0 && s.distanceMeters !== null} />
            ))}
          </div>
        )}
        {data && todo.length > 0 && (
          <div className="flex flex-col gap-2 px-4">
            <span className="px-1 font-[family-name:var(--font-anybody)] text-[17px] font-bold">RDOs a fazer</span>
            <div className="rounded-[18px] bg-white px-3.5 py-0.5 shadow-sm">
              {todo.flatMap((s) => [
                ...(s.pendingDays.length > 0
                  ? [{ key: `${s.id}-p`, title: `${s.name} · ${s.pendingDays.length} ${s.pendingDays.length === 1 ? "dia" : "dias"}`, sub: "Capturados sem internet, falta finalizar", pill: <Pill tone="solid">Finalizar</Pill>, id: s.id }]
                  : []),
                ...(s.today.state !== "approved"
                  ? [{ key: s.id, title: s.name, sub: s.today.state === "no_entries" ? "RDO de hoje ainda não começou" : "RDO de hoje em andamento", pill: <Pill>Hoje</Pill>, id: s.id }]
                  : []),
              ]).map((row) => (
                <Link key={row.key} href={`/obra?id=${row.id}`} className="flex min-h-14 items-center gap-3 border-b border-[#E3E5EE] last:border-b-0">
                  <span className="size-2.5 flex-none rounded-full bg-[#A673D6]" />
                  <div className="flex flex-1 flex-col"><span className="text-sm font-semibold">{row.title}</span><span className="text-xs text-[#5B5F6B]">{row.sub}</span></div>
                  {row.pill}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
      <nav aria-label="Navegação principal" className="fixed inset-x-0 bottom-0 mx-auto flex h-[88px] w-full max-w-[430px] items-start rounded-t-3xl bg-white px-2 shadow-[0_-8px_24px_-14px_rgba(45,45,43,0.35)]">
        <Link href="/" className="flex min-h-11 flex-1 flex-col items-center gap-1 pt-3 text-[11px] font-semibold text-[#1563FF]">Início</Link>
        <div className="flex flex-[1.2] flex-col items-center">
          <Link href="/registrar" aria-label="Registrar o dia" className="-mt-[26px] flex size-[68px] items-center justify-center rounded-full border-[5px] border-[#F4F5F9] bg-[#1563FF] shadow-lg">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
          </Link>
          <span className="mt-1 text-[11px] font-bold text-[#1563FF]">Registrar</span>
        </div>
        <span className="flex-1" />
      </nav>
    </Page>
  );
}
