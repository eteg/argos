# O que cada tela precisa

A visão da web: pra cada tela do [protótipo], os dados que ela mostra e as ações que ela faz, com a operação que atende cada uma. Daqui saem os [recursos](../recursos.md), as [operações](../operacoes.md) e, depois, o OpenAPI.

## Como ler

- **Mostra:** cada dado da tela, com o campo sugerido e o valor que aparece no protótipo.
- **Envia:** os campos que a tela manda pra API.
- **Ações:** o que a pessoa faz, a operação que atende e o que muda depois.
- **Sem internet:** o que a tela faz quando a API não responde.
- **Pendências:** decisões em aberto que afetam a tela, do [roadmap](../../roadmap/ROADMAP.md#decisões-em-aberto).

Texto que a tela monta a partir dos dados, como "há 4 dias" ou "Quarta, 25 de novembro", é calculado na web. Nomes de campo e de operação são sugestões até o OpenAPI ser acordado.

## Módulos

| Arquivo | Telas |
|---|---|
| [obras.md](obras.md) | `2.1` início, `2.2` e `2.2b` cadastro de obra, `2.3` pasta da obra, `2.4` menu, `2.10` status da obra, `2.11` fora de andamento |
| [registro.md](registro.md) | `2.5` registrar o dia, `3.1` RDO de hoje, `3.2` registro por voz, `3.6` registro sem internet, `2.7` aviso de internet de volta, `2.6` dias anteriores |
| [rdo.md](rdo.md) | `3.3` e `3.3b` revise o RDO, `3.7` segurança, `3.4` RDO aprovado, `3.5` compartilhar, `2.9` consulta de RDO aprovado |
| [pendencias.md](pendencias.md) | `2.8` pendências |

O mapa de como as telas se ligam está na prancheta `1.1` do protótipo.

[protótipo]: https://claude.ai/artifact/KQMparWerCU2mP2s7fQBjs
