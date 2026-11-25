"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, today, type OpenItem } from "@/lib/api";
import { HIGHLIGHT_DAYS, age, date, daysSince, openItemKindLabel } from "@/lib/labels";

// 2.8 Pendências de todas as obras. Só mostra: o desfecho é decidido no RDO do dia.
export default function Pending() {
  const [open, setOpen] = useState<OpenItem[] | null>(null);
  const [closed, setClosed] = useState<OpenItem[]>([]);

  useEffect(() => {
    api<{ items: OpenItem[] }>("/open-items").then((r) => setOpen(r.items));
    const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
    api<{ items: OpenItem[] }>(`/open-items?status=closed&closedSince=${weekAgo}`).then((r) => setClosed(r.items));
  }, []);

  const bySite = new Map<string, OpenItem[]>();
  for (const i of open ?? []) bySite.set(i.site!.name, [...(bySite.get(i.site!.name) ?? []), i]);

  return (
    <main>
      <Link href="/" className="muted">
        ← Início
      </Link>
      <h1>Pendências</h1>
      {open?.length === 0 && <p className="muted">Nada em aberto nas obras.</p>}
      {[...bySite].map(([site, items]) => (
        <div key={site}>
          <h2>
            {site} · {items.length} em aberto
          </h2>
          {items.map((i) => {
            const days = daysSince(i.openedOn, today());
            return (
              <div key={i.id} className="card" style={days >= HIGHLIGHT_DAYS ? { borderColor: "var(--danger)" } : undefined}>
                <div>{i.title}</div>
                <div className="muted">
                  {openItemKindLabel[i.kind]} · aberto em {date(i.openedOn)} · {age(days)}
                </div>
                {i.lastUpdate && (
                  <div className="muted">
                    {date(i.lastUpdate.localDate).slice(0, 5)}: {i.lastUpdate.note}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
      {closed.length > 0 && (
        <>
          <h2>Fechados nos últimos 7 dias</h2>
          {closed.map((i) => (
            <div key={i.id} className="card muted">
              {i.title} · fechado em {date(i.closedOn!)}
              {i.closingNote && `: ${i.closingNote}`}
            </div>
          ))}
        </>
      )}
    </main>
  );
}
