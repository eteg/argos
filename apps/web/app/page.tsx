"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, currentLocation, type SiteSummary } from "@/lib/api";
import { distance, siteTypeLabel } from "@/lib/labels";

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

  return (
    <main>
      <h1>Olá{me ? `, ${me.name.split(" ")[0]}` : ""}</h1>
      <div className="row">
        <h2>Obras em andamento</h2>
        <Link href="/obras/todas" className="muted">
          Todas
        </Link>
      </div>
      {error && <p className="error">{error}</p>}
      {sites?.length === 0 && <p className="muted">Nenhuma obra em andamento. Cadastre a primeira.</p>}
      {sites?.map((s) => (
        <Link key={s.id} href={`/obras/${s.id}`} className="card">
          <strong>{s.name}</strong>
          <div className="muted">
            {[siteTypeLabel[s.type], distance(s.distanceMeters)].filter(Boolean).join(" · ")}
          </div>
          <div className="row" style={{ marginTop: 8 }}>
            <span className="tag">
              {s.today.entriesCount === 0 ? "Sem registros hoje" : `${s.today.entriesCount} registro(s) hoje`}
            </span>
            <span className="btn primary" style={{ padding: "6px 12px" }}>
              Registrar
            </span>
          </div>
        </Link>
      ))}
      <div className="fixed-bottom">
        <div>
          <Link href="/obras/nova" className="btn block">
            + Nova obra
          </Link>
        </div>
      </div>
    </main>
  );
}
