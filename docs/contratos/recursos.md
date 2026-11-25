# Recursos

O modelo de dados que sai das [telas](telas/README.md). Os campos seguem as [convenções](convencoes.md), e o comportamento de cada um está na tela que o usa. Nomes e formatos são propostas até o OpenAPI ser acordado.

A coluna Origem segue a matriz de campos do [guia do time]: **Obra** é preenchido uma vez, no cadastro da obra; **RDO** é registrado em cada dia. O RDO guarda uma cópia dos dados da obra no dia em que foi montado, pra uma edição posterior da obra não mudar um RDO já aprovado.

## Enums

| Enum | Valores | Usado em |
|---|---|---|
| `siteType` | `private`, `public`, `financed` | Obra (`RG02`) |
| `siteStatus` | `not_started`, `in_progress`, `paused`, `completed` | Obra (`RG08`) |
| `documentType` | `architectural`, `structural`, `plumbing`, `electrical_telecom`, `hvac`, `fire_protection`, `as_built` | Documento da obra (`RG02`) |
| `entryStatus` | `processing`, `processed`, `failed` | Registro |
| `mediaSource` | `camera`, `microphone` | Mídia |
| `reportStatus` | `generating`, `draft`, `approved` | RDO ([D08]) |
| `dayState` | `no_entries`, `in_progress`, `draft`, `approved` | Resumo do dia de uma obra |
| `shift` | `morning`, `afternoon` | Clima |
| `weather` | `good`, `cloudy`, `light_rain`, `heavy_rain` | Clima |
| `workCondition` | `workable`, `partially_workable`, `unworkable` | Clima |
| `employment` | `own`, `third_party` | Efetivo |
| `laborCategory` | `direct`, `indirect` | Efetivo (recomendado) |
| `equipmentStatus` | `operating`, `stopped`, `under_maintenance` | Equipamento no RDO |
| `activityStatus` | `started`, `in_progress`, `completed`, `stopped` | Atividade |
| `occurrenceType` | `stoppage`, `accident`, `material_shortage`, `equipment_failure`, `inspection_order`, `visit`, `external_interference`, `other` | Ocorrência |
| `occurrenceStatus` | `open`, `closed` | Ocorrência |
| `safetyType` | `accident`, `incident` | Segurança (`F1RN04`) |
| `openItemKind` | `declared_pending`, `unresolved_occurrence`, `unfinished_service` | Item em aberto (`F1RN06`) |
| `openItemStatus` | `open`, `closed` | Item em aberto |
| `openItemOutcome` | `close`, `keep`, `update` | Desfecho no RDO (`F1RN09`) |
| `questionKind` | `missing_field`, `open_item`, `service_match`, `safety` | Pergunta do agente |
| `questionStatus` | `open`, `answered` | Pergunta do agente |
| `historyActor` | `agent`, `engineer` | Histórico de alterações |

## Engenheiro

Sem login, a API atende um engenheiro só, configurado no ambiente (`RG01`).

| Campo | Tipo | Nota |
|---|---|---|
| `id` | texto | |
| `name` | texto | "Rafael Lima" no menu (`2.4`). O início usa o primeiro nome. |
| `title` | texto | "Eng. Rafael Lima" no RDO. |
| `company` | texto | "Construtora Horizonte" no menu. |

## Configuração

Números que as regras deixam no ambiente, pra web não fixar no código.

| Campo | Tipo | Valor | Regra |
|---|---|---|---|
| `maxPhotosPerEntry` | inteiro | 3 | `F1RN01` |
| `minPhotosPerReport` | inteiro | 3 | `F1RN02` |
| `maxPhotosPerReport` | inteiro | 20 | `F1RN01` |
| `openItemHighlightDays` | inteiro | 4 | `F1RN10` ([D03]) |
| `geofenceRadiusMeters` | inteiro | 150 | "O app reconhece a obra quando você está a até 150 m" (`2.2`) |

## Obra

