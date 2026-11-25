"use client";

import { useEffect, useState } from "react";
import type { Schemas } from "@argos/contract";
import { api } from "@/lib/api";

type State =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ok"; health: Schemas["Health"] };

async function fetchHealth(): Promise<State> {
  try {
    const { data } = await api.GET("/v1/health");
    return data ? { status: "ok", health: data } : { status: "error" };
  } catch {
    return { status: "error" };
  }
}

export default function Home() {
  const [state, setState] = useState<State>({ status: "loading" });

  function retry() {
    setState({ status: "loading" });
    void fetchHealth().then(setState);
  }

  useEffect(() => {
    void fetchHealth().then(setState);
  }, []);

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-8">
      <h1 className="text-3xl font-semibold">Argos</h1>
      {state.status === "loading" && <p>Conectando ao servidor…</p>}
      {state.status === "error" && (
        <div className="flex flex-col gap-4">
          <p>Não deu pra conectar com o servidor agora.</p>
          <button
            type="button"
            onClick={retry}
            className="rounded-lg bg-teal-700 px-4 py-3 font-medium text-white"
          >
            Tentar de novo
          </button>
        </div>
      )}
      {state.status === "ok" && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
          <dt className="text-zinc-500">Ambiente</dt>
          <dd>{state.health.environment}</dd>
          <dt className="text-zinc-500">Versão da API</dt>
          <dd>{state.health.version}</dd>
          <dt className="text-zinc-500">Banco</dt>
          <dd>{state.health.database === "up" ? "no ar" : "fora do ar"}</dd>
        </dl>
      )}
    </main>
  );
}
