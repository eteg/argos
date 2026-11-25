import Link from "next/link";

export function MainNav({ active, registerHref = "/registrar" }: { active: "home" | "pending" | "none"; registerHref?: string }) {
  const tone = (on: boolean) => (on ? "font-semibold text-[#1563FF]" : "font-medium text-[#5B5F6B]");
  return (
    <nav aria-label="Navegação principal" className="fixed inset-x-0 bottom-0 mx-auto flex h-[88px] w-full max-w-[430px] items-start rounded-t-3xl bg-white px-2 shadow-[0_-8px_24px_-14px_rgba(45,45,43,0.35)]">
      <Link href="/" aria-current={active === "home" ? "page" : undefined} className={`flex min-h-11 flex-1 flex-col items-center gap-1 pt-3 text-xs ${tone(active === "home")}`}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 10.5L12 4l9 6.5V20H3z" /></svg>
        Início
      </Link>
      <div className="flex flex-[1.2] flex-col items-center">
        <Link href={registerHref} aria-label="Registrar o dia" className="-mt-[26px] flex size-[68px] items-center justify-center rounded-full border-[5px] border-[#F4F5F9] bg-[#1563FF] shadow-lg">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
        </Link>
        <span className="mt-1 text-xs font-bold text-[#1563FF]">Registrar</span>
      </div>
      <Link href="/pendencias" aria-current={active === "pending" ? "page" : undefined} className={`flex min-h-11 flex-1 flex-col items-center gap-1 pt-3 text-xs ${tone(active === "pending")}`}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6h11M9 12h11M9 18h11" /><path d="M4 6h.01M4 12h.01M4 18h.01" /></svg>
        Pendências
      </Link>
    </nav>
  );
}
