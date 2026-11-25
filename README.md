# Argos

O engenheiro grava um áudio de cerca de 1 minuto e tira fotos da obra. A IA preenche o RDO (Relatório Diário de Obra), pergunta o que faltou e ele só revisa e aprova.

O diferencial é a memória entre dias: o agente lembra das pendências e ocorrências dos RDOs anteriores da obra e cobra o engenheiro antes de fechar o dia.

## Links

- [Guia do time](https://claude.ai/artifact/9VhpdMpFe4kdAbJKgfADDQ): fonte da verdade com as regras (RG e F1RN), os campos do RDO e a tabela de decisões.
- [Protótipo no Claude Design](https://claude.ai/artifact/KQMparWerCU2mP2s7fQBjs): as telas do app e o mapa do fluxo (prancheta 1.1).
- [Roadmap](docs/roadmap/ROADMAP.md): marcos de construção, decisões e a situação de cada entrega.

## Escopo da primeira versão

- Preenchimento do RDO por voz e foto, com até 3 fotos por registro e até 20 por RDO.
- Memória entre dias por obra: itens em aberto, cobrança e desfecho de cada item.
- Sem internet o app só grava áudio e fotos; o resto roda quando o sinal volta.
- Nada é gravado sem a aprovação do engenheiro, e a IA não inventa campo: o que não sabe, ela pergunta.
- Sem login: o engenheiro é o único perfil.

As regras completas estão no guia. Quando uma regra mudar, atualize o guia, não este README.
