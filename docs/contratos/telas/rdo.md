# RDO

## `3.3` e `3.3b` Revise o RDO

A mesma tela. A `3.3b` é o RDO de obra pública ou financiada, com os campos dessa categoria marcados como obrigatórios (`RG02`). Nada é salvo antes da aprovação (`RG04`, aprovação obrigatória).

**Mostra (`getReport`)**

| Bloco | Campos | No protótipo |
|---|---|---|
| Aviso | `missingFields`, `questions` abertas | "Faltam 2 campos obrigatórios: o tempo da manhã e o serviço da concretagem." |
| Identificação | `number`, `localDate`, `site` | "Nº 088 · quarta, 25/11/2026", tipo, responsável e ART, endereço, contratante e contratada com CNPJ, "Vem do cadastro da obra." |
| Contrato público (`3.3b`) | `site.publicContract` | "Nº 045/2026", empenho, fiscal, ordem de serviço, "180 dias · sem aditivos", "83 dias · faltam 97" |
| Jornada e clima | `workday`, `weather` | 07:00, 17:00, 1 h; manhã sem tempo, com a pergunta "Você não falou do tempo da manhã. Como estava?"; tarde chuva forte, parcialmente praticável |
| Horas paradas (`3.3b`) | `weatherStoppage` | "2 h", "Montagem da cobertura" |
| Efetivo | `labor` | "Pedreiros 12 Próprio", "Armadores 2 Terceiro", "Armadores terceirizados: Ferragens Silva" |
| Equipamentos | `equipment` | "Betoneira 2 · Operando", "Do cadastro da obra. Aqui vai só a situação do dia."; na `3.3b`, com placa ou prefixo |
| Atividades | `activities` | "Concretagem da laje · Bloco B · concluída", serviço da planilha a escolher, com a pergunta "A planilha tem dois serviços de concretagem de laje. Qual foi?"; "Escavação da fundação · 02.05" |
| Quantidade (`3.3b`) | `activities.quantity`, `unit` | "12 t", "240 m²" |
| Ocorrências | `occurrences` | "Chuva parou a concretagem da laje · Paralisação · 14:00 às 16:00 · encerrada" |
| Serviços afetados e documento (`3.3b`) | `affectedServiceIds`, `source` | "Documento: e-mail do fiscal de 23/11" |
| Itens em aberto | `openItemReviews`, `newOpenItems` | "Escavação da fundação do bloco C · há 5 dias · Atualizar: segue em andamento"; "Pedir aço CA-50 10 mm até sexta · novo · Abrir item" |
| Fotos | `photos`, `photoRequirements` | "Fotos · 4 de 20", com legenda e hora; na `3.3b`, "Falta: travamento do eixo 3" |
| Validação | `status`, `history` | "Rascunho", "Eng. Rafael Lima"; na `3.3b`, o histórico de alterações |

**Ações**

| Ação | Operação | Resultado | Erros |
|---|---|---|---|
| Mudar um campo à mão | `updateReport` | O RDO com o campo novo, `missingFields` recalculado e uma linha no `history`. | 400 `VALIDATION`. |
| Escolher o serviço de uma atividade | `listServices`, depois `updateReport` ou `answerQuestion` | | |
| Responder uma pergunta | `answerQuestion` | | |
| Microfone de um bloco ou "Corrigir falando" | `uploadMedia`, `correctReportByVoice` com a seção | 202. A web consulta `getReport` até o RDO voltar a `draft`. | |
| Desfecho de um item em aberto | `updateReport` com `openItemReviews` | Proposta, até a aprovação (`F1RN09`, desfecho dos itens). | |
| Adicionar foto que falta (`3.3b`) | | Abre a `3.2`: a foto entra num registro novo, que respeita o limite de 3 por registro. | |
| Aprovar RDO | `approveReport` | Abre a `3.4`. | 409 `REPORT_INCOMPLETE`, com `errors` apontando cada campo que falta, inclusive o mínimo de 3 fotos e a segurança. Com segurança pendente, a web abre a `3.7`. |

**Sem internet:** mostra o último rascunho carregado, sem editar. Aprovar precisa de internet (`RG07`).

## `3.7` Segurança antes de aprovar

Aparece quando o áudio indica acidente (`F1RN04`, segurança condicional). A IA cria a ocorrência com `type` `accident` e uma pergunta `safety` pra cada dado que o engenheiro não falou.

**Mostra:** o trecho do áudio que indicou o acidente (`entry.transcript` do registro citado), e `occurrence.safety`.

**Envia, em `updateReport` ou `answerQuestion`**

| Campo | No protótipo | Nota |
|---|---|---|
| `safety.type` | `accident` | |
| `occurrence.description` | "Corte na mão de um servente ao usar a serra…" | |
| `occurrence.startTime` | 11:10 | Do áudio: "umas onze e dez". |
| `safety.dds` | falta responder | "Teve DDS hoje?" |
| `safety.ppeInUse` | falta responder | "O servente estava usando luva?" |

**Ações:** "Responder falando" é `answerQuestion` com áudio. "Voltar ao RDO" volta pra `3.3`, sem chamada.

## `3.4` RDO aprovado

**Mostra (`getReport`, já aprovado):** `approval.approvedAt` ("Aprovado por você às 17:45 e salvo na obra"), um resumo do RDO e, em "Amanhã o Argos vai perguntar por", os itens que ficaram abertos depois da aprovação (`openItemReviews` com `keep` ou `update`, e `newOpenItems` com `track`).

**Ações**

| Ação | Operação | Resultado |
|---|---|---|
| Baixar PDF | `getReportPdf` | |
| Compartilhar | `getReportPdf` | Abre a `3.5`. |
| Voltar ao início | | Abre a `2.1`. |

## `3.5` Compartilhar

A web baixa o PDF (`getReportPdf`) e abre o compartilhamento nativo do celular (Web Share API) com o arquivo `RDO-088_VilaVerde_25-11.pdf` (`F1RN12`, compartilhamento). Os destinos da tela, como WhatsApp, e-mail e "Enviados por último", são do celular, não da API.

**Pendências:** [D05] (formato e destinatários).

## `2.9` RDO aprovado (consulta)

**Mostra (`getReport`):** o RDO inteiro, só leitura, com "Aprovado por Eng. Rafael Lima · 24/11/2026 às 17:20".

**Ações:** "Compartilhar" e "Baixar PDF", como na `3.4`.

**Sem internet:** abre só os RDOs já carregados.

[D05]: ../../roadmap/ROADMAP.md#decisões-em-aberto
