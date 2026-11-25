import { Injectable, Logger } from "@nestjs/common";
import { env } from "../config/env.js";

const PROMPT = `Transcreva fielmente o áudio, em português do Brasil, de um engenheiro falando num canteiro de obras.
- Escreva só o que foi dito, sem completar, resumir nem corrigir.
- Mantenha números, medidas e nomes de materiais como foram falados.
- Se não houver fala audível (silêncio, ruído, música), responda exatamente: [sem fala]`;

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
}

@Injectable()
export class TranscriptionService {
  private readonly logger = new Logger(TranscriptionService.name);

  async transcribe(audio: Buffer, mimeType: string): Promise<string> {
    if (!env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not set.");
    const body = JSON.stringify({
      contents: [{ parts: [{ inline_data: { mime_type: mimeType, data: audio.toString("base64") } }, { text: PROMPT }] }],
      generationConfig: { temperature: 0 },
    });
    const models = [env.GEMINI_MODEL, ...env.GEMINI_FALLBACK_MODELS.split(",").map((m) => m.trim()).filter(Boolean)];
    let lastError = "";
    for (let attempt = 0; attempt < models.length + 1; attempt++) {
      const model = models[attempt % models.length];
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "x-goog-api-key": env.GEMINI_API_KEY, "content-type": "application/json" },
        body,
        signal: AbortSignal.timeout(20_000),
      }).catch((error: unknown) => error);
      if (response instanceof Response && response.ok) {
        const data = (await response.json()) as GeminiResponse;
        const text = (data.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("").trim();
        return /^\[?\s*sem fala\s*\]?\.?$/i.test(text) ? "" : text;
      }
      lastError = response instanceof Response ? `${response.status} ${(await response.text()).slice(0, 200)}` : String(response);
      this.logger.warn(`Transcription attempt ${attempt + 1} (${model}) failed: ${lastError}`);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    throw new Error(`Transcription failed: ${lastError}`);
  }
}
