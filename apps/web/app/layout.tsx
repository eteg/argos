import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = { title: "Argos", description: "RDO preenchido por voz e foto" };
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#1f2937" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