| Campo | Tipo | Origem | Nota |
|---|---|---|---|
| `id` | texto | | |
| `name` | texto | Obra | |
| `type` | `siteType` | Obra | |
| `status` | `siteStatus` | Obra | `RG08` |
| `statusChangedOn` | data | Obra | "Paralisada desde 03/11", "Concluída em 14/10/2026" (`2.11`). |
| `address` | texto | Obra | |
| `location` | localização | Obra | Centro do canteiro, pra distância e reconhecimento ([D09]). |
| `client` | objeto | Obra | `name` e `taxId` (CNPJ). "Cliente ou contratante". |
| `contractor` | objeto | Obra | `name` e `taxId`. "Contratada". |
| `technicalManager` | objeto | Obra | `name` e `artNumber`. |
| `publicContract` | objeto ou `null` | Obra | Só em obra pública ou financiada. Abaixo. |
| `servicesCount` | inteiro | Obra | "148, da planilha orçamentária". |
| `servicesFileName` | texto ou `null` | Obra | Nome da planilha importada. |
| `equipment` | lista de equipamento | Obra | Abaixo. |
| `documents` | lista de documento | Obra | Abaixo. |
| `createdAt` | instante | | |

### Contrato público

| Campo | Tipo | Nota |
|---|---|---|
| `number` | texto | "045/2026" |
| `commitmentOrAgreement` | texto | Empenho ou convênio, "2026NE000312". |
| `inspectorName` | texto | Fiscal do contrato. |
| `serviceOrderDate` | data | Marco inicial do prazo. |
| `durationDays` | inteiro | Prazo contratual. |
| `amendments` | lista | Aditivos: `id`, `description`, `addedDays`, `signedOn`. |
| `elapsedDays` | inteiro | Calculado pela API a partir da ordem de serviço e da data do RDO. |
| `remainingDays` | inteiro | Calculado: prazo mais aditivos menos o decorrido. |

### Equipamento da obra

| Campo | Tipo | Nota |
|---|---|---|
| `id` | texto | |
| `name` | texto | "Guindaste 30 t" |
| `identifier` | texto ou `null` | Prefixo ou placa, "ABC-1D23". |

### Documento da obra

| Campo | Tipo | Nota |
|---|---|---|
| `id` | texto | |
| `fileName` | texto | "vila-verde-arquitetonico-r2.pdf" |
| `type` | `documentType` | |
| `url` | texto | Link temporário pra abrir. |

### Serviço

Uma linha da planilha orçamentária ou da EAP da obra.

| Campo | Tipo | Nota |
|---|---|---|
| `id` | texto | |
| `code` | texto | "02.05" |
| `description` | texto | "Escavação da fundação" |
| `unit` | texto ou `null` | Unidade da planilha, como `m³` ou `t`. |

### Resumo da obra nas listas

As listas de obras (`2.1`, `2.5`, `2.11`) trazem a obra resumida, mais:

| Campo | Tipo | Nota |
|---|---|---|
| `distanceMeters` | inteiro ou `null` | Com `X-Device-Location`. A web monta "40 m · você está aqui" ([D16], sem tempo de carro). |
| `today` | objeto | `localDate`, `state` (`dayState`), `entriesCount` e `reportId`. |
| `pendingDays` | lista | Dias capturados sem internet que ainda não têm RDO aprovado: `localDate` e `entriesCount`, do mais antigo pro mais novo (`2.6`). |
| `openItemsCount` | inteiro | |

### Obra na pasta

`getSite` traz a obra inteira, mais o que a `2.3` mostra:

| Campo | Tipo | Nota |
|---|---|---|
| `today` | objeto | Como no resumo. |
| `pendingDays` | lista | Como no resumo. |
| `openItems` | lista de item em aberto | Os abertos da obra. |
| `recentReports` | lista | Os 3 últimos RDOs aprovados: `id`, `number`, `localDate`, `approvedAt` e `occurrencesCount`. |
| `approvedReportsCount` | inteiro | "87 no total". |

## Dia de uma obra

O que a `3.1` mostra, por `getDay`.

| Campo | Tipo | Nota |
|---|---|---|
| `site` | resumo da obra | |
| `localDate` | data | |
| `openItems` | lista de item em aberto | Os que vieram dos dias anteriores, com `mentionedToday`. |
| `entries` | lista de registro | Do mais novo pro mais antigo. |
| `report` | objeto ou `null` | `id` e `status` do RDO do dia, quando já foi gerado. |

## Dias pendentes

O que a `2.6` mostra, por `listPendingDays`: uma linha por obra, com `site` (resumo) e `days`. Cada dia tem `localDate`, `entriesCount`, `audiosCount`, `photosCount`, `offline` e `isNext`, que é `true` só no mais antigo da obra ([D04]).

## Mídia

Um arquivo de áudio ou foto, enviado antes do registro.

