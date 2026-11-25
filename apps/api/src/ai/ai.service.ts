import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";
import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { startActiveObservation } from "@langfuse/tracing";
import { toJSONSchema, type z } from "zod";

export interface CompleteParams {
  // Nome da execução no Langfuse, como "diagnostico" ou "preencher-rdo".
  name: string;
  system: string;
  prompt: string;
  effort?: "low" | "medium" | "high";
}

// Toda chamada à IA passa por aqui, pra cair no Langfuse com prompt, saída e tokens.
// O span daqui guarda prompt e saída; o SDK da Anthropic cria dentro dele a generation com modelo, tokens e custo.
@Injectable()
export class AiService {
  private client?: Anthropic;
  private gemini?: GoogleGenAI;
  private readonly model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5-5";
  private readonly transcriptionModel = process.env.GEMINI_MODEL ?? "gemini-3.5-flash-lite";

  complete({ name, system, prompt, effort = "medium" }: CompleteParams) {
    return this.traced(name, { system, prompt }, effort, async () => {
      const response = await this.anthropic().beta.messages.create({
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
      return { text, model: response.model, usage: response.usage };
    });
  }

  // Saída em JSON validada pelo schema Zod (RG06). O schema do RDO tem campos null demais pra saída estruturada
  // da API (limite de 16), então ele vai no prompt, a resposta é validada aqui e, se falhar, a IA corrige uma vez.
  // Prompt caching: a instrução e o JSON Schema são fixos por schema e ficam no system, com o ponto de cache no fim;
  // a mensagem leva só o que muda (obra, memória, relatos). Assim montar, remontar e responder perguntas reaproveitam o prefixo.
  parse<T extends z.ZodType>({ name, system, prompt, effort = "medium", schema }: CompleteParams & { schema: T }) {
    return this.traced(name, { system, prompt }, effort, async (): Promise<z.infer<T>> => {
      const cachedSystem: Anthropic.Beta.BetaTextBlockParam[] = [
        { type: "text", text: system },
        {
          type: "text",
          text: `Responda só com um objeto JSON válido neste JSON Schema, sem texto antes ou depois:\n${JSON.stringify(toJSONSchema(schema))}`,
          cache_control: { type: "ephemeral" },
        },
      ];
      const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: prompt }];
      for (let attempt = 0; attempt < 2; attempt++) {
        const response = await this.anthropic().beta.messages.create({
          model: this.model,
          max_tokens: 16000,
          system: cachedSystem,
          messages,
          output_config: { effort },
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
        });
        const u = response.usage;
        console.log(`[ia] ${name}: entrada ${u.input_tokens}, cache lido ${u.cache_read_input_tokens ?? 0}, cache gravado ${u.cache_creation_input_tokens ?? 0}`);
        if (response.stop_reason === "refusal") throw new Error("AI refused");
        if (response.stop_reason === "max_tokens") throw new Error("AI output truncated");
        const text = response.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
        const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
        let problem: string;
        try {
          const result = schema.safeParse(JSON.parse(json));
          if (result.success) return result.data;
          problem = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
        } catch {
          problem = "a resposta não é um JSON válido";
        }
        messages.push({ role: "assistant", content: response.content }, { role: "user", content: `O JSON não passou na validação: ${problem}. Corrija e responda só com o JSON.` });
      }
      throw new Error("AI output did not match the schema");
    });
  }

  // A Claude não recebe áudio: a transcrição é do Gemini.
  transcribe(audio: Buffer, mimeType: string) {
    return this.traced("transcrever-audio", { mimeType, bytes: audio.length }, "low", async () => {
      // Sem limite, um modelo lento deixa o registro preso em processing.
      this.gemini ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, httpOptions: { timeout: 60_000 } });
      const response = await this.gemini.models.generateContent({
        model: this.transcriptionModel,
        contents: [
          {
            role: "user",
            parts: [
              { inlineData: { mimeType, data: audio.toString("base64") } },
              {
                text:
                  "Transcreva este áudio de um engenheiro numa obra, em português do Brasil, exatamente como foi falado. " +
                  "Mantenha números, horários, nomes e o jargão de obra. Responda só com a transcrição, sem comentários.",
              },
            ],
          },
        ],
      });
      return (response.text ?? "").trim();
    });
  }

  private anthropic() {
    return (this.client ??= new Anthropic());
  }

  private traced<R>(name: string, input: unknown, effort: string, fn: () => Promise<R>): Promise<R> {
    return startActiveObservation(name, async (span) => {
      span.update({ input, metadata: { effort } });
      try {
        const output = await fn();
        span.update({ output });
        return output;
      } catch (error) {
        span.update({ level: "ERROR", statusMessage: String(error) });
        // Sem credencial, a IA fora ou recusa: pra web é tudo "não deu agora".
        console.error(error);
        throw new ServiceUnavailableException("AI unavailable");
      }
    });
  }
}
