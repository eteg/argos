"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, type SiteSummary } from "@/lib/api";
import { date, siteStatusLabel, siteTypeLabel } from "@/lib/labels";

// 2.11 Todas as obras, de todos os status.
export default function AllSites() {
  const [sites, setSites] = useState<SiteSummary[] | null>(null);

  useEffect(() => {
    api<{ items: SiteSummary[] }>("/sites?status=not_started,in_progress,paused,completed").then((r) => setSites(r.items));
  }, []);

  return (
    <main>
      <Link href="/" className="muted">
        ← Início
      </Link>
      <h1>Todas as obras</h1>
      {sites?.map((s) => (
        <Link key={s.id} href={`/obras/${s.id}`} className="card">
          <strong>{s.name}</strong>
          <div className="muted">
            {siteTypeLabel[s.type]} · {siteStatusLabel[s.status]} desde {date(s.statusChangedOn)}
          </div>
        </Link>
      ))}
    </main>
  );
}
