"use client";

import Link from "next/link";
import type { Schemas } from "@argos/contract";
import { api, timezoneParams } from "@/lib/api";
import { shortDate } from "@/lib/format";
import { unwrap, useLoad } from "@/lib/hooks";
import { agePill, ageLabel, daysAgo, daysSince, localToday, openItemKindLabel } from "@/lib/open-items";
import { MainNav } from "@/components/main-nav";
import { Page, Status } from "@/components/ui";

type Item = Schemas["OpenItem"];
const tz = timezoneParams();
const timeZone = tz.header["X-Timezone"];

export function Pendencias() {
  const [state, retry] = useLoad(async () => {
    const [open, closed, sites, config] = await Promise.all([
      unwrap(api.GET("/v1/open-items", { params: { header: tz.header, query: { status: "open" } } })),
      unwrap(api.GET("/v1/open-items", { params: { header: tz.header, query: { status: "closed", closedSince: daysAgo(7, timeZone) } } })),
      unwrap(api.GET("/v1/sites", { params: { header: tz.header, query: { status: "not_started,in_progress,paused,completed" } } })),
      unwrap(api.GET("/v1/config", { params: tz })),
    ]);
    return { open: open.items, closed: closed.items, sites: sites.items, highlightDays: config.openItemHighlightDays };
  }, []);

  if (state.status !== "ok") {
    return <Page><div className="p-5"><h1 className="m-0 font-[family-name:var(--font-anybody)] text-[26px] font-bold">Pendências</h1></div><Status state={state} retry={retry} /><MainNav active="pending" /></Page>;
  }
  const { open, closed, sites, highlightDays } = state.data;
  const today = localToday(timeZone);
  const siteName = new Map(sites.map((s) => [s.id, s.name]));
  const bySite = new Map<string, Item[]>();
  for (const item of open) bySite.set(item.siteId, [...(bySite.get(item.siteId) ?? []), item]);
  const groups = [...bySite.entries()].sort((a, b) => (siteName.get(a[0]) ?? "").localeCompare(siteName.get(b[0]) ?? ""));

  return (
    <Page>
      <div className="flex flex-col gap-3.5 px-5 pb-2 pt-5">
        <Link href="/" aria-label="Voltar para o início" className="flex size-11 items-center justify-center rounded-full bg-white">←</Link>
        <div className="flex flex-col gap-1">
          <h1 className="m-0 font-[family-name:var(--font-anybody)] text-[26px] font-bold leading-[1.15] tracking-[-0.02em]">Pendências</h1>
          <p className="m-0 text-[13px] leading-[1.45] text-[#5B5F6B]">O que ficou em aberto nos RDOs aprovados. O Argos pergunta por cada item no próximo RDO da obra.</p>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-6 px-4 pb-32 pt-3">
        {groups.length === 0 && <p className="m-0 rounded-2xl bg-white p-4 text-sm text-[#5B5F6B]">Nenhum item em aberto. Quando você aprovar um RDO com pendências, elas aparecem aqui.</p>}
        {groups.map(([siteId, items]) => {
          const old = items.some((i) => daysSince(i.openedOn, today) >= highlightDays);
          return (
            <section key={siteId} className="flex flex-col gap-2.5">
              <div className="flex items-baseline justify-between px-0.5"><h2 className="m-0 text-[15px] font-semibold">{siteName.get(siteId) ?? "Obra"}</h2><span className="text-[13px] text-[#5B5F6B]">{items.length} em aberto</span></div>
              <ul className={`m-0 list-none rounded-2xl bg-white px-3.5 py-0.5 ${old ? "border-[1.5px] border-[#CCA6ED]" : ""}`}>
                {items.map((i) => (
                  <li key={i.id} className="flex items-start gap-3 border-b border-[#E3E5EE] py-3 last:border-b-0">
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="text-[15px] font-medium">{i.title}</span>
                      <span className="text-[13px] leading-[1.4] text-[#5B5F6B]">{openItemKindLabel[i.kind]} · aberto em {shortDate(i.openedOn)}</span>
                      {i.lastUpdate && <span className="text-[13px] leading-[1.4] text-[#5B5F6B]">{shortDate(i.lastUpdate.localDate)}: {i.lastUpdate.note}</span>}
                    </div>
                    <span className={`mt-px flex-none rounded-full px-[9px] py-1 text-xs font-semibold ${agePill(i.openedOn, today, highlightDays)}`}>{ageLabel(i.openedOn, today)}</span>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
        {closed.length > 0 && (
          <section className="flex flex-col gap-2.5">
            <div className="flex items-baseline justify-between px-0.5"><h2 className="m-0 text-[15px] font-semibold">Fechados nos últimos 7 dias</h2><span className="text-[13px] text-[#5B5F6B]">{closed.length}</span></div>
            <ul className="m-0 list-none rounded-2xl bg-white px-3.5 py-0.5">
              {closed.map((i) => (
                <li key={i.id} className="flex flex-col gap-0.5 border-b border-[#E3E5EE] py-3 last:border-b-0">
                  <span className="text-[15px] font-medium text-[#5B5F6B]">{i.title}</span>
                  <span className="text-[13px] leading-[1.4] text-[#5B5F6B]">{siteName.get(i.siteId) ?? "Obra"} · fechado em {i.closedOn ? shortDate(i.closedOn) : "—"}{i.closingNote ? `: ${i.closingNote}` : ""}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
        <p className="m-0 px-0.5 text-[13px] leading-[1.45] text-[#5B5F6B]">Só entra aqui o que você aprovou num RDO. Itens abertos há {highlightDays} dias ou mais ficam destacados.</p>
      </div>
      <MainNav active="pending" />
    </Page>
  );
}
