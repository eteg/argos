import { Controller, HttpException, HttpStatus, Inject, Post } from "@nestjs/common";
import { AiService } from "./ai.service";

const LIMIT_PER_MINUTE = 5;

// Diagnóstico da IA de ponta a ponta. Tem limite de chamadas, porque a chave da API vai no app (ADR 0002).
@Controller("ai")
export class AiController {
  private calls: number[] = [];

  constructor(@Inject(AiService) private readonly ai: AiService) {}

  @Post("diagnostics")
  async diagnostics() {
    const now = Date.now();
    this.calls = this.calls.filter((t) => now - t < 60_000);
    if (this.calls.length >= LIMIT_PER_MINUTE) throw new HttpException("Rate limited", HttpStatus.TOO_MANY_REQUESTS);
    this.calls.push(now);
    return this.ai.complete({
      name: "diagnostico",
      system: "Você é o agente do Argos, que preenche o RDO (Relatório Diário de Obra).",
      prompt: "Responda em uma frase curta que está pronto pra preencher o RDO.",
      effort: "low",
    });
  }
}
