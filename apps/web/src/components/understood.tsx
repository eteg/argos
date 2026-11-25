"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Schemas } from "@argos/contract";
import { api, timezoneParams } from "@/lib/api";
import { unwrap, useLoad } from "@/lib/hooks";

const tz = timezoneParams();
const tagTone: Record<string, string> = { occurrence: "bg-[#4B3A5E] text-[#E6D3F7]", safety: "bg-[#4B3A5E] text-[#E6D3F7]" };

export function Understood({ entryId, siteId, number }: { entryId: string; siteId: string; number: number }) {
  const [state, reload] = useLoad(() => unwrap(api.GET("/v1/entries/{entryId}", { params: { path: { entryId }, ...tz } })), [entryId]);
  const [answered, setAnswered] = useState<string[]>([]);
  const processing = state.status === "ok" && state.data.status === "processing";
  useEffect(() => {
    if (!processing) return;
    const t = setTimeout(reload, 2000);
    return () => clearTimeout(t);
  });
  const entry = state.status === "ok" ? state.data : null;
  const open = (entry?.questions ?? []).filter((q) => q.status === "open" && !answered.includes(q.id));

  async function answer(q: Schemas["Question"], optionId: string) {
    await unwrap(api.POST("/v1/questions/{questionId}/answer", { params: { path: { questionId: q.id }, ...tz }, body: { optionId } }));
    setAnswered((l) => [...l, q.id]);
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-[#2D2D2B] font-[family-name:var(--font-inter)] text-white">
      <div className="flex flex-col gap-4 px-4 pb-3 pt-6">
        <div className="flex flex-col gap-0.5 px-1">
          <span className="text-[15px] font-semibold">Registro {number} salvo</span>
          <span className="text-[13px] text-[#CFCFCB]">{processing || !entry ? "O Argos está ouvindo o que você falou…" : "Hora e local carimbados"}</span>
        </div>
        {entry?.status === "failed" && <div role="alert" className="rounded-2xl bg-[#3A3A37] p-4 text-sm">O registro foi salvo, mas o Argos não conseguiu entender o áudio. Você pode fechar o dia e preencher o RDO à mão.</div>}
        {entry && entry.status === "processed" && (
          <div className="flex flex-col gap-2.5 rounded-2xl bg-[#3A3A37] p-4">
            <span className="text-[13px] text-[#CFCFCB]">O que o Argos entendeu</span>
            {entry.title && <span className="text-[15px] font-semibold">{entry.title}</span>}
            {entry.transcript ? <p className="m-0 text-[15px] leading-[1.5]">“{entry.transcript}”</p> : <p className="m-0 text-sm text-[#CFCFCB]">Sem transcrição neste ambiente.</p>}
            <div className="flex flex-wrap gap-1.5">{entry.tags.map((t, i) => <span key={i} className={`rounded-full px-2.5 py-1 text-[13px] ${tagTone[t.kind] ?? "bg-[#1B3A7A] text-[#C9DAFF]"}`}>{t.label}</span>)}</div>
          </div>
        )}
        {open.map((q) => (
          <div key={q.id} className="flex flex-col gap-3 rounded-2xl bg-white p-4 text-[#2D2D2B]">
            <span className="text-[13px] font-semibold text-[#5B2E86]">O Argos perguntou</span>
            <p className="m-0 text-[15px] leading-[1.45]">{q.text}</p>
            <div className="flex flex-wrap gap-2">{q.options.map((o) => <button key={o.id} type="button" onClick={() => void answer(q, o.id)} className="min-h-11 rounded-full border border-[#DDE0EA] bg-[#F4F5F9] px-3.5 text-[13px] font-medium">{o.label}</button>)}</div>
          </div>
        ))}
      </div>
      <div className="mt-auto flex gap-2.5 px-4 pb-6 pt-3">
        <a href={`/registro?id=${siteId}`} className="flex h-[52px] flex-1 items-center justify-center rounded-2xl bg-[#3A3A37] text-[15px] font-semibold">Novo registro</a>
        <Link href={`/dia?id=${siteId}`} className="flex h-[52px] flex-1 items-center justify-center rounded-2xl bg-[#1563FF] text-[15px] font-semibold">Ver o dia</Link>
      </div>
    </main>
  );
}
