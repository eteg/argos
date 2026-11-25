# 0002 Chave da API sem login (D07)

- **Data:** 25/11/2026
- **Situação:** aceita

## Contexto

A primeira versão não tem login (`RG01`, o engenheiro entra direto no app). A API atende um engenheiro só, configurado no ambiente. Mesmo assim, a API de staging fica na internet e cada chamada à IA custa dinheiro, então ela não pode ficar aberta pra qualquer requisição.

## Decisão

Uma chave por ambiente, no cabeçalho `X-Api-Key`, exigida em toda rota `/v1`, menos `getHealth` (`GET /v1/health`). Sem a chave ou com a chave errada, a API responde 401 com `code` `UNAUTHORIZED`, em Problem Details, como os outros [erros](../contratos/convencoes.md#erros) da API. O cabeçalho, o `UNAUTHORIZED` e o `RATE_LIMITED` entram nas convenções junto com o OpenAPI do M1.

A web manda a chave em toda chamada. Ela fica numa variável pública do Next (`NEXT_PUBLIC_API_KEY`).

Login fica pra uma versão futura.

## Consequências

- A chave vai dentro do código da web que roda no celular, e qualquer um que abra o app consegue ler. Ela protege só de acesso casual, como um robô varrendo a internet, e não de quem quer usar a API de propósito.
- Por isso o custo da IA tem duas barreiras fora da chave: o diagnóstico da IA tem limite de chamadas (429 `RATE_LIMITED`), e a conta AWS tem alerta de orçamento.
- Trocar a chave pede um deploy da web e da API juntos.
- Quando o login entrar, o cabeçalho sai e o contrato muda de versão.
