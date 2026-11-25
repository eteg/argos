import { Controller, HttpCode, Post, UseGuards } from "@nestjs/common";
import type { Schemas } from "@argos/contract";
import { ThrottlerGuard } from "@nestjs/throttler";
import { AiClientService } from "../ai/ai-client.service.js";

@Controller("diagnostics")
export class DiagnosticsController {
  constructor(private readonly ai: AiClientService) {}

  @Post("ai")
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  async runAiDiagnostic(): Promise<Schemas["AiDiagnostic"]> {
    const result = await this.ai.run({
      name: "ai-diagnostic",
      system: "You are a connectivity check for the Argos API.",
      messages: [{ role: "user", content: "Reply with one short sentence confirming the connection works." }],
      documents: [],
      maxTokens: 100,
      timeoutMs: 25000,
    });
    return {
      model: result.model,
      output: result.output,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      cacheReadInputTokens: result.usage.cacheReadInputTokens,
      cacheCreationInputTokens: result.usage.cacheCreationInputTokens,
      latencyMs: result.latencyMs,
      traceId: result.traceId,
    };
  }
}
