# 0004 Transcrição do áudio com Gemini (D17)

- **Data:** 25/11/2026
- **Situação:** proposta

## Contexto

O registro do engenheiro é um áudio. A API da Claude não aceita áudio: o bloco `audio` não existe na API de mensagens e o bloco `document` só aceita PDF (testado em 25/11/2026). A transcrição precisa vir de outro serviço.

## Decisão

A API transcreve com a API do Gemini (`gemini-3.6-flash`, configurável por `GEMINI_MODEL`), mandando o áudio como veio do celular (`audio/webm` no Chrome). A transcrição entra no agente como texto; a Claude interpreta e monta o RDO. A chave fica em `GEMINI_API_KEY` e a IA inteira desliga com `AI_ENABLED=false`.

Tratamento de silêncio: o prompt manda responder `[sem fala]` sem fala audível, e a API trata isso como transcrição vazia (registro `failed`). Áudio com `durationSeconds` menor que 1 nem é enviado.

## Consequências

- A decisão é **proposta**: foi testada só com fala sintetizada e silêncio. Num teste com um segundo de silêncio o modelo inventou uma frase, e o prompt e a duração mínima existem por causa disso. Falta medir erro de palavras com áudio real de obra, com ruído e jargão, e comparar com outro serviço (AWS Transcribe, por exemplo). Se o resultado for ruim, um novo ADR substitui este.
- A cota e a disponibilidade do modelo variam (houve 429 e 503 nos testes). A API repete até 3 vezes e depois marca o registro como `failed`.
- O áudio do engenheiro sai da API para o Google. Isso precisa de aval de privacidade antes de produção.
- `audio/mp4` (Safari) não foi testado.
