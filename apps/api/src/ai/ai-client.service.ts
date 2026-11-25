import Anthropic from "@anthropic-ai/sdk";
import { startObservation } from "@langfuse/tracing";
import { Inject, Injectable, Logger, OnApplicationShutdown } from "@nestjs/common";
import { ProblemException } from "../common/problem.js";
import { aiEnabled, aiFake, env } from "../config/env.js";
import { fakeComplete } from "./fake-ai.js";
import { LANGFUSE } from "./langfuse.provider.js";
import type { LangfuseSpanProcessor } from "@langfuse/otel";

export interface AiRunInput {
  name: string;
  system: string;
  messages: Anthropic.MessageParam[];
  documents: { id: string; title: string }[];
  maxTokens: number;
  timeoutMs: number;
  metadata?: Record<string, unknown>;
}

export interface AiRunResult {
  model: string;
  output: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    cacheReadInputTokens: number;
    cacheCreationInputTokens: number;
  };
  latencyMs: number;
  traceId: string;
}

@Injectable()
export class AiClientService implements OnApplicationShutdown {
  private readonly logger = new Logger(AiClientService.name);
  private readonly anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 1 });

  constructor(@Inject(LANGFUSE) private readonly langfuse: LangfuseSpanProcessor) {}

  async run(input: AiRunInput): Promise<AiRunResult> {
    if (!aiEnabled()) throw new ProblemException(409, "AI_DISABLED", "The AI is turned off in this environment.");
    if (aiFake()) return this.fake(input);
    const model = env.ANTHROPIC_MODEL;
    const generation = startObservation(
      input.name,
      {
        model,
        input: { system: input.system, messages: input.messages },
        modelParameters: { max_tokens: input.maxTokens },
        metadata: { ...input.metadata, documents: input.documents, environment: env.APP_ENV },
      },
      { asType: "generation" },
    );
    const startedAt = Date.now();

    try {
      const response = await this.anthropic.messages.create(
        { model, max_tokens: input.maxTokens, system: input.system, messages: input.messages },
        { timeout: input.timeoutMs },
      );
      const output = response.content
        .map((block) => (block.type === "text" ? block.text : ""))
        .join("");
      const usage = {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        cacheReadInputTokens: response.usage.cache_read_input_tokens ?? 0,
        cacheCreationInputTokens: response.usage.cache_creation_input_tokens ?? 0,
      };
      generation
        .update({
          output,
          usageDetails: {
            input: usage.inputTokens,
            output: usage.outputTokens,
            cache_read_input_tokens: usage.cacheReadInputTokens,
            cache_creation_input_tokens: usage.cacheCreationInputTokens,
          },
        })
        .end();
      return { model, output, usage, latencyMs: Date.now() - startedAt, traceId: generation.traceId };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      generation.update({ level: "ERROR", statusMessage: message }).end();
      this.logger.error(`AI call "${input.name}" failed: ${message}`);
      throw new ProblemException(503, "UNAVAILABLE", "The AI call could not be completed.");
    }
  }

  private async fake(input: AiRunInput): Promise<AiRunResult> {
    const startedAt = Date.now();
    const user = input.messages.map((m) => (typeof m.content === "string" ? m.content : "")).join("\n");
    const output = await fakeComplete(input.name, user);
    return { model: "fake", output, usage: { inputTokens: 0, outputTokens: 0, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 }, latencyMs: Date.now() - startedAt, traceId: "fake" };
  }

  async onApplicationShutdown() {
    try {
      await this.langfuse.forceFlush();
    } catch (error) {
      this.logger.error(`Langfuse flush failed: ${String(error)}`);
    }
  }
}
