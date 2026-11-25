"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BottomNav } from "@/components/BottomNav";
import { api, currentLocation, type SiteSummary } from "@/lib/api";
import { distance, siteTypeLabel } from "@/lib/labels";

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
};

// 2.1 Início: as obras em andamento, da mais perto pra mais longe.
export default function Home() {
  const [me, setMe] = useState<{ name: string } | null>(null);
  const [sites, setSites] = useState<SiteSummary[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ name: string }>("/me").then(setMe).catch(() => {});
    currentLocation()
      .then((location) => api<{ items: SiteSummary[] }>("/sites", { location }))
      .then((r) => setSites(r.items))
      .catch(() => setError("Não deu pra carregar as obras agora."));
  }, []);

  const toDo = (sites ?? []).filter((s) => s.today.entriesCount > 0 || s.openItemsCount > 0);

  return (
    <main>
      <div className="row">
        <span className="wordmark">Argos</span>
        <Link href="/obras/nova" className="btn soft small">
          + Nova obra
        </Link>
      </div>
      <p className="eyebrow">
        {greeting()}
        {me ? `, ${me.name.split(" ")[0]}` : ""}
      </p>
      <h1 className="page-title">suas obras hoje</h1>

      <div className="chips">
        <span className="chip on">Perto de mim</span>
        <Link href="/pendencias" className="chip">
          Pendências
        </Link>
        <Link href="/obras/todas" className="chip">
          Todas
        </Link>
      </div>

      {error && <p className="error">{error}</p>}
      {sites?.length === 0 && <p className="muted">Nenhuma obra em andamento. Cadastre a primeira.</p>}
      {sites?.map((s) => (
        <Link key={s.id} href={`/obras/${s.id}`} className="card dark">
          <span className="tag lilac">
            {s.today.entriesCount === 0 ? "RDO não começou" : `RDO em andamento · ${s.today.entriesCount} registro(s)`}
          </span>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.3rem", marginTop: 10 }}>{s.name}</div>
          <div className="muted">
            {[distance(s.distanceMeters), siteTypeLabel[s.type]].filter(Boolean).join(" · ")}
          </div>
        </Link>
      ))}

      {toDo.length > 0 && (
        <>
          <h2>RDOs a fazer</h2>
          <div className="list">
            {toDo.map((s) => (
              <Link key={s.id} href={`/obras/${s.id}`}>
                <div>
                  <div style={{ fontWeight: 600 }}>{s.name}</div>
                  <div className="muted">
                    {s.today.entriesCount > 0 ? "RDO de hoje falta revisar e aprovar" : "RDO de hoje ainda não começou"}
                    {s.openItemsCount > 0 && ` · ${s.openItemsCount} em aberto`}
                  </div>
                </div>
                <span className="tag lilac">Hoje</span>
              </Link>
            ))}
          </div>
        </>
      )}
      <BottomNav current="home" />
    </main>
  );
}
