import { LangfuseSpanProcessor } from "@langfuse/otel";
import { NodeSDK } from "@opentelemetry/sdk-node";

// Liga o Langfuse antes da API subir. Sem as chaves, a IA funciona sem observabilidade.
export function startTracing() {
  if (!process.env.LANGFUSE_PUBLIC_KEY || !process.env.LANGFUSE_SECRET_KEY) {
    console.warn("Langfuse desligado: faltam LANGFUSE_PUBLIC_KEY e LANGFUSE_SECRET_KEY");
    return;
  }
  const sdk = new NodeSDK({ spanProcessors: [new LangfuseSpanProcessor()] });
  sdk.start();
  process.on("SIGTERM", () => void sdk.shutdown());
}
