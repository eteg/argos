"use client";

import Link from "next/link";
import { api, timezoneParams } from "@/lib/api";
import { fullDate, shortDate, statusLabel } from "@/lib/format";
import { unwrap, useLoad } from "@/lib/hooks";
import { Back, Page, Status, Title } from "@/components/ui";
import type { Schemas } from "@argos/contract";

const groups: Schemas["SiteStatus"][] = ["not_started", "paused", "completed"];
const selo = { not_started: "bg-[#E3ECFF] text-[#0B3699]", paused: "bg-[#FFE9C7] text-[#6B3A00]", completed: "bg-[#E3E5EE] text-[#45484F]" } as const;

function seloText(g: Schemas["SiteStatus"], changedOn: string | null) {
  if (g === "not_started" || !changedOn) return statusLabel[g];
  return g === "completed" ? `Concluída em ${fullDate(changedOn)}` : `Paralisada desde ${shortDate(changedOn)}`;
}

export function AwaySites() {
  const [state, retry] = useLoad(async () => {
    const list = await unwrap(api.GET("/v1/sites", { params: { ...timezoneParams(), query: { status: "not_started,paused,completed" } } }));
    const details = await Promise.all(list.items.map((s) => unwrap(api.GET("/v1/sites/{siteId}", { params: { path: { siteId: s.id }, ...timezoneParams() } })).catch(() => null)));
    return { items: list.items, details: new Map(details.flatMap((d) => (d ? [[d.id, d] as const] : []))) };
  }, []);
  async function reopen(id: string) {
    await unwrap(api.PUT("/v1/sites/{siteId}/status", { params: { path: { siteId: id }, ...timezoneParams() }, body: { status: "in_progress" } }));
    retry();
  }
  return (
    <Page>
      <div className="flex items-center gap-3 px-5 pb-3 pt-5"><Back href="/" label="Voltar para o início" /><Title>Fora de andamento</Title></div>
      <div className="flex flex-col gap-5 px-4 pb-6 pt-1">
        <span className="px-1 text-[13px] leading-[1.45] text-[#5B5F6B]">Obras não iniciadas, paralisadas ou concluídas não aparecem na hora de registrar o dia. Para lançar RDO em uma delas, volte o status para em andamento.</span>
        {state.status !== "ok" ? <Status state={state} retry={retry} /> : groups.map((g) => {
          const items = state.data.items.filter((s) => s.status === g);
          if (items.length === 0) return null;
          return (
            <section key={g} className="flex flex-col gap-2.5">
              <h2 className="m-0 px-1 text-[15px] font-semibold" id={`g-${g}`}>{statusLabel[g]}s · {items.length}</h2>
              {items.map((s) => {
                const detail = state.data.details.get(s.id);
                const approved = detail?.approvedReportsCount ?? 0;
                const created = detail ? shortDate(detail.createdAt.slice(0, 10)) : null;
                const sub = g === "not_started" && approved === 0 ? `${created ? `Cadastrada em ${created} · ` : ""}nenhum RDO` : `${approved} ${approved === 1 ? "RDO aprovado" : "RDOs aprovados"}`;
                return (
                  <div key={s.id} className="flex flex-col gap-2.5 rounded-2xl bg-white p-3.5">
                    <span className={`self-start rounded-full px-2 py-[3px] text-xs font-semibold ${selo[g as keyof typeof selo]}`}>{seloText(g, s.statusChangedOn)}</span>
                    <div className="flex flex-col gap-0.5"><span className="text-[15px] font-semibold">{s.name}</span><span className="text-[13px] text-[#5B5F6B]">{sub}</span></div>
                    <div className="flex gap-2">
                      {g !== "not_started" && (
                        <Link href={`/obra/rdos?id=${s.id}`} className="flex min-h-11 flex-1 items-center justify-center rounded-xl border-[1.5px] border-[#2D2D2B] text-[15px] font-semibold text-[#2D2D2B]">Ver RDOs</Link>
                      )}
                      <button type="button" onClick={() => void reopen(s.id)} className={`flex min-h-11 flex-[1.4] items-center justify-center rounded-xl text-[15px] font-semibold ${g === "completed" ? "border-[1.5px] border-[#2D2D2B] text-[#2D2D2B]" : "bg-[#1563FF] text-white"}`}>{g === "not_started" ? "Começar obra" : "Voltar a andamento"}</button>
                    </div>
                  </div>
                );
              })}
            </section>
          );
        })}
      </div>
    </Page>
  );
}
