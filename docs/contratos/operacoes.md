# Operações

As operações que as [telas](telas/README.md) usam. Método e rota são sugestões até o OpenAPI ser acordado. Sem login, nenhuma operação pede sessão (`RG01`). "Sem internet" marca as escritas que a web guarda e envia depois ([convenções](convencoes.md#escrita-sem-internet)). "Demorada" marca as que respondem 202 e passam pela IA ([convenções](convencoes.md#operações-demoradas)).

## Engenheiro e configuração

| Operação | Método e rota | Telas | Marco | Nota |
|---|---|---|---|---|
| `getMe` | `GET /v1/me` | `2.1`, `2.4` | M1 | Nome e empresa do engenheiro configurado. |
| `getConfig` | `GET /v1/config` | todas | M1 | Limites de fotos, dias do destaque e raio de reconhecimento da obra. |

## Obras

| Operação | Método e rota | Telas | Marco | Nota |
|---|---|---|---|---|
| `listSites` | `GET /v1/sites?status=&search=` | `2.1`, `2.5`, `2.11` | M1 | Obras resumidas, com `today`, `pendingDays` e `distanceMeters`. Sem `status`, só `in_progress`. Ordena pela distância quando vem `X-Device-Location`. |
| `createSite` | `POST /v1/sites` | `2.2`, `2.2b` | M1 | Nasce com o status de [D02]. |
| `getSite` | `GET /v1/sites/{siteId}` | `2.3` | M1 | A obra inteira, mais `today`, os itens em aberto e os 3 últimos RDOs aprovados. |
| `updateSite` | `PATCH /v1/sites/{siteId}` | `2.2`, `2.2b` | M1 | Vale pros RDOs montados depois. Os já montados guardam a cópia do dia. |
| `changeSiteStatus` | `PUT /v1/sites/{siteId}/status` | `2.10`, `2.11` | M1 | 409 `SITE_HAS_OPEN_REPORTS` ao concluir com RDO não aprovado (`RG08`). |
| `importServices` | `PUT /v1/sites/{siteId}/services` | `2.2`, `2.2b` | M1 | Upload da planilha. Substitui a lista e responde a quantidade importada. 422 `SPREADSHEET_UNREADABLE` quando não acha código e descrição. |
| `listServices` | `GET /v1/sites/{siteId}/services?search=` | `3.3`, `3.3b` | M2 | Pra escolher o serviço de uma atividade. |
| `addEquipment` | `POST /v1/sites/{siteId}/equipment` | `2.2`, `2.2b` | M1 | |
| `updateEquipment` | `PATCH /v1/sites/{siteId}/equipment/{equipmentId}` | `2.2`, `2.2b` | M1 | |
| `removeEquipment` | `DELETE /v1/sites/{siteId}/equipment/{equipmentId}` | `2.2`, `2.2b` | M1 | Some dos RDOs seguintes, não dos já montados. |
| `uploadSiteDocument` | `POST /v1/sites/{siteId}/documents` | `2.2`, `2.2b` | M1 | Arquivo e `type`. |
| `updateSiteDocument` | `PATCH /v1/sites/{siteId}/documents/{documentId}` | `2.2`, `2.2b` | M1 | Troca o `type`. |
| `removeSiteDocument` | `DELETE /v1/sites/{siteId}/documents/{documentId}` | `2.2`, `2.2b` | M1 | |

## Registro do dia

| Operação | Método e rota | Telas | Marco | Sem internet | Demorada |
|---|---|---|---|---|---|
| `uploadMedia` | `PUT /v1/media/{mediaId}` | `3.2`, `3.6` | M1 | ✓ | |
| `createEntry` | `POST /v1/sites/{siteId}/entries` | `3.2`, `3.6` | M1 | ✓ | ✓ a partir do M2 |
| `getEntry` | `GET /v1/entries/{entryId}` | `3.2` | M2 | | |
| `getDay` | `GET /v1/sites/{siteId}/days/{localDate}` | `3.1` | M1 | | |
| `listPendingDays` | `GET /v1/pending-days` | `2.1`, `2.6` | M4 | | |
| `answerQuestion` | `POST /v1/questions/{questionId}/answer` | `3.2`, `3.3`, `3.3b`, `3.7` | M2 | | ✓ com resposta falada |

## RDO

| Operação | Método e rota | Telas | Marco | Demorada | Nota |
|---|---|---|---|---|---|
| `generateReport` | `POST /v1/sites/{siteId}/days/{localDate}/report` | `3.1`, `3.2`, `2.6` | M2 | ✓ | "Gerar RDO" e "Fechar o dia". Chamar de novo remonta o rascunho com os registros novos. 409 `PREVIOUS_DAY_PENDING` quando um dia anterior da obra ainda não tem RDO aprovado ([D04]). 409 `REPORT_ALREADY_APPROVED`. |
| `getReport` | `GET /v1/reports/{reportId}` | `3.3`, `3.3b`, `3.7`, `3.4`, `2.9` | M2 | | |
| `updateReport` | `PATCH /v1/reports/{reportId}` | `3.3`, `3.3b`, `3.7` | M2 | | Correção à mão de qualquer campo. Entra no `history`. 409 `REPORT_ALREADY_APPROVED`. |
| `correctReportByVoice` | `POST /v1/reports/{reportId}/voice-corrections` | `3.3`, `3.3b` | M2 | ✓ | "Corrigir falando", com o áudio e, opcionalmente, a seção. |
| `approveReport` | `POST /v1/reports/{reportId}/approve` | `3.3`, `3.3b` | M2 | | Com `Idempotency-Key`. 409 `REPORT_INCOMPLETE` com os campos que faltam (`RG06`). Fecha, mantém ou atualiza os itens em aberto e cria os novos (`F1RN09`, `F1RN11`). |
| `getReportPdf` | `GET /v1/reports/{reportId}/pdf` | `3.4`, `3.5`, `2.9` | M5 | | Só do aprovado. `application/pdf`. |
| `listReports` | `GET /v1/sites/{siteId}/reports?status=approved&cursor=` | `2.3`, `2.11` | M5 | | Do mais novo pro mais antigo. |

## Itens em aberto

| Operação | Método e rota | Telas | Marco | Nota |
|---|---|---|---|---|
| `listOpenItems` | `GET /v1/open-items?status=&closedSince=` | `2.8` | M3 | Agrupa por obra na web. Sem `status`, só os abertos. |

O desfecho de um item não tem operação própria: ele vai no rascunho do RDO (`openItemReviews`) e só vale quando o RDO é aprovado (`F1RN11`, memória só do aprovado).

[D02]: ../roadmap/ROADMAP.md#decisões-em-aberto
[D04]: ../roadmap/ROADMAP.md#decisões-em-aberto
