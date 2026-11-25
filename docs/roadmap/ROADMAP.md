# Roadmap

Atualizado em 25/11/2026.

Cada marco termina com uma versão no ar, em staging, que alguém de fora do time consegue usar no celular. Os marcos andam em cinco raias: web (o app no navegador do celular), API, contrato, IA (o agente que preenche o RDO e lembra das pendências) e dados (a obra fictícia, os gabaritos e os áudios do eval). A web e a API andam separadas e se encontram no [contrato](../contratos/README.md): a web nunca espera a API, porque desenvolve contra um servidor falso gerado do contrato. Responsáveis: [❓A definir quem fica em cada raia].

As regras de negócio ficam no [guia do time], que é a fonte da verdade. Este roadmap cita as regras pelo ID, como `F1RN08` (cobrança de pendências), e as telas pelo número do frame no [protótipo], como `3.2` (registro por voz). A ordem dos marcos pode mudar, e os IDs continuam os mesmos.

## Visão geral

| Marco | Entrega | Situação |
|---|---|---|
| [M0](#m0-fundação) | Fundação | em andamento |
| [M1](#m1-obras-e-registro) | Obras e registro | em andamento |
| [M2](#m2-rdo-preenchido-pela-ia) | RDO preenchido pela IA | em andamento |
| [M3](#m3-memória-entre-dias) | Memória entre dias | não iniciado |
| [M4](#m4-sem-internet) | Sem internet | não iniciado |
| [M5](#m5-compartilhar-e-consultar) | Compartilhar e consultar | não iniciado |
| [M6](#m6-demo) | Demo | não iniciado |

**Demo mínima:** de M0 a M3, mais o M6. É o que o [fluxo da demo] precisa: dois dias seguidos da mesma obra, com o agente cobrando no dia 2 o que ficou aberto no dia 1. O M4 e o M5 completam as 20 regras da primeira versão (`RG07`, sem internet, e `F1RN12`, compartilhamento).

```mermaid
flowchart LR
    M0[M0 Fundação] --> M1[M1 Obras e registro]
    M1 --> M2[M2 RDO preenchido pela IA]
    M2 --> M3[M3 Memória entre dias]
    M3 --> M6[M6 Demo]
    M1 --> M4[M4 Sem internet]
    M2 --> M5[M5 Compartilhar e consultar]
    D[Gabaritos e áudios] --> M2
    D --> M3
```

O M4 depende só da captura do M1 e pode andar em paralelo ao M2 e ao M3. A raia de dados começa no M0, porque o eval do M2 precisa dos gabaritos prontos.

## Decisões tomadas

Decisões registradas no [guia do time], na tabela de decisões. Aqui fica só o que muda a construção.

| Tema | Decisão | Marco |
|---|---|---|
| Acesso (`RG01`) | Sem login na primeira versão. O engenheiro é o único perfil e entra direto no app. | M0 |
| Modelo de IA | Sem modelo local. Sem internet, o app só captura áudio e fotos, e o resto roda online (`RG07`). | M0 |
| Saída da IA (`RG06`) | O RDO sai em JSON validado contra o schema do formulário, sem campo obrigatório vazio. | M2 |
| Campos por tipo de obra (`RG02`) | Em obra pública ou financiada, os campos dessa categoria aparecem e são obrigatórios. Em obra privada, não aparecem. | M1, M2 |
| Fotos (`F1RN01`, `F1RN02`) | No máximo 3 fotos por registro, no mínimo 3 e no máximo 20 por RDO. Cada foto guarda data, hora e localização. | M1 |
| Início do registro (`F1RN01`) | Dois caminhos: pelo check-in (`2.5`), declarando a obra, ou direto de dentro da obra, sem passar de novo pela `2.5`. | M1 |
| Status da obra (`RG08`) | Não iniciada, em andamento, paralisada e concluída. Só a obra em andamento aparece pra registrar, e a obra não é concluída com RDO em aberto. | M1 |
| Campo que a IA não sabe (`RG05`) | A IA pergunta. Vale também pro código da planilha ou EAP da atividade. | M2 |
| Aprovação (`F1RN05`) | Registra o responsável, a data e a hora. Assinatura digital fica no backlog. | M2 |
| Painel do gestor | Fica no backlog. A tela `4.1` saiu do protótipo. | |
| Stack (D01) | Monorepo TypeScript com Next.js como PWA, NestJS, Postgres e Drizzle, staging numa EC2 com Docker Compose e fluxo trunk-based. Ver o [ADR 0001](../decisoes/0001-stack-e-staging.md). | M0 |
| Proteção da API (`RG01`, D07) | Uma chave por ambiente no cabeçalho `X-Api-Key`, que protege só de acesso casual. Login fica pra uma versão futura. Ver o [ADR 0002](../decisoes/0002-chave-da-api-sem-login.md). | M0 |

## Decisões em aberto

Cada uma tem uma recomendação, que vale até o time decidir diferente. A coluna Bloqueia diz qual marco precisa da decisão antes de começar. Decisão tomada sai daqui e vai pro guia.

| ID | Tema | Recomendação | Bloqueia |
|---|---|---|---|
| D02 | Status de uma obra recém-cadastrada (`RG08`) | Nasce em andamento, pra não exigir um passo a mais antes do primeiro registro. | M1 |
| D03 | Dias até destacar um item antigo (`F1RN10`) | 4 dias, como no protótipo (`2.8`). | M3 |
| D04 | Ordem de vários dias capturados sem internet (`RG07`) | Em ordem cronológica, pela data da captura, liberando cada RDO só depois da aprovação do anterior, como no protótipo (`2.6`). | M4 |
| D05 | Formato e destinatários do compartilhamento (`F1RN12`) | PDF pelo compartilhamento nativo do celular, como no protótipo (`3.5`). | M5 |
| D06 | IA perguntar sobre o que aparece na foto e não foi falado | Fica fora. A conferência entre foto e relato fica só no pitch. | M2 |
| D08 | Status do RDO: o guia fala em rascunho, enviado e aprovado | Só rascunho e aprovado. O protótipo não tem passo de envio, e "RDO enviado" no início (`2.1`) vira "RDO aprovado". | M2 |
| D09 | Localização da obra, pra distância e reconhecimento no canteiro | "Usar minha localização atual" manda a do celular. Sem ela, a API busca pelo endereço. | M1 |
| D10 | Foto da galeria, que pode vir sem data e local (`F1RN02`) | Só câmera, com e sem internet. A `3.6` deixa de oferecer a galeria. | M1 |
| D11 | Quando o RDO ganha o número | Ao ser gerado, em ordem de data. A fila de dias (D04) garante que não há salto. | M2 |
| D12 | O check-in (`2.5`) grava algo na API? | Não. É só a escolha da obra, e o primeiro registro abre o dia. | M1 |
| D13 | Interpretação ao vivo, durante a gravação (`3.2`) | Depois de salvar o registro. Ao vivo fica pra se sobrar tempo. | M2 |
| D14 | Aviso de internet de volta (`2.7`) | Notificação local da web depois do envio, sem push pela API. | M4 |
| D15 | "ART precisa de renovação" no início (`2.1`) | Tirar do protótipo: não há regra nem campo de validade da ART. | M1 |
| D16 | Tempo de carro até a obra no início (`2.1`) | Mostrar só a distância, sem serviço de rotas. | M1 |

## M0 Fundação

- **Monorepo:** estrutura das pastas da web, da API e do que é compartilhado; CI com tipos, lint e build, sem teste unitário ([ADR 0001](../decisoes/0001-stack-e-staging.md)); deploy de staging.
- **Schema do RDO:** os campos da matriz do guia num schema só, usado pela API pra validar a saída da IA e pela web pra montar a revisão (`RG06`). Já separa os campos universais, os de obra pública ou financiada e os recomendados.
- **IA:** chave da API da Anthropic, uma chamada de ponta a ponta em staging e a observabilidade ligada, guardando prompt, saída e tokens de cada execução.
- **Contrato:** [convenções](../contratos/convencoes.md) acordadas; OpenAPI do M1 escrito a partir das [telas](../contratos/telas/README.md) e das [operações](../contratos/operacoes.md); servidor falso pra web.
- **Dados:** a obra fictícia e os primeiros gabaritos de RDO, em dias seguidos, com pendências que passam de um dia pro outro.
- **Decisões antes do marco:** tomadas nos ADRs [0001](../decisoes/0001-stack-e-staging.md) (D01) e [0002](../decisoes/0002-chave-da-api-sem-login.md) (D07).

Pronto quando a web abre no celular, fala com a API de staging e uma chamada à IA aparece na observabilidade.

| Raia | Entrega | Situação | Onde |
|---|---|---|---|
| Contrato | Convenções e decisões do M1 | a fazer | |
| Contrato | OpenAPI do M1 e servidor falso | a fazer | |
| Web | Web PWA base | em andamento | monorepo: manifest e chamada à API; falta o Serwist |
| API | API base | em andamento | monorepo: health, X-Api-Key e Problem Details; falta Drizzle |
| IA | Chamada à Claude com Langfuse | em revisão | `POST /v1/ai/diagnostics`, testada local com trace no Langfuse; falta repetir em staging |
| Contrato | Schema do RDO | em revisão | `packages/rdo-schema`: conteúdo, campos que faltam por tipo de obra e JSON Schema |
| Dados | Obra fictícia e 5 gabaritos | a fazer | |
| API | Staging na EC2 | a fazer | |

## M1 Obras e registro

- **Web:** início (`2.1`), cadastro de obra privada e pública (`2.2`, `2.2b`), pasta da obra (`2.3`), status da obra (`2.10`, `2.11`), check-in (`2.5`) e o registro com áudio e até 3 fotos (`3.2`, sem a parte da IA).
- **API:** obras com os dados de `RG02` e os documentos opcionais com tipo, status da obra (`RG08`), registros por obra e por dia (`RG03`), upload do áudio e das fotos com data, hora e localização (`F1RN02`).
- **Contrato:** obras e registro acordados no OpenAPI.
- **Decisões antes do marco:** D02, D09, D10, D12, D15, D16.

Pronto quando o engenheiro cadastra uma obra, faz o check-in e grava registros com fotos ao longo do dia, e tudo fica guardado na obra certa.

| Raia | Entrega | Situação | Onde |
|---|---|---|---|
| API | Obras, status, registros, mídia, dia, `getMe` e `getConfig` | em revisão | sem planilha de serviços, documentos e CRUD de equipamentos |
| Web | Início (`2.1`), cadastro (`2.2`, `2.2b`), pasta (`2.3`), status (`2.10`, `2.11`) e registro (`3.2`) | em revisão | check-in (`2.5`) é o próprio início (D12); áudio pelo microfone não testado no navegador do Claude |
| Contrato | OpenAPI de obras e registro | a fazer | as rotas seguem `operacoes.md` |

## M2 RDO preenchido pela IA

- **IA:** transcrição do áudio e leitura das fotos; preenchimento dos blocos do RDO (`F1RN03`); pergunta pelo que faltou em vez de inventar (`RG05`); segurança obrigatória quando o áudio indica acidente (`F1RN04`); prompt caching entre as interações da mesma sessão.
- **Web:** linha do dia (`3.1`), o que o agente entendeu em cada registro (`3.2`), revisão do RDO em obra privada e pública (`3.3`, `3.3b`), correção falando, segurança antes de aprovar (`3.7`) e RDO aprovado (`3.4`).
- **API:** montagem do RDO a partir dos registros do dia, validação pelo schema (`RG06`), aprovação com responsável, data e hora (`RG04`, `F1RN05`) e numeração sequencial do RDO.
- **Dados:** os áudios gravados a partir dos gabaritos, com ruído de obra e jargão real.
- **Eval:** % de campos corretos contra o gabarito, % dos campos faltantes que o agente perguntou e campos inventados, com meta zero.
- **Contrato:** RDO, perguntas e operações demoradas acordados no OpenAPI.
- **Decisões antes do marco:** D06, D08, D11, D13.

Pronto quando um dia de registros vira um RDO aprovado que passa no schema, e o eval roda sobre pelo menos 10 áudios.

| Raia | Entrega | Situação | Onde |
|---|---|---|---|
| IA | Transcrição pelo Gemini, interpretação do registro e preenchimento do RDO pela Claude | em revisão | transcrição sem teste real: falta a `GEMINI_API_KEY` |
| API | `generateReport`, `getReport`, `updateReport`, `answerQuestion`, `approveReport`, `getEntry` | em revisão | sem `correctReportByVoice` e sem segurança (`3.7`) própria |
| Web | Pasta com o que o agente entendeu, revisão com perguntas (`3.3`) e aprovado (`3.4`) | em revisão | sem correção à mão nem falando |
| Dados e eval | Áudios gravados e eval | a fazer | |

## M3 Memória entre dias

- **IA:** itens em aberto a partir do RDO aprovado (`F1RN06`, `F1RN11`); carga dos itens no início do dia (`F1RN07`); cobrança do que o áudio não citou (`F1RN08`); proposta de desfecho de cada item (`F1RN09`).
- **Web:** "Ficou dos dias anteriores" no RDO de hoje (`3.1`), a pergunta do agente durante o registro (`3.2`), os itens em aberto na revisão (`3.3`) e a tela de pendências por obra (`2.8`), com destaque dos itens antigos (`F1RN10`).
- **API:** itens em aberto por obra, com origem, situação e histórico de desfecho, sempre confirmado pelo engenheiro.
- **Eval:** % das pendências do dia anterior que o agente cobrou.
- **Decisões antes do marco:** D03.

Pronto quando o RDO do dia 2 cobra as pendências do dia 1 e cada item sai fechado, mantido ou atualizado.

## M4 Sem internet

- **Web:** captura de áudio e fotos guardada no celular sem sinal (`3.6`), envio quando a internet volta, aviso de dias pra finalizar (`2.7`) e fila de dias anteriores (`2.6`).
- **API:** recebimento de registros com a data e a hora da captura, e RDO com a data da captura, não a do envio.
- **Decisões antes do marco:** D04, D14.

Pronto quando um dia gravado em modo avião vira RDO depois que a internet volta, com a data certa.

## M5 Compartilhar e consultar

- **Web:** compartilhar o RDO (`3.5`, `F1RN12`), baixar o PDF e consultar um RDO aprovado (`2.9`).
- **API:** geração do PDF do RDO aprovado e lista dos RDOs aprovados por obra.
- **Decisões antes do marco:** D05.

Pronto quando o engenheiro manda o PDF de um RDO aprovado pelo celular e abre um RDO antigo da obra.

## M6 Demo

- **Roteiro:** os dois dias da mesma obra do [fluxo da demo], ensaiados de ponta a ponta em staging.
- **Eval completo:** 10 a 20 gabaritos, com as quatro métricas do guia e o resultado na apresentação.
- **Pitch:** diferencial da memória entre dias e a conta de ROI do guia.
- **Se sobrar tempo**, nesta ordem: conferência com o cronograma físico, conferência do clima com o INMET e RAG com os documentos da obra.

Pronto quando a demo roda duas vezes seguidas sem intervenção.

## Pontos de sincronia

- **Antes de um marco começar:** o contrato do marco `acordado` e as decisões que ele bloqueia tomadas.
- **Até o meio do marco:** a API do marco em staging, pra web integrar.
- **No fim do marco:** a web integrada em staging e este roadmap atualizado.

## Situação de cada entrega

A tabela de entregas de um marco nasce quando o marco começa, logo abaixo da descrição dele, com uma linha por entrega:

| Raia | Entrega | Situação | Onde |
|---|---|---|---|
| Web | Cadastro de obra (`2.2`, `2.2b`) | em andamento | #12 |

- **Entrega** é um item que o marco lista. A linha resume, e o detalhe fica na issue.
- **Onde** aponta pra issue ou pro commit, neste repositório.
- **Situação** é `a fazer`, `em andamento`, `em revisão` (na `main`, esperando a revisão), `pronto` (revisado e critério do marco passando) ou `bloqueado: <motivo>`.
- A situação do marco, na visão geral, é `não iniciado`, `em andamento` a partir da primeira entrega que começa e `pronto` quando todas as entregas estão prontas e o critério de pronto passa.
- Toda mudança no roadmap entra direto na `main`, como o código. Mudança que só altera a situação vai num commit como `docs: atualiza a situação do M1`.

[guia do time]: https://claude.ai/artifact/9VhpdMpFe4kdAbJKgfADDQ
[protótipo]: https://claude.ai/artifact/KQMparWerCU2mP2s7fQBjs
[fluxo da demo]: https://claude.ai/artifact/9VhpdMpFe4kdAbJKgfADDQ
