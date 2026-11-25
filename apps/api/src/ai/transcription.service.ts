import { Injectable, Logger } from "@nestjs/common";
import { ProblemException } from "../common/problem.js";
import { aiEnabled, aiFake, env } from "../config/env.js";
import { fakeTranscript } from "./fake-ai.js";

const PROMPT = `Transcreva fielmente o áudio, em português do Brasil, de um engenheiro falando num canteiro de obras.
- Escreva só o que foi dito, sem completar, resumir nem corrigir.
- Mantenha números, medidas e nomes de materiais como foram falados.
- Se não houver fala audível (silêncio, ruído, música), responda exatamente: [sem fala]`;

const ATTEMPT_TIMEOUT_MS = 20_000;
const HEDGE_AFTER_MS = 4_000;

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
}

@Injectable()
export class TranscriptionService {
  private readonly logger = new Logger(TranscriptionService.name);

  private async call(model: string, body: string, signal: AbortSignal): Promise<string> {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "x-goog-api-key": env.GEMINI_API_KEY ?? "", "content-type": "application/json" },
      body,
      signal: AbortSignal.any([signal, AbortSignal.timeout(ATTEMPT_TIMEOUT_MS)]),
    });
    if (!response.ok) throw new Error(`${model}: ${response.status} ${(await response.text()).slice(0, 120)}`);
    const data = (await response.json()) as GeminiResponse;
    const text = (data.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("").trim();
    return /^\[?\s*sem fala\s*\]?\.?$/i.test(text) ? "" : text;
  }

  // Dispara o modelo principal e, se ele demorar ou falhar, o próximo em paralelo: vale a primeira resposta.
  async transcribe(audio: Buffer, mimeType: string): Promise<string> {
    if (!aiEnabled()) throw new ProblemException(409, "AI_DISABLED", "The AI is turned off in this environment.");
    if (aiFake()) return fakeTranscript(audio);
    if (!env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not set.");
    const models = [env.GEMINI_MODEL, ...env.GEMINI_FALLBACK_MODELS.split(",").map((m) => m.trim()).filter(Boolean)];
    const attempts = [...models, ...models];
    const body = JSON.stringify({
      contents: [{ parts: [{ inline_data: { mime_type: mimeType, data: audio.toString("base64") } }, { text: PROMPT }] }],
      generationConfig: { temperature: 0 },
    });
    const startedAt = Date.now();

    return new Promise<string>((resolve, reject) => {
      const controllers: AbortController[] = [];
      const timers: NodeJS.Timeout[] = [];
      let next = 0;
      let inFlight = 0;
      let done = false;
      let lastError = "";

      const finish = (action: () => void) => {
        done = true;
        timers.forEach(clearTimeout);
        controllers.forEach((c) => c.abort());
        action();
      };

      const launch = () => {
        if (done || next >= attempts.length) return;
        const model = attempts[next++]!;
        const controller = new AbortController();
        controllers.push(controller);
        inFlight++;
        timers.push(setTimeout(launch, HEDGE_AFTER_MS));
        this.call(model, body, controller.signal).then(
          (text) => {
            if (done) return;
            this.logger.log(`Transcribed with ${model} in ${Date.now() - startedAt} ms`);
            finish(() => resolve(text));
          },
          (error: unknown) => {
            if (done) return;
            inFlight--;
            lastError = error instanceof Error ? error.message : String(error);
            this.logger.warn(`Transcription attempt failed: ${lastError}`);
            if (next < attempts.length) launch();
            else if (inFlight === 0) finish(() => reject(new Error(`Transcription failed: ${lastError}`)));
          },
        );
      };

      launch();
    });
  }
}
