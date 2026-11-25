# Changelog do contrato

## 0.3.0, rascunho

- M4: `listPendingDays` (`GET /v1/pending-days`) e os schemas `PendingDaysGroup` e `PendingDayDetail`. Só entram obras em andamento e dias anteriores a hoje com registro e sem RDO aprovado; só o mais antigo da obra é `isNext` (D04). O registro capturado sem internet chega com `offline` `true` e o `capturedAt`, `localDate` e `timezone` originais, e o RDO sai com a data da captura.

- IA no M2: `createEntry` responde 202 com `status` `processing` quando há IA no ambiente (a API transcreve o áudio e resume o registro em segundo plano) e 201 sem IA; a web consulta `getEntry`. `generateReport` responde 202 `generating` e a IA preenche só o que está vazio, com cada lacuna obrigatória virando uma pergunta. Novo `correctReportByVoice` (`POST /v1/reports/{reportId}/voice-corrections`). Novo 409 `REPORT_NOT_READY` em `updateReport`, `approveReport` e `correctReportByVoice` enquanto o RDO está em `generating`. `answerQuestion` com opção ou texto aplica a resposta no campo da pergunta (`field`).
- M5: `getReportPdf` (`GET /v1/reports/{reportId}/pdf`, `application/pdf`, 409 `REPORT_NOT_APPROVED` fora do aprovado, nome sugerido em `Content-Disposition`) e `listReports` (`GET /v1/sites/{siteId}/reports`, só `status=approved`, `limit` padrão 20 e máximo 50, cursor, schema `ReportListItem`). `Report.pdfUrl` vem preenchido no aprovado.

- `updateReport` (`PATCH /v1/reports/{reportId}`): corrige campos do rascunho, grava no `history` e responde 409 `REPORT_ALREADY_APPROVED` no aprovado. `generateReport` de novo mantém as correções.
- `answerQuestion` responde 200 com opção ou texto e 202 com áudio (sem IA ainda, só guarda a resposta). `getEntry` implementado.
- `approveReport` responde 400 sem `Idempotency-Key` e 409 `REPORT_ALREADY_APPROVED` com outra chave.
- Base do M2 no OpenAPI: `getEntry`, `answerQuestion`, `generateReport` (202), `getReport` e `approveReport` (com `Idempotency-Key`), mais os schemas `Report`, `Workday` e `AnswerQuestionRequest`. `Report.site` ficou igual ao `site` do `@argos/rdo-schema`. `generateReport` responde 409 `NO_ENTRIES` num dia sem registro. `listServices` e o schema `Service`.

## 0.2.0, acordado

Acordado em 25/11/2026 por decisão de Jeferson Augusto de Melo Gomes (D18), valendo pra web e pra API, sem revisão em PR. Cobre as convenções, as obras e o que o registro do dia usa no M1. A revisão final do M0 e do M1 fica pro time todo.

- Convenções: chave por ambiente em `X-Api-Key` (todas as rotas menos `getHealth`), erros 401 `UNAUTHORIZED` e 429 `RATE_LIMITED`, e limites de upload (áudio 10 MB, foto 15 MB, documento 50 MB, planilha 10 MB). O 415 passou pra ordem certa da tabela.
- D02: `createSite` cria a obra `in_progress`.
- D09: `location` é opcional em `createSite` e `updateSite`. Sem ela, a API busca pelo endereço, o que exige um serviço de geocodificação na API do M1.
- D10: o valor `gallery` saiu do enum `mediaSource`. Só câmera. Remover valor de enum pediria `/v2`, mas o contrato ainda não foi acordado.
- D12: o check-in (`2.5`) não grava nada na API.
- D15 e D16: saíram da `2.1` o aviso de renovação da ART e o tempo de carro. `distanceMeters` fica só com a distância.
- OpenAPI 3.1 do M1 em `openapi/openapi.yaml`, mais `getHealth` e `runAiDiagnostic`, com lint, tipos gerados em `packages/contract` e servidor falso (`pnpm mock`).
- `uploadMedia` aceita `durationSeconds` opcional (o áudio mostra "0:48" e a API não decodifica o arquivo).
- `createEntry` responde 201 no M1. A partir do M2 vira operação demorada e responde 202.
- Processo: o contrato entra na `main` depois da revisão do outro lado, sem PR.

## 0.1.0, rascunho, 25/11/2026

- Primeira versão, escrita a partir do protótipo e do guia do time: convenções, telas, recursos, operações e os fluxos do RDO do dia e do registro sem internet.
- Termos do domínio em inglês: `site` (obra), `report` (RDO), `entry` (registro), `openItem` (item em aberto), `service` (serviço da planilha) e `question` (pergunta do agente).
- Sem login (`RG01`): nenhuma operação pede sessão.
- O serviço de cada atividade e a identificação dos equipamentos vêm do cadastro da obra, conforme a coluna "Origem do dado" do guia.
- O OpenAPI ainda não existe. Nasce no M0, a partir destas camadas.
