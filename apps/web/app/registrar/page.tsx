"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BottomNav } from "@/components/BottomNav";
import { api, currentLocation, type SiteSummary } from "@/lib/api";
import { distance } from "@/lib/labels";

// 2.5 Check-in: escolher a obra e ir pro registro. Não grava nada na API (D12).
export default function CheckIn() {
  const router = useRouter();
  const [sites, setSites] = useState<SiteSummary[] | null>(null);

  useEffect(() => {
    currentLocation()
      .then((location) => api<{ items: SiteSummary[] }>("/sites", { location }))
      .then((r) => {
        // Uma obra só, ou a mais perto dentro do canteiro: vai direto.
        const here = r.items.find((s) => s.distanceMeters !== null && s.distanceMeters <= 150);
        if (r.items.length === 1 || here) router.replace(`/obras/${(here ?? r.items[0])!.id}/registro`);
        else setSites(r.items);
      });
  }, [router]);

  return (
    <main>
      <p className="eyebrow">Registrar o dia</p>
      <h1 className="page-title">em qual obra você está?</h1>
      {sites === null && <p className="muted">Procurando a obra mais perto…</p>}
      <div className="list">
        {sites?.map((s) => (
          <Link key={s.id} href={`/obras/${s.id}/registro`}>
            <div>
              <div style={{ fontWeight: 600 }}>{s.name}</div>
              <div className="muted">{distance(s.distanceMeters) ?? s.address}</div>
            </div>
            <span>›</span>
          </Link>
        ))}
      </div>
      <BottomNav current="home" />
    </main>
  );
}
