import Link from "next/link";
import type { ReactNode } from "react";
import { errorMessage } from "@/lib/format";

export const field =
  "h-11 w-full min-w-0 rounded-[10px] border-[1.5px] border-[#CDD1DD] bg-white px-3 text-[15px] text-[#2D2D2B]";

export function Back({ href, label = "Voltar" }: { href: string; label?: string }) {
  return (
    <Link href={href} aria-label={label} className="flex size-11 flex-none items-center justify-center rounded-full bg-white">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2D2D2B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M15 6l-6 6 6 6" />
      </svg>
    </Link>
  );
}

export function Page({ children }: { children: ReactNode }) {
  return <main className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-[#F4F5F9] font-[family-name:var(--font-inter)] text-[#2D2D2B]">{children}</main>;
}

export function Title({ children }: { children: ReactNode }) {
  return <h1 className="m-0 font-[family-name:var(--font-anybody)] text-[26px] font-bold leading-[1.15] tracking-[-0.02em]">{children}</h1>;
}

export function Pill({ children, tone = "purple" }: { children: ReactNode; tone?: "purple" | "blue" | "amber" | "gray" | "solid" }) {
  const tones = {
    purple: "bg-[#EFE3FA] text-[#5B2E86]",
    blue: "bg-[#E3ECFF] text-[#0B3699]",
    amber: "bg-[#FFE9C7] text-[#6B3A00]",
    gray: "bg-[#E3E5EE] text-[#45484F]",
    solid: "bg-[#1563FF] text-white",
  };
  return <span className={`inline-block flex-none rounded-full px-2.5 py-1 text-[11px] font-semibold ${tones[tone]}`}>{children}</span>;
}

export function Primary({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" {...props} className="flex min-h-[52px] w-full items-center justify-center rounded-[14px] bg-[#1563FF] text-[15px] font-semibold text-white disabled:bg-[#DDE0EA] disabled:text-[#5B5F6B]">
      {children}
    </button>
  );
}

export function Outline({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" {...props} className="flex min-h-11 w-full items-center justify-center rounded-xl border-[1.5px] border-[#2D2D2B] text-[15px] font-semibold">
      {children}
    </button>
  );
}

export function Status({ state, retry }: { state: { status: "loading" } | { status: "error"; code: string }; retry: () => void }) {
  if (state.status === "loading") return <p className="p-6 text-[#5B5F6B]">Carregando…</p>;
  return (
    <div className="flex flex-col gap-3 p-6">
      <p>Não deu pra carregar agora.</p>
      <button type="button" onClick={retry} className="rounded-xl bg-[#1563FF] px-4 py-3 font-semibold text-white">Tentar de novo</button>
    </div>
  );
}

export function Sheet({ closeHref, children }: { closeHref: string; children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-[#8E9099] font-[family-name:var(--font-inter)] text-[#2D2D2B]">
      <Link href={closeHref} aria-label="Fechar" className="min-h-10 flex-1" />
      <div role="dialog" className="flex max-h-[90dvh] flex-col gap-3 overflow-y-auto rounded-t-[28px] bg-[#F4F5F9] px-4 pb-6 pt-2.5">
        <span aria-hidden="true" className="h-[5px] w-11 flex-none self-center rounded-[3px] bg-[#CDD1DD]" />
        {children}
      </div>
    </main>
  );
}

export function ErrorAlert({ error, withFields = false }: { error: { code: string; errors: { field: string }[] }; withFields?: boolean }) {
  const pendingDay = error.code === "PREVIOUS_DAY_PENDING";
  const fields = withFields && !pendingDay && error.errors.length > 0 ? ` (${error.errors.map((e) => e.field).join(", ")})` : "";
  return (
    <div role="alert" className="flex flex-col gap-2 rounded-xl bg-[#FFE9C7] p-3 text-sm text-[#6B3A00]">
      <span>{errorMessage(error.code, error.errors)}{fields}</span>
      {pendingDay && <Link href="/dias-anteriores" className="flex min-h-11 items-center self-start rounded-xl border-[1.5px] border-[#6B3A00] px-3 font-semibold">Ver dias anteriores</Link>}
    </div>
  );
}
