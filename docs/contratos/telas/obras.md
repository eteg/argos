# Obras

## `2.1` Início

A lista de obras do dia a dia. Só aparecem as obras em andamento (`RG08`, status da obra).

**Mostra**

| Dado | Campo | No protótipo |
|---|---|---|
| Saudação | `engineer.name` (`getMe`) | "Bom dia, Rafael" |
| Obras perto | `listSites`, ordenada por `distanceMeters` | Vila Verde a 40 m, Galpão Contagem a 6,2 km, Clínica Savassi a 11 km |
| Situação do dia de cada obra | `today.state` | "RDO em andamento" (`in_progress` ou `draft`), "RDO pendente" (`no_entries`), "RDO enviado" (`approved`) |
| RDOs a fazer | obras com `today.state` diferente de `approved`, mais `pendingDays` | "Galpão Contagem · 2 dias · Capturados sem internet, falta finalizar" |
| Contador do filtro | quantidade de obras fora de andamento | "Fora de andamento · 3" |

**Ações**

| Ação | Operação | Resultado |
|---|---|---|
| Abrir a tela | `getMe`, `listSites` com `X-Device-Location` | |
| Buscar obra | `listSites` com `search` | |
| Tocar numa obra | `getSite` | Abre a `2.3`. |
| Tocar em "Finalizar" de dias sem internet | | Abre a `2.6`. |
| Nova obra | | Abre a `2.2`. |
| Fora de andamento | `listSites` com `status` `not_started,paused,completed` | Abre a `2.11`. |

**Sem internet:** mostra a última lista carregada. Distância só com a localização permitida.

**Pendências:**
- "RDO enviado" deveria ser "RDO aprovado", que é o termo do resto do app ([D08], status do RDO).
- "ART precisa de renovação" não tem regra nem campo que o sustente ([D15]).
- O tempo de carro precisa de um serviço de rotas ([D16]).

## `2.2` e `2.2b` Cadastrar obra

O mesmo formulário. A `2.2b` é a obra pública ou financiada, com o grupo do contrato público, que só aparece nesses tipos (`RG02`, cadastro e tipo da obra).

**Envia**

| Campo | No protótipo | Nota |
|---|---|---|
| `name` | "Residencial Vila Verde · Bloco B" | Obrigatório. |
| `type` | `private` | |
| `address` | "Rua das Acácias, 410 · Contagem, MG" | |
| `location` | | Por "Usar minha localização atual" ou pelo endereço ([D09]). |
| `client.name`, `client.taxId` | "Vila Verde Empreendimentos", "00.000.000/0001-00" | |
| `contractor.name`, `contractor.taxId` | "Construtora Horizonte", "11.111.111/0001-11" | |
| `technicalManager.name`, `technicalManager.artNumber` | "Eng. Rafael Lima", "MG2026001234" | |
| `publicContract` | "045/2026", "2026NE000312", "Eng. Paula Reis", 01/09/2026, 180 dias, sem aditivos | Obrigatório em `public` e `financed`. A API responde 400 `VALIDATION` quando falta, e ignora o objeto em `private`. |

A planilha de serviços, os equipamentos e os documentos são chamadas separadas, depois de a obra existir.

| Grupo | Operação | No protótipo | Nota |
|---|---|---|---|
| Serviços da obra | `importServices` | "planilha-vila-verde.xlsx · 148 serviços importados" | Obrigatório: o serviço de cada atividade vem daqui. "Trocar planilha" importa de novo. |
| Equipamentos da obra | `addEquipment`, `updateEquipment`, `removeEquipment` | "Betoneira 2 · BT-02"; "Guindaste 30 t · Placa ABC-1D23" | Opcional em obra privada, obrigatório em pública ou financiada. |
| Documentos da obra | `uploadSiteDocument`, `updateSiteDocument`, `removeSiteDocument` | dois PDFs, com o tipo | Opcional. |

**Ações**

| Ação | Operação | Resultado | Erros |
|---|---|---|---|
| Salvar obra | `createSite` ou `updateSite`, depois as chamadas dos grupos | Abre a `2.3`. | 400 `VALIDATION`. 422 `SPREADSHEET_UNREADABLE` na planilha. |

**Sem internet:** não salva. Mostra que precisa de internet.

**Pendências:** [D02] (status de obra nova), [D09] (localização da obra).

## `2.3` Pasta da obra

**Mostra**

| Dado | Campo (`getSite`) | No protótipo |
|---|---|---|
| Nome, cidade e tipo | `name`, `address`, `type` | "Residencial Vila Verde · Bloco B · Contagem · obra privada" |
| RDO de hoje | `today` | "3 registros · falta fechar o dia" |
| Em aberto nesta obra | `openItems` | 3 itens, com "há 5 dias" a partir de `openedOn` |
| RDOs aprovados | `recentReports`: `number`, `localDate`, `approval.approvedAt`, quantidade de ocorrências | "Nº 087 · terça, 24/11 · Aprovado às 17:20 · 1 ocorrência" |
| Total aprovado | `approvedReportsCount` | "87 no total" |
| Dados da obra | os campos do cadastro, `status`, `servicesCount`, `equipment` | "Status: Em andamento", "Serviços: 148" |

**Ações**

| Ação | Operação | Resultado |
|---|---|---|
| Continuar o RDO de hoje | `getDay` | Abre a `3.1`. |
| Registrar | | Abre a `3.2` direto, sem a `2.5` (`F1RN01`, início do registro). |
| Tocar num RDO aprovado | `getReport` | Abre a `2.9`. |
| Editar | | Abre a `2.2`. |
| Alterar status | | Abre a `2.10`. |

## `2.4` Menu

**Mostra:** `engineer.name` e `engineer.company` (`getMe`), o estado do RDO de hoje da obra atual ("em andamento") e a quantidade de itens em aberto ("3"). Sem operação própria.

## `2.10` Status da obra

**Envia**

| Campo | No protótipo | Nota |
|---|---|---|
| `status` | `completed` | `RG08` |

**Ações**

| Ação | Operação | Resultado | Erros |
|---|---|---|---|
| Concluir obra | `changeSiteStatus` | A obra sai do início e da `2.5`. | 409 `SITE_HAS_OPEN_REPORTS`, com a lista de dias sem RDO aprovado: "Falta finalizar 1 RDO para concluir". A web já mostra isso antes, a partir de `today` e `pendingDays`, e deixa o botão desligado. |

## `2.11` Fora de andamento

**Mostra:** `listSites` com `status` `not_started,paused,completed`, agrupada por status, com `statusChangedOn` e a quantidade de RDOs aprovados.

**Ações**

| Ação | Operação | Resultado |
|---|---|---|
| Começar obra, voltar a andamento | `changeSiteStatus` com `in_progress` | A obra volta pro início e pra `2.5` (`RG08`). |
| Ver RDOs | `listReports` | |

[D02]: ../../roadmap/ROADMAP.md#decisões-em-aberto
[D08]: ../../roadmap/ROADMAP.md#decisões-em-aberto
[D09]: ../../roadmap/ROADMAP.md#decisões-em-aberto
[D15]: ../../roadmap/ROADMAP.md#decisões-em-aberto
[D16]: ../../roadmap/ROADMAP.md#decisões-em-aberto
