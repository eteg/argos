"use client";

import { useState } from "react";
import type { Schemas } from "@argos/contract";
import { api, timezoneParams } from "@/lib/api";
import { NETWORK, problemCode } from "@/lib/problem";

const messages: Record<string, string> = {
  UNAUTHORIZED: "App mal configurado: a chave da API não confere.",
  RATE_LIMITED: "Muitos testes seguidos. Tente de novo em um minuto.",
  UNAVAILABLE: "A IA não respondeu agora. Tente de novo.",
  [NETWORK]: "Sem conexão com o servidor.",
};

export default function Diagnostics() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Schemas["AiDiagnostic"] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const { data, error: problem } = await api.POST("/v1/diagnostics/ai", { params: timezoneParams() });
      if (data) setResult(data);
      else setError(messages[problemCode(problem)] ?? messages.UNAVAILABLE ?? "");
    } catch {
      setError(messages[NETWORK] ?? "");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 px-4 py-8">
      <h1 className="text-2xl font-semibold">Diagnóstico da IA</h1>
      <button
        type="button"
        disabled={loading}
        onClick={() => void run()}
        className="rounded-lg bg-teal-700 px-4 py-3 font-medium text-white disabled:opacity-50"
      >
        {loading ? "Testando…" : "Testar a IA"}
      </button>
      {error && <p role="alert">{error}</p>}
      {result && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 break-words">
          <dt className="text-zinc-500">Saída</dt>
          <dd>{result.output}</dd>
          <dt className="text-zinc-500">Modelo</dt>
          <dd>{result.model}</dd>
          <dt className="text-zinc-500">Tokens</dt>
          <dd>
            {result.inputTokens} entrada, {result.outputTokens} saída, {result.cacheReadInputTokens}{" "}
            cache lido, {result.cacheCreationInputTokens} cache criado
          </dd>
          <dt className="text-zinc-500">Latência</dt>
          <dd>{result.latencyMs} ms</dd>
          <dt className="text-zinc-500">Trace</dt>
          <dd>{result.traceId}</dd>
        </dl>
      )}
    </main>
  );
}
