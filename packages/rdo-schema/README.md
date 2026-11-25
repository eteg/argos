# @argos/rdo-schema

Schema do RDO em Zod 4, com nível, origem e nome no guia em cada campo, mais a função `validateReport` e o JSON Schema exportado.

A fonte dos campos é o recurso `report` de `docs/contratos/recursos.md`, não a contagem do guia (o guia fala em 45 campos, as tabelas somam 36). Se o guia mudar a lista, o schema e os gabaritos mudam juntos.

- `reportContentSchema`: o que a IA preenche (e a cópia da obra).
- `reportSchema`: o conteúdo mais os campos controlados pela API.
- `validateReport(input, { siteType, minPhotosPerReport, maxPhotosPerReport, schema? })`: devolve `structuralErrors` e `missingFields`, cada item com `path` e `code`.
- `pnpm build` grava `dist/report-content.schema.json` e `dist/report.schema.json`, com os metadados (`level`, `origin`, `guideName`, `conditional`, `nonEmpty`) como palavras-chave extras.

Toda atividade e ocorrência conta como relevante pra exigência de foto em obra pública ou financiada. Ponto a validar com o time.

Em obra privada só o `site.publicContract` é proibido (`NOT_ALLOWED_FOR_SITE_TYPE`). Os outros campos de obra pública ou financiada, como `equipment` e `history`, não são exigidos, mas podem vir preenchidos.
