"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function Home() {
  const [health, setHealth] = useState("verificando…");

  useEffect(() => {
    api<{ status: string }>("/health")
      .then((r) => setHealth(r.status))
      .catch(() => setHealth("sem conexão com a API"));
  }, []);

  return (
    <main>
      <h1>Argos</h1>
      <p>API: {health}</p>
    </main>
  );
}
