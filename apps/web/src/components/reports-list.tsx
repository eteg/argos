"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { Schemas } from "@argos/contract";
import { api, timezoneParams } from "@/lib/api";
import { errorMessage } from "@/lib/format";
import { ApiError, unwrap } from "@/lib/hooks";
import { Back, Page, Title } from "@/components/ui";

type Item = Schemas["ReportListItem"];
const tz = timezoneParams();

function title(item: Item) {
  const [y = 0, m = 1, d = 1] = item.localDate.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const weekday = new Intl.DateTimeFormat("pt-BR", { weekday: "long", timeZone: "UTC" }).format(date);
  const short = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" }).format(date);
  return `Nº ${String(item.number).padStart(3, "0")} · ${weekday}, ${short}`;
}

export function ReportsList() {
  const siteId = useSearchParams().get("id") ?? "";
  const [items, setItems] = useState<Item[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState<string>("");

  async function load(cursor: string | null) {
    setLoading(true);
    setError(null);
    try {
      const page = await unwrap(
        api.GET("/v1/sites/{siteId}/reports", { params: { path: { siteId }, query: { status: "approved", limit: 20, ...(cursor ? { cursor } : {}) }, ...tz } }),
      );
      setItems((current) => (cursor ? [...current, ...page.items] : page.items));
      setNext(page.nextCursor);
      setLoaded(true);
    } catch (e) {
      setError(errorMessage(e instanceof ApiError ? e.code : "UNAVAILABLE"));
    }
    setLoading(false);
  }

  useEffect(() => {
    void load(null);
    void unwrap(api.GET("/v1/sites/{siteId}", { params: { path: { siteId }, ...tz } })).then((s) => setName(s.name), () => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId]);

  return (
    <Page>
      <div className="flex items-center gap-3 px-5 pb-3 pt-5">
        <Back href={`/obra?id=${siteId}`} label="Voltar para a pasta da obra" />
        <div className="flex flex-col gap-0.5"><Title>RDOs aprovados</Title>{name && <span className="text-[13px] text-[#5B5F6B]">{name}</span>}</div>
      </div>
      <div className="flex flex-col gap-3 px-4 pb-8 pt-1">
        {error && (
          <div role="alert" className="flex flex-col gap-2 rounded-xl bg-[#FFE9C7] p-3 text-sm text-[#6B3A00]">
            {error}
            <button type="button" onClick={() => void load(items.length ? next : null)} className="self-start font-semibold underline">Tentar de novo</button>
          </div>
        )}
        {loaded && items.length === 0 && !error && <p className="m-0 rounded-2xl bg-white p-3.5 text-sm text-[#5B5F6B]">Nenhum RDO aprovado nesta obra ainda.</p>}
        {!loaded && !error && <p className="m-0 text-[#5B5F6B]">Carregando…</p>}
        {items.length > 0 && (
          <ul className="m-0 list-none rounded-2xl bg-white px-3.5 py-0.5">
            {items.map((item) => (
              <li key={item.id} className="border-b border-[#E3E5EE] last:border-b-0">
                <Link href={`/rdo/consulta?id=${item.id}`} className="flex min-h-14 items-center gap-3">
                  <div className="flex flex-1 flex-col gap-0.5 py-2.5">
                    <span className="text-[15px] font-medium">{title(item)}</span>
                    <span className="text-[13px] text-[#5B5F6B]">
                      Aprovado às {new Date(item.approvedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} · {item.occurrencesCount === 0 ? "sem ocorrências" : `${item.occurrencesCount} ${item.occurrencesCount === 1 ? "ocorrência" : "ocorrências"}`}
                    </span>
                  </div>
                  <span aria-hidden="true" className="text-[#9AA3B8]">›</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {next && (
          <button type="button" disabled={loading} onClick={() => void load(next)} className="flex min-h-12 items-center justify-center rounded-[14px] border-[1.5px] border-[#2D2D2B] text-[15px] font-semibold disabled:opacity-60">
            {loading ? "Carregando…" : "Ver mais"}
          </button>
        )}
      </div>
    </Page>
  );
}