| Campo | Tipo | Nota |
|---|---|---|
| `id` | texto | UUID gerado na web. |
| `kind` | enum | `audio` ou `photo`. |
| `source` | `mediaSource` | Só câmera, com e sem internet ([D10]). |
| `capturedAt` | instante | |
| `location` | localização ou `null` | |
| `durationSeconds` | inteiro ou `null` | Só no áudio. "Áudio · 0:48". |
| `url` | texto | Link temporário. |

## Registro

Um áudio e até 3 fotos de uma obra, num momento do dia (`F1RN01`).

| Campo | Tipo | Nota |
|---|---|---|
| `id` | texto | UUID gerado na web. |
| `siteId` | texto | |
| `capturedAt` | instante | "15:30". |
| `localDate` | data | Dia do RDO a que o registro pertence. |
| `timezone` | texto | |
| `location` | localização ou `null` | "hora e local carimbados". |
| `offline` | booleano | Capturado sem internet. |
| `audio` | mídia ou `null` | |
| `photos` | lista de mídia | Até `maxPhotosPerEntry`. |
| `status` | `entryStatus` | `processing` enquanto a IA interpreta. |
| `transcript` | texto ou `null` | "O que o Argos entendeu". |
| `title` | texto ou `null` | Resumo curto pra linha do dia: "Chuva parou a concretagem". |
| `tags` | lista | O que o agente reconheceu: `kind` (`activity`, `occurrence`, `labor`, `equipment`, `weather`, `safety`) e `label`, como "Ocorrência: falta de material". |
| `openItemIds` | lista de texto | Itens em aberto que o registro citou. "Atualiza um item em aberto". |
| `questions` | lista de pergunta | Perguntas do agente durante o registro (`F1RN08`). |

## Pergunta do agente

O que a IA não sabe, ela pergunta (`RG05`, nenhum campo inventado).

| Campo | Tipo | Nota |
|---|---|---|
| `id` | texto | |
| `kind` | `questionKind` | |
| `text` | texto | "Ontem você registrou a betoneira 2 parada para manutenção. Ela voltou a funcionar?" |
| `field` | texto ou `null` | Caminho do campo no RDO, como `weather.morning.weather` ou `activities.0.serviceId`. |
| `openItemId` | texto ou `null` | Em `open_item`. |
| `options` | lista | Respostas prontas: `id` e `label`, como "Voltou, pode fechar". Vazia quando a resposta é livre. |
| `status` | `questionStatus` | |
| `answer` | objeto ou `null` | `optionId`, `text` ou `audioMediaId`, e `answeredAt`. |

## RDO

Um por obra e por dia, montado a partir dos registros do dia.

| Campo | Tipo | Origem | Nota |
|---|---|---|---|
| `id` | texto | | |
| `siteId` | texto | | |
| `number` | inteiro | RDO | Sequencial por obra, sem saltos ([D11]). "Nº 088". |
| `localDate` | data | RDO | O dia da semana é calculado na web. |
| `status` | `reportStatus` | RDO | |
| `entriesCount` | inteiro | | "Montado a partir dos 4 registros de hoje". |
| `site` | objeto | Obra | Cópia dos dados da obra no dia: nome, tipo, endereço, partes, responsável, contrato público com o decorrido e o que falta. |
| `workday` | objeto | RDO | `startTime`, `endTime`, `breakMinutes`. |
| `weather` | lista | RDO | Um por turno: `shift`, `weather`, `condition`. |
| `weatherStoppage` | objeto ou `null` | RDO | Horas paradas por clima (`hours`) e serviços afetados (`serviceIds`). Obrigatório em obra pública ou financiada. |
| `rainfallMm` | número ou `null` | RDO | Recomendado. |
| `labor` | lista | RDO | `role`, `count`, `employment`, `company` (no terceiro), `category`. |
| `laborNotes` | texto ou `null` | RDO | Ausências ou efetivo abaixo do previsto. Recomendado. |
| `equipment` | lista | Obra e RDO | O equipamento vem da obra (`equipmentId`, `name`, `identifier`), e o RDO guarda `status` e `operatingHours`. |
| `activities` | lista | Obra e RDO | Abaixo. |
| `occurrences` | lista | RDO | Abaixo. |
| `openItemReviews` | lista | RDO | Desfecho de cada item que veio dos dias anteriores: `openItemId`, `outcome`, `note`. |
| `newOpenItems` | lista | RDO | Itens que nascem neste RDO: `id`, `title`, `kind`, `track` (`true` pra abrir, `false` pra não acompanhar). |
| `photos` | lista | RDO | Mídia mais `caption` e `linkedTo` (`activity` ou `occurrence`, com o `id`). |
| `photoRequirements` | lista | RDO | Em obra pública ou financiada, cada atividade ou ocorrência que ainda não tem foto (`F1RN02`): `linkedTo` e `label`. |
| `questions` | lista de pergunta | RDO | As que ainda estão abertas aparecem na revisão. |
| `missingFields` | lista | RDO | Campos obrigatórios vazios: `field` e `questionId`. Vazia quando o RDO pode ser aprovado (`RG06`). |
| `approval` | objeto ou `null` | RDO | `approvedBy` (nome), `approvedAt` (`F1RN05`). |
| `history` | lista | RDO | `at`, `actor` e `description`. Obrigatório em obra pública ou financiada. |
| `pdfUrl` | texto ou `null` | | Só no aprovado. |

