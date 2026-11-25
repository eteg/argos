"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useOnline } from "@/lib/online";
import { listQueue } from "@/lib/offline-queue";
import { flushQueue, type FlushResult } from "@/lib/send-entry";

const RETRY_MS = 30_000;

function summary(sent: FlushResult["sent"]) {
  const bySite = new Map<string, { name: string; days: Set<string> }>();
  for (const s of sent) {
    const site = bySite.get(s.siteId) ?? { name: s.siteName, days: new Set<string>() };
    site.days.add(s.localDate);
    bySite.set(s.siteId, site);
  }
  return [...bySite.values()].map((s) => `${s.days.size} ${s.days.size === 1 ? "dia" : "dias"} do ${s.name}`).join(", ");
}

// Aviso global: sem internet mostra o que está guardado no celular; quando a internet volta envia a fila
// e avisa (2.7). Tocar no aviso abre a 2.6.
export function OfflineSync() {
  const online = useOnline();
  const [waiting, setWaiting] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setWaiting((await listQueue()).filter((i) => !i.error).length);
    } catch {
      setWaiting(0);
    }
  }, []);

  const flush = useCallback(async () => {
    try {
      const result = await flushQueue();
      if (result.sent.length > 0) setNotice(`${summary(result.sent)} foram capturados sem sinal. O RDO está pronto para você finalizar.`);
    } catch {
      // sem acesso ao armazenamento do celular: nada a enviar
    }
    await refresh();
  }, [refresh]);

  useEffect(() => {
    if (!online) return;
    const first = setTimeout(() => void flush(), 0);
    const timer = setInterval(() => void flush(), RETRY_MS);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [online, flush]);

  useEffect(() => {
    const first = setTimeout(() => void refresh(), 0);
    const onChange = () => void refresh();
    window.addEventListener("argos:queue-changed", onChange);
    return () => {
      clearTimeout(first);
      window.removeEventListener("argos:queue-changed", onChange);
    };
  }, [refresh]);

  if (notice) {
    return (
      <Link href="/dias-anteriores" onClick={() => setNotice(null)} className="fixed inset-x-3 top-3 z-50 mx-auto flex max-w-[406px] gap-3 rounded-[22px] bg-[#F4F5F9] p-3.5 text-[#2D2D2B] shadow-lg">
        <span className="flex size-10 flex-none items-center justify-center rounded-[10px] bg-[#1563FF] font-[family-name:var(--font-anybody)] text-lg font-extrabold text-white">A</span>
        <span className="flex flex-1 flex-col gap-0.5">
          <span className="text-[15px] font-semibold">Internet de volta</span>
          <span className="text-sm leading-[1.4]">{notice}</span>
        </span>
      </Link>
    );
  }
  if (!online) {
    return (
      <div role="status" className="fixed inset-x-0 top-0 z-50 mx-auto max-w-[430px] bg-[#FFE9C7] px-4 py-2 text-center text-[13px] font-semibold text-[#6B3A00]">
        Sem internet. Mostrando o último carregado{waiting > 0 ? ` · ${waiting} ${waiting === 1 ? "registro guardado" : "registros guardados"} no celular` : ""}.
      </div>
    );
  }
  if (waiting > 0) {
    return (
      <Link href="/dias-anteriores" className="fixed inset-x-0 top-0 z-50 mx-auto block max-w-[430px] bg-[#E3ECFF] px-4 py-2 text-center text-[13px] font-semibold text-[#0B3699]">
        {waiting} {waiting === 1 ? "registro esperando" : "registros esperando"} para subir…
      </Link>
    );
  }
  return null;
}
