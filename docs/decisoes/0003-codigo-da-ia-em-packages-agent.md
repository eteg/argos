# 0003 Código da IA em packages/agent (D19)

- **Data:** 25/11/2026
- **Situação:** aceita

## Contexto

A IA do M2 interpreta o registro, monta o RDO e propõe o desfecho dos itens em aberto. O eval precisa rodar sobre os gabaritos sem subir a API, e a API já cuida do 202, da fila e do banco. A pasta de código da IA não está no [ADR 0001](0001-stack-e-staging.md).

## Decisão

O código da IA fica no pacote `packages/agent`, fora do NestJS, com funções puras que recebem os dados e devolvem JSON validado pelo `@argos/rdo-schema`. A API chama essas funções e guarda o resultado. O pacote não conhece banco nem HTTP. O cliente da Claude e o Langfuse continuam na API (`apps/api/src/ai`) e entram no pacote por um parâmetro, pra o eval poder trocá-los.

## Consequências

- O eval roda direto no pacote, contra `data/`.
- Trocar o modelo ou o prompt não mexe na API.
- A API precisa montar a entrada de cada função (registros, serviços da obra, itens em aberto) e traduzir o resultado pro banco.
- A transcrição do áudio (D17) continua em aberto e vira outro ADR.
