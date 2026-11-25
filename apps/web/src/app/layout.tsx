import type { Metadata, Viewport } from "next";
import { Anybody, Inter } from "next/font/google";
import "./globals.css";
import { PwaProvider } from "./serwist-provider";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

const anybody = Anybody({ variable: "--font-anybody", subsets: ["latin"], weight: ["500", "700", "800"] });

export const metadata: Metadata = {
  title: "Argos",
  description: "Relatório diário de obra preenchido por voz.",
};

export const viewport: Viewport = {
  themeColor: "#0f766e",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${inter.variable} ${anybody.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col"><PwaProvider>{children}</PwaProvider></body>
    </html>
  );
}
