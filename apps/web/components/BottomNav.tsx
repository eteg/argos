import Link from "next/link";
import { HomeIcon, ListIcon, MicIcon } from "./Icons";

// Barra inferior do protótipo: Início, o microfone de registrar no centro e Pendências.
export function BottomNav({ current, registerHref = "/registrar" }: { current: "home" | "pending"; registerHref?: string }) {
  return (
    <nav className="bottom-nav">
      <div>
        <Link href="/" aria-current={current === "home" ? "page" : undefined}>
          <HomeIcon />
          Início
        </Link>
        <Link href={registerHref}>
          <span className="fab">
            <MicIcon />
          </span>
          <span className="fab-label">Registrar</span>
        </Link>
        <Link href="/pendencias" aria-current={current === "pending" ? "page" : undefined}>
          <ListIcon />
          Pendências
        </Link>
      </div>
    </nav>
  );
}
