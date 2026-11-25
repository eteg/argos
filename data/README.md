# Dados de teste

- `demo-site/site.json`: corpo do `createSite` da obra fictícia (pública, contrato 045/2026).
- `demo-site/services.csv`: planilha de serviços (`code`, `description`, `unit`).
- `demo-site/equipment.json`: corpos do `addEquipment`.
- `golden-reports/day-01.json` a `day-05.json`: um gabarito por dia útil (23 a 27/11/2026). Cada um traz os registros com o `script` que o engenheiro fala, os `omittedFields` (campo que o agente deve perguntar) e o `expectedReport`, já com as respostas aplicadas.

Os dias contam uma história contínua: o aço atrasa no dia 1 e fecha no dia 2, a armação dos pilares segue aberta até o dia 5, a betoneira quebra no dia 3 e volta no dia 4, e o acidente do dia 4 tem `safety`. As fotos ainda não têm imagem (`fixture://`).

`pnpm data:validate` valida a obra e os equipamentos contra o OpenAPI, cada `expectedReport` contra `@argos/rdo-schema`, a corrente de itens em aberto entre os dias e a cobertura. Roda no CI.
