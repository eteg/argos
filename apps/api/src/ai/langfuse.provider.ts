import { LangfuseSpanProcessor } from "@langfuse/otel";
import { Logger, type Provider } from "@nestjs/common";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { env } from "../config/env.js";

export const LANGFUSE = Symbol("LANGFUSE");

export const langfuseProvider: Provider = {
  provide: LANGFUSE,
  useFactory: () => {
    const logger = new Logger("Langfuse");
    const processor = new LangfuseSpanProcessor({
      publicKey: env.LANGFUSE_PUBLIC_KEY,
      secretKey: env.LANGFUSE_SECRET_KEY,
      baseUrl: env.LANGFUSE_BASE_URL,
      environment: env.APP_ENV,
    });
    const sdk = new NodeSDK({ spanProcessors: [processor] });
    try {
      sdk.start();
    } catch (error) {
      logger.error(`Langfuse did not start: ${String(error)}`);
    }
    return processor;
  },
};
