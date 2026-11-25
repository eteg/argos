"use client";

import Link from "next/link";
import { api, timezoneParams } from "@/lib/api";
import { dayStateLabel } from "@/lib/format";
import { unwrap, useLoad } from "@/lib/hooks";

const tz = timezoneParams();
const iconProps = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;

const badge = "rounded-full bg-[#EFE3FA] px-2 py-[3px] text-xs font-semibold text-[#5B2E86]";
const item = "flex min-h-12 items-center gap-3.5 rounded-xl px-3 text-[15px] no-underline";

export function MenuScreen() {
  const [state] = useLoad(async () => {
    const [me, sites, openItems] = await Promise.all([
      unwrap(api.GET("/v1/me", { params: { header: tz.header } })),
      unwrap(api.GET("/v1/sites", { params: { header: tz.header } })),
      unwrap(api.GET("/v1/open-items", { params: { header: tz.header } })),
    ]);
    const current = sites.items.find((s) => s.today.entriesCount > 0) ?? sites.items[0] ?? null;
    return { me, current, openCount: openItems.items.length };
  }, []);

  const data = state.status === "ok" ? state.data : null;
  const initials = data ? data.me.name.split(" ").map((p) => p[0]).slice(0, 2).join("") : "";

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[430px] overflow-hidden bg-[#8E9099] font-[family-name:var(--font-inter)] text-[#2D2D2B]">
      <nav aria-label="Menu principal" className="flex min-h-dvh w-[318px] flex-none flex-col bg-white px-3.5 pb-5 pt-[22px]">
        <div className="flex items-center justify-between px-1.5">
          <span className="font-[family-name:var(--font-anybody)] text-2xl font-extrabold tracking-[-0.02em] text-[#1563FF]">Argos</span>
          <Link href="/" aria-label="Fechar menu" className="flex size-11 items-center justify-center rounded-full bg-[#F4F5F9]">
            <svg {...iconProps} stroke="#2D2D2B"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </Link>
        </div>
        <div className="mx-1.5 mb-3.5 mt-4 flex items-center gap-3 rounded-[14px] bg-[#2D2D2B] p-3 text-white">
          <span className="flex size-10 items-center justify-center rounded-full bg-[#CCA6ED] text-sm font-bold text-[#2D2D2B]">{initials}</span>
          <div className="flex flex-col">
            <span className="text-sm font-semibold">{data?.me.name ?? ""}</span>
            <span className="text-xs text-[#CFCFCB]">{data ? `Engenheiro · ${data.me.company}` : ""}</span>
          </div>
        </div>
        <div className="flex flex-col gap-0.5">
          <Link href="/" className={`${item} bg-[#E3ECFF] font-semibold text-[#0B3699]`}>
            <svg {...iconProps} stroke="#1563FF"><path d="M3 10.5L12 4l9 6.5V20H3z" /><path d="M9.5 20v-5h5v5" /></svg>
            <span className="flex-1">Minhas obras</span>
          </Link>
          <Link href={data?.current ? `/dia?id=${data.current.id}` : "/"} className={`${item} font-medium text-[#2D2D2B]`}>
            <svg {...iconProps} stroke="#5B5F6B"><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 8h6M9 12h6M9 16h3" /></svg>
            <span className="flex-1">RDO de hoje</span>
            {data?.current && <span className={badge}>{dayStateLabel[data.current.today.state]?.replace("RDO ", "")}</span>}
          </Link>
          <Link href="/pendencias" className={`${item} font-medium text-[#2D2D2B]`}>
            <svg {...iconProps} stroke="#5B5F6B"><path d="M9 6h11M9 12h11M9 18h11" /><path d="M4 6h.01M4 12h.01M4 18h.01" /></svg>
            <span className="flex-1">Pendências</span>
            {data && data.openCount > 0 && <span className={badge}>{data.openCount}</span>}
          </Link>
        </div>
        <span className="mt-auto px-3 text-xs text-[#5B5F6B]">Argos 1.0 · ETEG Technology</span>
      </nav>
      <Link href="/" aria-label="Fechar menu" className="flex-1" />
    </main>
  );
}
