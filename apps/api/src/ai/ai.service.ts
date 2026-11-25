import Anthropic from "@anthropic-ai/sdk";
import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { startObservation } from "@langfuse/tracing";

export interface CompleteParams {
  // Nome da execução no Langfuse, como "diagnostico" ou "preencher-rdo".
  name: string;
  system: string;
  prompt: string;
  effort?: "low" | "medium" | "high";
}

// Toda chamada à Claude passa por aqui, pra cair no Langfuse com prompt, saída e tokens.
@Injectable()
export class AiService {
  private client?: Anthropic;
  private readonly model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5-5";

  async complete({ name, system, prompt, effort = "medium" }: CompleteParams) {
    const generation = startObservation(
      name,
      { model: this.model, input: { system, prompt }, modelParameters: { effort } },
      { asType: "generation" },
    );
    try {
      this.client ??= new Anthropic();
      const response = await this.client.beta.messages.create({
        model: this.model,
        max_tokens: 16000,
        system,
        messages: [{ role: "user", content: prompt }],
        output_config: { effort },
        // Se o modelo recusar, a própria API tenta outro modelo na mesma chamada.
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
      });
      if (response.stop_reason === "refusal") throw new ServiceUnavailableException("AI refused");
      const text = response.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
      generation.update({
        model: response.model,
        output: text,
        usageDetails: {
          input: response.usage.input_tokens,
          output: response.usage.output_tokens,
          cache_read_input_tokens: response.usage.cache_read_input_tokens ?? 0,
        },
      });
      return { text, model: response.model, usage: response.usage };
    } catch (error) {
      generation.update({ level: "ERROR", statusMessage: String(error) });
      // Sem credencial, a Anthropic fora ou recusa: pra web é tudo "não deu agora".
      console.error(error);
      throw new ServiceUnavailableException("AI unavailable");
    } finally {
      generation.end();
    }
  }
}
