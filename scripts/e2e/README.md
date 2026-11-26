# Testes de ponta a ponta da API

Scripts que chamam a API de verdade, num banco só de teste, e imprimem `ok` ou `FAIL` por verificação. Não são testes unitários e não rodam no CI.

## Preparar

```
docker exec dev-postgres-1 psql -U argos -d postgres -c "DROP DATABASE IF EXISTS argos_test" -c "CREATE DATABASE argos_test"
cd apps/api && pnpm build
PORT=3101 DATABASE_URL=postgres://argos:argos@localhost:5432/argos_test AI_ENABLED=false \
  UPLOAD_DIR=/tmp/argos-test-uploads API_PUBLIC_URL=http://localhost:3101 node --env-file=.env dist/main.js
```

Para os scripts que precisam da IA, suba a API com `AI_ENABLED=true AI_FAKE=true`: a transcrição e o agente viram respostas fixas e nada sai para o Gemini ou a Anthropic. Nunca rode estes scripts contra a IA real.

## Rodar

```
pnpm exec tsx scripts/e2e/<script>.mts                # API com a IA desligada
E2E_AI=fake pnpm exec tsx scripts/e2e/<script>.mts    # API com AI_FAKE=true
```

`E2E_API` e `E2E_DATABASE_URL` trocam o endereço da API e do banco (padrão `http://localhost:3101` e `argos_test`).

| Script | Modo | O que cobre |
|---|---|---|
| `e2e` | desligada | Obras, mídia, registros, dia e serviços |
| `e2e-report`, `e2e-update`, `e2e-approve`, `e2e-safety`, `e2e-pub` | desligada | RDO: montagem, correção, aprovação, segurança e obra pública |
| `e2e-m2`, `e2e-m3` | desligada | Perguntas do agente e itens em aberto |
| `r1-pdf-list` | desligada | PDF e lista de RDOs com cursor |
| `fuso-pdf` | desligada | Horários do PDF no fuso dos registros |
| `r2-pending-services` | desligada | Dias pendentes e planilha de serviços |
| `r3-answer-voice` | as duas | Respostas às perguntas e correção falada |
| `r4-concorrencia`, `r4b-sonda-fotos` | desligada | Chamadas em paralelo, limite de fotos e ordem dos dias |
| `r5-regras` | desligada | Códigos de erro das regras e troca do tipo da obra |
| `web-datas` | sem API | Dia local da gravação e mensagem de dia anterior pendente da web |
| `ia-falsa` | falsa | Registro, montagem e correção falada com `AI_FAKE` |
| `ia-regenerar` | falsa | Gerar de novo recalcula o que não foi editado e mantém o editado |
| `ia-atraso` | falsa | Montagem atrasada não grava por cima de aprovado, de geração nova nem de correção |
