# Pendências

## `2.8` Pendências

O que ficou em aberto nos RDOs aprovados, de todas as obras (`F1RN06`, itens em aberto; `F1RN11`, memória só do aprovado).

**Mostra (`listOpenItems`)**

| Dado | Campo | No protótipo |
|---|---|---|
| Obra e quantidade | `site.name`, contado na web | "Vila Verde · Bloco B · 3 em aberto" |
| Item | `title`, `kind`, `openedOn` | "Escavação da fundação do bloco C · Serviço não concluído · aberto em 20/11" |
| Última atualização | `lastUpdate` | "25/11: segue em andamento" |
| Idade e destaque | `openedOn`, `openItemHighlightDays` | "há 5 dias", destacado a partir de 4 dias (`F1RN10`) |
| Novo | `openedOn` igual a hoje | "nova" |
| Fechados nos últimos 7 dias | `listOpenItems` com `status` `closed` e `closedSince` | "Betoneira 2 em manutenção · fechado em 25/11: voltou a funcionar" |

**Ações**

| Ação | Operação | Resultado |
|---|---|---|
| Abrir a tela | `listOpenItems`, duas vezes: abertos e fechados há 7 dias | |

A tela só mostra. O desfecho de cada item é decidido no RDO do dia (`3.2` e `3.3`).

**Sem internet:** mostra a última lista carregada.

**Pendências:** [D03] (dias até o destaque).

[D03]: ../../roadmap/ROADMAP.md#decisões-em-aberto
