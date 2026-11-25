# Contratos

O contrato diz o que a web espera da API e o que a API garante. A web e a API andam separadas, e o contrato é o ponto de encontro: o que não está aqui não existe, e na integração é o contrato que decide quem está certo.

Ele é escrito em camadas, da tela até o OpenAPI:

| Camada | O que é | Quem escreve |
|---|---|---|
| [Convenções](convencoes.md) | Padrões que valem pra toda a API: nomes, datas, erros, upload, escrita sem internet e operações demoradas. | Os dois |
| [Telas](telas/README.md) | O que cada tela mostra e faz, campo por campo. É a visão da web. | Web |
| [Recursos](recursos.md) | O modelo de dados que sai das telas. | Web propõe, API fecha |
| [Operações](operacoes.md) | As operações que as telas usam, com rota sugerida. | Web propõe, API fecha |
| [Fluxos](fluxos/) | Interações com mais de uma chamada: o [RDO do dia](fluxos/rdo-do-dia.md) e o [registro sem internet](fluxos/sem-internet.md). | Os dois |
| `openapi/` | A fonte da verdade, lida pelas ferramentas. Nasce no M0. | Web escreve o que consome, API revisa |

As rotas e os nomes das camadas de cima são sugestões. O que vale é o OpenAPI acordado. Todo nome do contrato é em inglês ([convenções](convencoes.md#idioma)).

## Situação

Um contrato passa por quatro situações: `rascunho` (escrito, ainda não aprovado), `acordado` (revisado pela web e pela API e registrado no CHANGELOG com quem aprovou), `no backend` (implementado em staging) e `integrado` (a web usa em staging).

| Módulo | Telas | Marco | Situação |
|---|---|---|---|
| Convenções | | M0 | acordado (0.2.0) |
| [Obras](telas/obras.md) | `2.1`, `2.2`, `2.2b`, `2.3`, `2.4`, `2.10`, `2.11` | M1 | acordado (0.2.0) |
| [Registro do dia](telas/registro.md) | `2.5`, `3.1`, `3.2`, `3.6`, `2.7`, `2.6` | M1, M2, M4 | acordado só no que o M1 usa (0.2.0); o resto, rascunho |
| [RDO](telas/rdo.md) | `3.3`, `3.3b`, `3.7`, `3.4`, `3.5`, `2.9` | M2, M5 | rascunho |
| [Pendências](telas/pendencias.md) | `2.8` | M3 | rascunho |

## Como mudar o contrato

Toda mudança atualiza a camada certa e o [CHANGELOG](CHANGELOG.md), entra na `main` depois da revisão do outro lado, e o CHANGELOG registra quem revisou. O contrato de um marco fica `acordado` antes de o marco começar, e a web desenvolve contra um servidor falso gerado do OpenAPI enquanto a API implementa.
