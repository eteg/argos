# 0001 Stack, staging e fluxo de trabalho (D01)

- **Data:** 25/11/2026
- **Situação:** aceita

## Contexto

O Argos é um app web pro celular: o engenheiro grava áudio e fotos ao longo do dia, e a IA preenche o RDO (Relatório Diário de Obra). O repositório só tinha documentação. O roadmap pedia este ADR antes do M0, e ele entra como o primeiro passo do M0, porque o marco começa justamente por montar o repositório.

A web e a API andam separadas e se encontram no [contrato](../contratos/README.md). O M4 exige captura sem internet guardada no celular e enviada depois (`RG07`, sem internet só captura). É um hackathon: o time quer o caminho mais simples que chegue a uma versão no ar em staging.

## Decisão

**Repositório.** Monorepo com pnpm workspaces e Turborepo, TypeScript estrito em tudo, Node na LTS ativa:

| Pasta | O que guarda |
|---|---|
| `apps/web` | O app no celular. |
| `apps/api` | A API. |
| `packages/rdo-schema` | O schema do RDO. |
| `packages/contract` | Os tipos gerados do OpenAPI. |
| `data/` | A obra fictícia e os gabaritos. |
| `infra/staging/` | Compose, Caddy e o script de deploy. |
| `docs/contratos/openapi/` | O OpenAPI, junto das outras camadas do contrato. |

**Web.** Next.js com App Router, como PWA, com Serwist pro service worker. O PWA é a base do M4.

**API.** NestJS, Postgres e Drizzle ORM, com drizzle-kit pras migrations. As migrations rodam quando a API sobe.

**Schema do RDO.** Zod 4, com o JSON Schema gerado dele. A API usa pra validar a saída da IA, e a web pra montar a revisão (`RG06`, RDO em JSON validado pelo schema).

**Contrato.** OpenAPI 3.1, com lint pelo Redocly, tipos pelo openapi-typescript, cliente da web pelo openapi-fetch e servidor falso pelo Prism. A web só conhece a API pelos tipos gerados.

**IA.** SDK oficial da Anthropic, com o modelo numa variável de ambiente, começando com `claude-sonnet-5-5`. Observabilidade no Langfuse Cloud, pelo SDK baseado em OpenTelemetry (`@langfuse/tracing` e `@langfuse/otel`). O pacote `langfuse` é o cliente antigo e não entra. O Langfuse Cloud é reavaliado antes de entrar dado real de obra.

**Staging.** Uma EC2 com Docker Compose rodando web, API, Postgres e Caddy. O Caddy faz o HTTPS e manda `/v1/*` pra API e o resto pra web, no mesmo domínio. Os segredos ficam num `.env` no servidor.

**Deploy.** Um script entra na EC2 por SSH, atualiza a `main` e sobe o Compose. Sem pipeline de deploy e sem infraestrutura como código.

**Fluxo.** Trunk-based, com commits direto na `main`. O CI do GitHub Actions só checa: tipos, lint, build, lint do OpenAPI, tipos gerados em dia e validação dos gabaritos. Sem teste unitário.

### Versões

Fixadas pelo `npm view` em 25/11/2026. Atualização de versão maior é decisão nova.

| Peça | Pacote | Versão |
|---|---|---|
| Node | | 26 (LTS ativa, 26.13.1) |
| Gerenciador | `pnpm` | 12.23.0 |
| Monorepo | `turbo` | 2.11.13 |
| Web | `next` | 16.4.6 |
| PWA | `@serwist/next` | 9.6.0 |
| API | `@nestjs/core` | 12.6.0 (a 12.6.2 saiu no dia e fica barrada pela idade mínima do pnpm) |
| Banco | `drizzle-orm` | 0.45.4 |
| Migrations | `drizzle-kit` | 0.31.11 |
| Schema | `zod` | 4.6.7 |
| IA | `@anthropic-ai/sdk` | 1.14.0 |
| Observabilidade | `@langfuse/tracing`, `@langfuse/otel` | 6.1.1 |
| OpenTelemetry | `@opentelemetry/sdk-node` | 0.301.2 |
| Lint do OpenAPI | `@redocly/cli` | 2.83.0 |
| Tipos do contrato | `openapi-typescript` | 7.13.0 |
| Cliente da web | `openapi-fetch` | 0.17.0 |
| Servidor falso | `@stoplight/prism-cli` | 5.16.0 |

## Consequências

- A web desenvolve contra o Prism sem esperar a API, e qualquer mudança no OpenAPI quebra o build de quem ficou pra trás, porque os tipos são gerados.
- O mesmo schema valida a IA na API e monta a revisão na web, então um campo novo do RDO muda num lugar só.
- O banco roda num contêiner, sem backup gerenciado, e o build acontece no próprio servidor. Isso só é aceitável no staging, com dado fictício. Produção pede outro ADR.
- Sem PR, nada barra um commit ruim na `main`. A revisão depende de disciplina e das checagens do CI, e um erro no schema ou no OpenAPI se espalha pela web, pela API e pelos gabaritos antes de aparecer.
- Sem teste unitário, a conferência de comportamento é manual. Se uma regra começar a quebrar com frequência, o teste entra pra ela.
- O Langfuse Cloud guarda prompt e saída de cada chamada. Com dado fictício não há problema. Com dado real de obra, precisa de nova decisão.
