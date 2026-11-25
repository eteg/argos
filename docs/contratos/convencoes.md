# Convenções da API

Valem pra todas as operações. O contrato de cada tela não repete estas regras, só as exceções.

## Idioma

O contrato é sempre em inglês: rotas, nomes de operação, campos, parâmetros, valores de enum, `code` de erro e cabeçalhos, inclusive no OpenAPI e no código da web e da API. Só o texto explicativo destes documentos fica em português.

Os termos do domínio têm um nome só, usado em todas as camadas:

| Termo | No contrato |
|---|---|
| Obra | `site` |
| RDO | `report` |
| Registro | `entry` |
| Item em aberto | `openItem` |
| Serviço da planilha ou EAP | `service` |
| Pergunta do agente | `question` |
| Engenheiro | `engineer` |

## Base

- HTTPS, JSON em UTF-8 e prefixo de versão na rota: `/v1/...`.
- Três ambientes: desenvolvimento (a web usa um servidor falso gerado do contrato), staging e produção.
- Sem login (`RG01`, acesso): nenhuma chamada leva token. A API atende o engenheiro configurado no ambiente. Como proteger a API de staging está em aberto ([D07]).

## Nomes e tipos

| Tipo | Convenção | Exemplo |
|---|---|---|
| Campo | camelCase em inglês | `technicalManager`, `entriesCount` |
| ID | `id`, texto com UUID | `"id": "3f0c…"` |
| Instante | ISO 8601 em UTC, terminando em `Z`, campo com sufixo `At` | `"capturedAt": "2026-11-25T18:30:00Z"` |
| Data de calendário | `YYYY-MM-DD`, campo com sufixo `On` ou `Date` | `"serviceOrderDate": "2026-09-01"` |
| Dia local | `YYYY-MM-DD` mais o fuso IANA em que aconteceu | `"localDate": "2026-11-25", "timezone": "America/Sao_Paulo"` |
| Horário | `HH:MM` | `"startTime": "07:00"` |
| Duração | Inteiro com a unidade no nome | `durationSeconds`, `breakMinutes` |
| Localização | Objeto com `lat`, `lng` e `accuracyMeters` | `{ "lat": -19.93, "lng": -44.05, "accuracyMeters": 12 }` |
| Enum | Texto em inglês, minúsculas, palavras separadas por `_` | `"status": "in_progress"` |
| Contagem | Inteiro com sufixo `Count` | `"entriesCount": 3` |

Toda resposta traz todos os campos do recurso. Campo sem valor vem `null`, nunca ausente. Na entrada, campo opcional pode ser omitido.

Enum é extensível: a API pode ganhar um valor novo sem mudar de versão, e a web trata valor desconhecido sem quebrar.

Texto que a tela monta a partir dos dados, como "há 4 dias", "Quarta, 25 de novembro" ou "40 m · você está aqui", é calculado na web.

## Cabeçalhos

| Cabeçalho | Em quais chamadas | Valor |
|---|---|---|
| `X-Timezone` | Todas | Fuso IANA do celular, como `America/Sao_Paulo`. A API usa pra calcular "hoje". |
| `X-Device-Location` | Listas que ordenam por distância | `lat,lng`, só quando a pessoa permitiu a localização. |
| `Idempotency-Key` | Escritas que não podem duplicar e não têm `id` gerado na web, como aprovar o RDO | UUID gerado na web. |

## Listas

Lista curta volta inteira em `items`. Lista que cresce, como os RDOs aprovados de uma obra, usa cursor:

```
GET /v1/sites/{siteId}/reports?limit=20&cursor=eyJ...
```

```json
{ "items": [], "nextCursor": null }
```

`limit` tem padrão 20 e máximo 50. `nextCursor` vem `null` na última página.

## Erros

Todo erro segue o formato Problem Details (RFC 9457), com `Content-Type: application/problem+json` e um `code` estável:

```json
{
  "type": "https://argos.eteg.com.br/errors/validation",
  "title": "Invalid data",
  "status": 400,
  "code": "VALIDATION",
  "detail": "The name field is required.",
  "errors": [{ "field": "name", "code": "REQUIRED" }]
}
```

A web decide o texto da tela a partir do `code`. `title` e `detail` servem pra log, não pra tela.

| HTTP | `code` | Quando | O que a web faz |
|---|---|---|---|
| 400 | `VALIDATION` | Campo inválido. `errors` diz qual e por quê. | Mostra a mensagem abaixo de cada campo. |
| 404 | `NOT_FOUND` | O recurso não existe. | Tira o item da tela e avisa. |
| 409 | Específico da operação | O estado atual impede a operação, como concluir obra com RDO em aberto. | Conforme a tela. |
| 413 | `FILE_TOO_LARGE` | Arquivo acima do limite do upload. | Avisa o limite. |
| 422 | Específico da operação | O arquivo chegou, mas o conteúdo não serve, como uma planilha sem código e descrição. | Conforme a tela. |
| 415 | `UNSUPPORTED_FILE` | Tipo de arquivo não aceito. | Avisa os tipos aceitos. |
| 5xx | `UNAVAILABLE` | Falha da API. | Mostra que não deu pra concluir agora, com a opção de tentar de novo. |

## Upload

Áudio, fotos, documentos da obra e a planilha de serviços sobem por `multipart/form-data`, cada arquivo numa chamada. O áudio e as fotos de um registro sobem primeiro, por `uploadMedia`, e o registro cita os arquivos pelo `id` ([registro do dia](telas/registro.md)).

| Arquivo | Tipos | Limite |
|---|---|---|
| Áudio do registro | `audio/webm`, `audio/mp4`, `audio/mpeg` | [❓A confirmar], cerca de 2 minutos |
| Foto | `image/jpeg`, `image/png`, `image/heic` | [❓A confirmar] |
| Documento da obra | `application/pdf`, imagens | [❓A confirmar] |
| Planilha de serviços | `.xlsx`, `.csv` | [❓A confirmar] |

## Escrita sem internet

Sem internet, a web só guarda o áudio e as fotos (`RG07`, funcionamento sem internet). Duas escritas podem chegar atrasadas, `uploadMedia` e `createEntry`, e seguem três regras:

- A web gera o `id` (UUID) e manda no corpo. Se o mesmo `id` chegar de novo, a API devolve o que já foi gravado, com 200, em vez de duplicar.
- O corpo traz quando a captura aconteceu de verdade: `capturedAt`, `localDate`, `timezone` e `location`. A API nunca usa a hora em que recebeu. É assim que o RDO sai com a data da captura.
- O resto (interpretação, RDO, perguntas e aprovação) só roda com internet.

## Operações demoradas

A interpretação de um registro, a montagem do RDO e a correção falando passam pela IA e podem levar segundos. Essas operações respondem 202 com o recurso na situação inicial, o cabeçalho `Location` e `Retry-After` com o intervalo sugerido, em segundos. A web consulta o recurso até a situação mudar.

## Evolução do contrato

Dentro de uma versão da API, o contrato só cresce: campo novo na resposta, campo opcional novo na entrada, operação nova e valor novo de enum. Remover, renomear, mudar tipo ou tornar obrigatório um campo de entrada exige `/v2`.

O contrato tem versão `MAJOR.MINOR.PATCH`, e toda mudança entra no [CHANGELOG](CHANGELOG.md).

[D07]: ../roadmap/ROADMAP.md#decisões-em-aberto
