import Anthropic from "@anthropic-ai/sdk";
import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { startActiveObservation } from "@langfuse/tracing";

export interface CompleteParams {
  // Nome da execução no Langfuse, como "diagnostico" ou "preencher-rdo".
  name: string;
  system: string;
  prompt: string;
  effort?: "low" | "medium" | "high";
}

// Toda chamada à Claude passa por aqui, pra cair no Langfuse com prompt, saída e tokens.
// O span daqui guarda prompt e saída; o SDK da Anthropic cria dentro dele a generation com modelo, tokens e custo.
@Injectable()
export class AiService {
  private client?: Anthropic;
  private readonly model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5-5";

  complete({ name, system, prompt, effort = "medium" }: CompleteParams) {
    return startActiveObservation(name, async (span) => {
      span.update({ input: { system, prompt }, metadata: { effort } });
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
        if (response.stop_reason === "refusal") throw new Error("AI refused");
        const text = response.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
        span.update({ output: text, metadata: { effort, model: response.model } });
        return { text, model: response.model, usage: response.usage };
      } catch (error) {
        span.update({ level: "ERROR", statusMessage: String(error) });
        // Sem credencial, a Anthropic fora ou recusa: pra web é tudo "não deu agora".
        console.error(error);
        throw new ServiceUnavailableException("AI unavailable");
      }
    });
  }
}
