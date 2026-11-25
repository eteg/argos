# Registro do dia

O passo a passo das chamadas está no fluxo do [RDO do dia](../fluxos/rdo-do-dia.md) e no do [registro sem internet](../fluxos/sem-internet.md).

## `2.5` Registrar o dia

O check-in: o engenheiro declara em qual obra vai registrar (`F1RN01`, captura de áudio e fotos).

**Mostra**

| Dado | Campo (`listSites`) | No protótipo |
|---|---|---|
| Obra em que ele está | a de menor `distanceMeters`, dentro de `geofenceRadiusMeters` | "Vila Verde · Bloco B · 40 m · 3 registros hoje" |
| Outras obras sem registro hoje | `today.entriesCount` igual a 0 | "Galpão Contagem · 6,2 km" |
| Dias capturados sem internet | `pendingDays` | "Galpão Contagem · 2 dias · 23/11 e 24/11" |
| Obras com RDO de hoje aprovado | `today.state` `approved` | "Clínica Savassi: RDO de hoje já enviado" |

Só entram obras `in_progress` (`RG08`).

**Ações**

| Ação | Operação | Resultado |
|---|---|---|
| Escolher a obra | | Abre a `3.2` daquela obra. O check-in não chama a API: é só a escolha da obra, e o primeiro registro abre o dia ([D12]). |
| Finalizar dias sem internet | | Abre a `2.6`. |

## `3.1` RDO de hoje

**Mostra (`getDay`)**

| Dado | Campo | No protótipo |
|---|---|---|
| Obra e dia | `site.name`, `localDate` | "Residencial Vila Verde · Bloco B", "Quarta, 25 de novembro" |
| No canteiro | `distanceMeters` dentro do raio | "No canteiro" |
| Ficou dos dias anteriores | `openItems`, com `mentionedToday` | "Infiltração no subsolo do bloco A · não citado hoje · há 4 dias"; "Escavação da fundação · citada às 08:12" |
| Linha do dia | `entries`: `capturedAt`, `title`, a primeira foto ou a duração do áudio, `openItemIds` | "14:05 · Chuva parou a concretagem · Foto"; "10:40 · Efetivo e equipamentos · Áudio · 0:48"; "Atualiza um item em aberto" |
| Estado do RDO | `report.status` | "Gerar RDO" quando não há rascunho |

**Ações**

| Ação | Operação | Resultado | Erros |
|---|---|---|---|
| Registrar | | Abre a `3.2`. | |
| Gerar RDO | `generateReport` | 202. Abre a `3.3` quando o RDO sai de `generating`. | 409 `PREVIOUS_DAY_PENDING`: leva à `2.6`. |

**Sem internet:** mostra o último dia carregado, mais os registros guardados no celular que ainda não subiram. "Gerar RDO" precisa de internet (`RG07`).

## `3.2` Registro por voz

**Envia, em `uploadMedia`**: um arquivo por chamada, com o `id` gerado na web, `kind`, `source`, `capturedAt` e `location`.

**Envia, em `createEntry`**

| Campo | No protótipo | Nota |
|---|---|---|
| `id` | | UUID gerado na web. |
| `capturedAt` | 15:30 | Quando a gravação começou. |
| `localDate`, `timezone` | 2026-11-25, America/Sao_Paulo | |
| `location` | | "hora e local carimbados". |
| `audioMediaId` | | |
| `photoMediaIds` | 2 fotos | No máximo 3 (`F1RN01`). |

**Mostra (`getEntry`, depois de salvar)**

| Dado | Campo | No protótipo |
|---|---|---|
| Número do registro no dia | contado na web a partir de `getDay` | "Registro 4 de hoje" |
| O que o Argos entendeu | `transcript`, `tags` | "Faltou aço CA-50…", "Ocorrência: falta de material", "Atividade: laje do bloco B" |
| Ficou de ontem | `questions` com `kind` `open_item` | "Ontem você registrou a betoneira 2 parada para manutenção. Ela voltou a funcionar?", com "Voltou, pode fechar" e "Continua parada" |
| Próximo item a cobrar | a próxima pergunta `open_item` | "Depois: a infiltração no subsolo do bloco A" |
| Fotos | `photos` | "2 de 3 neste registro" |

**Ações**

| Ação | Operação | Resultado | Erros |
|---|---|---|---|
| Salvar registro | `uploadMedia` de cada arquivo, depois `createEntry` | 202 com `status` `processing`. A web consulta `getEntry` até `processed`. | 409 `SITE_NOT_IN_PROGRESS`. 409 `PHOTO_LIMIT_ENTRY`. 409 `PHOTO_LIMIT_REPORT` quando o dia passaria de 20 fotos. 409 `REPORT_ALREADY_APPROVED` quando o RDO do dia já foi aprovado. |
| Responder uma opção pronta | `answerQuestion` com `optionId` | A pergunta sai da tela e a próxima aparece. O desfecho só vale na aprovação (`F1RN11`). | |
| Responder falando | `uploadMedia` e `answerQuestion` com `audioMediaId` | 202, a IA interpreta a resposta. | |
| Fechar o dia | `createEntry` e `generateReport` | Abre a `3.3`. | |
| Cancelar | | Descarta o que foi gravado, sem chamada. | |

**Sem internet:** vira a `3.6`.

**Pendências:** a tela mostra o que o agente entendeu durante a gravação. O contrato prevê depois de salvar ([D13]).

## `3.6` Registro sem internet

A mesma captura, sem a interpretação (`RG07`). A web guarda o áudio e as fotos no celular e chama `uploadMedia` e `createEntry` quando a internet volta, com `offline` `true` e o `capturedAt` original.

**Mostra:** "Sem internet", "Salvando só no celular" e o aviso de que a transcrição e as perguntas aparecem quando o sinal voltar. Nenhum dado da API.

**Foto:** só câmera, com e sem internet. A tela não oferece a galeria ([D10]).

## `2.7` Aviso de internet de volta

**Mostra:** "Internet de volta. 2 dias do Galpão Contagem foram capturados sem sinal. O RDO está pronto para você finalizar." A web monta o texto a partir do que acabou de enviar ([D14]).

**Ação:** tocar no aviso abre a `2.6`.

## `2.6` Registrar dia anterior

**Mostra (`listPendingDays`)**

| Dado | Campo | No protótipo |
|---|---|---|
| Obra e dias na fila | `site.name`, `days` | "Galpão Contagem · 2 dias na fila" |
| Cada dia | `localDate`, `entriesCount`, quantidade de áudios e fotos, `offline` | "Seg, 23/11 · Capturado sem internet · 1 áudio, 3 fotos" |
| Próximo ou na fila | o mais antigo da obra é o próximo | "Ontem · ter, 24/11 · Libera depois de aprovar o RDO de 23/11" |

**Ações**

| Ação | Operação | Resultado | Erros |
|---|---|---|---|
| Tocar no próximo dia | `generateReport` daquele dia | Abre a `3.3`, ou a `3.3b` em obra pública. | 409 `PREVIOUS_DAY_PENDING` num dia que não é o próximo. |

**Pendências:** [D04] (ordem dos dias).

[D04]: ../../roadmap/ROADMAP.md#decisões-em-aberto
[D10]: ../../roadmap/ROADMAP.md#decisões-tomadas
[D12]: ../../roadmap/ROADMAP.md#decisões-tomadas
[D13]: ../../roadmap/ROADMAP.md#decisões-em-aberto
[D14]: ../../roadmap/ROADMAP.md#decisões-em-aberto