### Atividade

| Campo | Tipo | Origem | Nota |
|---|---|---|---|
| `id` | texto | | |
| `description` | texto | RDO | Como o engenheiro falou: "Concretagem da laje". |
| `service` | serviço ou `null` | Obra | Escolhido da planilha da obra. `null` quando a IA não achou com certeza, e aí há uma pergunta `service_match`. |
| `location` | texto | RDO | "Bloco B". |
| `status` | `activityStatus` | RDO | |
| `quantity` | número ou `null` | RDO | Obrigatório em obra pública ou financiada. |
| `unit` | texto ou `null` | RDO | |
| `cumulativeProgressPercent` | número ou `null` | RDO | Recomendado. Calculado pela API a partir das quantidades. |
| `executor` | texto ou `null` | RDO | Recomendado. |

### Ocorrência

| Campo | Tipo | Origem | Nota |
|---|---|---|---|
| `id` | texto | | |
| `type` | `occurrenceType` | RDO | |
| `description` | texto | RDO | |
| `startTime` | horário | RDO | |
| `endTime` | horário ou `null` | RDO | `null` enquanto aberta. |
| `status` | `occurrenceStatus` | RDO | |
| `affectedServiceIds` | lista de texto | RDO | Obrigatório em obra pública ou financiada. |
| `source` | objeto ou `null` | RDO | `origin` e `document`, como "e-mail do fiscal de 23/11". Obrigatório em obra pública ou financiada. |
| `materials` | texto ou `null` | RDO | Materiais recebidos ou em falta. |
| `safety` | objeto ou `null` | RDO | Obrigatório quando o áudio indica acidente (`F1RN04`): `type` (`safetyType`), `dds` (booleano), `ppeInUse` (booleano). A descrição e o horário ficam na ocorrência. |

## Item em aberto

O que ficou pendente num RDO aprovado, por obra (`F1RN06`, `F1RN11`).

| Campo | Tipo | Nota |
|---|---|---|
| `id` | texto | |
| `siteId` | texto | |
| `title` | texto | "Infiltração no subsolo do bloco A" |
| `kind` | `openItemKind` | "Ocorrência sem desfecho". |
| `status` | `openItemStatus` | |
| `openedOn` | data | A web calcula "há 4 dias" e o destaque (`F1RN10`). |
| `openedInReportId` | texto | |
| `lastUpdate` | objeto ou `null` | `localDate` e `note`: "25/11: aguardando impermeabilizante". |
| `closedOn` | data ou `null` | |
| `closingNote` | texto ou `null` | "voltou a funcionar" |
| `mentionedToday` | objeto ou `null` | Só no resumo do dia: `entryId` e `capturedAt`, "citada às 08:12". `null` quando ainda não foi citado (`F1RN08`). |

[guia do time]: https://claude.ai/artifact/9VhpdMpFe4kdAbJKgfADDQ
[D03]: ../roadmap/ROADMAP.md#decisões-em-aberto
[D04]: ../roadmap/ROADMAP.md#decisões-em-aberto
[D08]: ../roadmap/ROADMAP.md#decisões-em-aberto
[D09]: ../roadmap/ROADMAP.md#decisões-tomadas
[D10]: ../roadmap/ROADMAP.md#decisões-tomadas
[D16]: ../roadmap/ROADMAP.md#decisões-tomadas
[D11]: ../roadmap/ROADMAP.md#decisões-em-aberto
