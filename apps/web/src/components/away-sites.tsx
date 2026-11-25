"use client";

import { api, timezoneParams } from "@/lib/api";
import { shortDate, statusLabel } from "@/lib/format";
import { unwrap, useLoad } from "@/lib/hooks";
import { Back, Page, Pill, Status, Title } from "@/components/ui";
import type { Schemas } from "@argos/contract";

const groups: Schemas["SiteStatus"][] = ["not_started", "paused", "completed"];
const tones = { not_started: "blue", paused: "amber", completed: "gray" } as const;

export function AwaySites() {
  const [state, retry] = useLoad(() => unwrap(api.GET("/v1/sites", { params: { ...timezoneParams(), query: { status: "not_started,paused,completed" } } })), []);
  async function reopen(id: string) {
    await unwrap(api.PUT("/v1/sites/{siteId}/status", { params: { path: { siteId: id }, ...timezoneParams() }, body: { status: "in_progress" } }));
    retry();
  }
  return (
    <Page>
      <div className="flex items-center gap-3 px-5 pb-3 pt-5"><Back href="/" label="Voltar para o início" /><Title>Fora de andamento</Title></div>
      <div className="flex flex-col gap-5 px-4 pb-6">
        <span className="px-1 text-[13px] leading-[1.45] text-[#5B5F6B]">Obras não iniciadas, paralisadas ou concluídas não aparecem na hora de registrar o dia. Para lançar RDO em uma delas, volte o status para em andamento.</span>
        {state.status !== "ok" ? <Status state={state} retry={retry} /> : groups.map((g) => {
          const items = state.data.items.filter((s) => s.status === g);
          if (items.length === 0) return null;
          return (
            <section key={g} className="flex flex-col gap-2.5">
              <h2 className="m-0 px-1 text-[15px] font-semibold">{statusLabel[g]}s · {items.length}</h2>
              {items.map((s) => (
                <div key={s.id} className="flex flex-col gap-2.5 rounded-2xl bg-white p-3.5">
                  <Pill tone={tones[g as keyof typeof tones]}>{statusLabel[g]}{s.statusChangedOn && ` desde ${shortDate(s.statusChangedOn)}`}</Pill>
                  <span className="text-[15px] font-semibold">{s.name}</span>
                  <button type="button" onClick={() => void reopen(s.id)} className="flex min-h-11 items-center justify-center rounded-xl bg-[#1563FF] text-[15px] font-semibold text-white">{g === "not_started" ? "Começar obra" : "Voltar a andamento"}</button>
                </div>
              ))}
            </section>
          );
        })}
      </div>
    </Page>
  );
}
