# Changelog do contrato

## 0.3.0, rascunho

- `SiteSummary.pendingDays` e `SiteDetail.pendingDays` mudam de significado: passam a listar todo dia anterior a hoje com registro e sem RDO aprovado, capturado com ou sem internet (antes, só os capturados sem internet), igual a `listPendingDays` e aos dias que `generateReport` e `approveReport` cobram em `PREVIOUS_DAY_PENDING`. Cada dia ganha `offline`.
- `answerQuestion` com `text` só converte o texto em número quando o campo da pergunta é numérico no schema do RDO (empresa "3" fica "3"). Resposta em texto a uma pergunta de campo estruturado (lista ou objeto, como `labor`, `activities`, `occurrences` e `weatherStoppage`) é guardada na pergunta e não muda o RDO; a web leva ao formulário do bloco em vez de oferecer caixa de texto.
- `getReportPdf` mostra horários e datas no fuso dos registros do dia (`timezone` do primeiro registro), não mais sempre em `America/Sao_Paulo`.
- `listReports` confere o conteúdo do `cursor` (data `YYYY-MM-DD` e `id` UUID) e responde 400 `VALIDATION` no campo `cursor` em vez de 500.
- O RDO é validado pelo tipo da cópia da obra guardada nele (`site.type`), não pelo cadastro atual: trocar o tipo da obra com `updateSite` não quebra `getReport` nem o PDF dos RDOs já montados. O rascunho segue a cópia até `generateReport` ser chamado de novo, que refaz a cópia com o cadastro atual. `validateReport` do `@argos/rdo-schema` aceita `siteType` opcional e, sem ele, usa o `site.type` do RDO.
- `approveReport` responde 409 `PREVIOUS_DAY_PENDING` (com `errors[].field` nas datas) quando um dia anterior da obra tem registro e não tem RDO aprovado, para o número seguir a ordem das datas (D04, D11). A mesma `Idempotency-Key` repetida em paralelo devolve 200 em todas as chamadas, e a web reaproveita a chave do RDO até a aprovação dar certo. `generateReport`, `createEntry` e `uploadMedia` repetidos em paralelo devolvem o recurso já gravado em vez de erro, e o limite de 20 fotos por dia vale também com envios em paralelo. Um RDO montado num dia com mais de 20 fotos leva as 20 primeiras e o histórico diz quantas ficaram de fora.
- Novo 409 `AI_DISABLED` em `correctReportByVoice`, `answerQuestion` com `audioMediaId` e `runAiDiagnostic` quando a IA está desligada no ambiente (`AI_ENABLED=false`). Com a IA desligada a API não chama nenhum serviço de IA, nem a transcrição. `answerQuestion` passa a conferir o `audioMediaId` como `correctReportByVoice`: precisa existir e ser `audio`, senão 400 `VALIDATION` no campo `audioMediaId`.
- M4: `listPendingDays` (`GET /v1/pending-days`) e os schemas `PendingDaysGroup` e `PendingDayDetail`. Só entram obras em andamento e dias anteriores a hoje com registro e sem RDO aprovado; só o mais antigo da obra é `isNext` (D04). O registro capturado sem internet chega com `offline` `true` e o `capturedAt`, `localDate` e `timezone` originais, e o RDO sai com a data da captura.
- M3: `listOpenItems` (`GET /v1/open-items?status=&closedSince=&siteId=`). `getSite`, `getDay` e `SiteSummary.openItemsCount` passam a vir da tabela real de itens em aberto; `Entry.openItemIds` traz os itens que o registro citou e `OpenItem.mentionedToday` o registro do dia que citou cada um. `approveReport` aplica na mesma transação o desfecho de cada `openItemReviews` (`close`, `keep` ou `update`) e abre os `newOpenItems` com `track` `true` (`F1RN09`, `F1RN11`). O agente cobra os itens não citados com perguntas `open_item` de opções `close` e `keep` (`F1RN08`), e `answerQuestion` numa pergunta `open_item` grava o desfecho no rascunho.

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
