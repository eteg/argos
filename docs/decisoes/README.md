# Decisões

Cada decisão de arquitetura que muda a construção vira um ADR aqui. O ADR registra o que foi decidido, por quê e o que isso custa. A decisão de negócio continua no [guia do time](https://claude.ai/artifact/9VhpdMpFe4kdAbJKgfADDQ), e o [roadmap](../roadmap/ROADMAP.md#decisões-tomadas) aponta pro ADR.

## Formato

Um arquivo por decisão, numerado em ordem (`0001-<slug>.md`), com estas seções:

- **Título**, com o ID da decisão no roadmap quando houver, como D01.
- **Data** e **Situação**: `proposta`, `aceita` ou `substituída por <ADR>`.
- **Contexto:** o problema e o que limita a escolha.
- **Decisão:** o que vale a partir de agora.
- **Consequências:** o que fica mais fácil, o que fica mais difícil e o que pede outro ADR depois.

ADR aceito não se reescreve. Se a decisão mudar, um ADR novo substitui o antigo, e o antigo passa a `substituída por`.

## Índice

| ADR | Decisão | Situação |
|---|---|---|
| [0001](0001-stack-e-staging.md) | Stack, staging e fluxo de trabalho (D01) | aceita |
| [0002](0002-chave-da-api-sem-login.md) | Chave da API sem login (D07) | aceita |
| [0003](0003-codigo-da-ia-em-packages-agent.md) | Código da IA em `packages/agent` (D19) | aceita |
| [0004](0004-transcricao-do-audio-com-gemini.md) | Transcrição do áudio com Gemini (D17) | aceita |
