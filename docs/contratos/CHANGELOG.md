# Changelog do contrato

## 0.2.0, rascunho

- Convenções: chave por ambiente em `X-Api-Key` (todas as rotas menos `getHealth`), erros 401 `UNAUTHORIZED` e 429 `RATE_LIMITED`, e limites de upload (áudio 10 MB, foto 15 MB, documento 50 MB, planilha 10 MB). O 415 passou pra ordem certa da tabela.
- D02: `createSite` cria a obra `in_progress`.
- D09: `location` é opcional em `createSite` e `updateSite`. Sem ela, a API busca pelo endereço, o que exige um serviço de geocodificação na API do M1.
- D10: o valor `gallery` saiu do enum `mediaSource`. Só câmera. Remover valor de enum pediria `/v2`, mas o contrato ainda não foi acordado.
- D12: o check-in (`2.5`) não grava nada na API.
- D15 e D16: saíram da `2.1` o aviso de renovação da ART e o tempo de carro. `distanceMeters` fica só com a distância.
- OpenAPI 3.1 do M1 em `openapi/openapi.yaml`, mais `getHealth` e `runAiDiagnostic`, com lint, tipos gerados em `packages/contract` e servidor falso (`pnpm mock`).
- `uploadMedia` aceita `durationSeconds` opcional (o áudio mostra "0:48" e a API não decodifica o arquivo).
- `createEntry` responde 201 no M1. A partir do M2 vira operação demorada e responde 202.
- Processo: o contrato entra na `main` depois da revisão do outro lado, sem PR.

## 0.1.0, rascunho, 25/11/2026

- Primeira versão, escrita a partir do protótipo e do guia do time: convenções, telas, recursos, operações e os fluxos do RDO do dia e do registro sem internet.
- Termos do domínio em inglês: `site` (obra), `report` (RDO), `entry` (registro), `openItem` (item em aberto), `service` (serviço da planilha) e `question` (pergunta do agente).
- Sem login (`RG01`): nenhuma operação pede sessão.
- O serviço de cada atividade e a identificação dos equipamentos vêm do cadastro da obra, conforme a coluna "Origem do dado" do guia.
- O OpenAPI ainda não existe. Nasce no M0, a partir destas camadas.
