"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function Home() {
  const [health, setHealth] = useState("verificando…");
  const [ai, setAi] = useState("");

  useEffect(() => {
    api<{ status: string }>("/health")
      .then((r) => setHealth(r.status))
      .catch(() => setHealth("sem conexão com a API"));
  }, []);

  async function testAi() {
    setAi("chamando a IA…");
    try {
      const r = await api<{ text: string; model: string }>("/ai/diagnostics", { method: "POST" });
      setAi(`${r.text} (${r.model})`);
    } catch (e) {
      setAi(`falhou: ${String(e)}`);
    }
  }

  return (
    <main>
      <h1>Argos</h1>
      <p>API: {health}</p>
      <button onClick={testAi}>Testar a IA</button>
      {ai && <p>{ai}</p>}
    </main>
  );
}
