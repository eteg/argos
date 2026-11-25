# Roteiro da demo

Dois dias da mesma obra, o Residencial Vila Verde · Bloco B. O dia 1 (ontem) já está aprovado e deixou três itens em aberto na memória da obra. O dia 2 (hoje) é feito ao vivo: o engenheiro grava um áudio que não fala de nenhuma pendência, e o Argos cobra as três antes de fechar o dia.

## Antes de apresentar

Com o Postgres (`argos-db`), a API e a web rodando:

```bash
pnpm --filter @argos/api seed:demo
```

O script zera o banco local, cadastra a obra, grava os três registros de ontem com os áudios e fotos de `data/demo`, gera o RDO do dia 1, responde as perguntas que os áudios não cobrem e aprova. Termina com "RDO do dia 1 aprovado". Se terminar com "Falta responder", abra o link que ele mostra, responda e aprove. As perguntas da IA variam um pouco de uma execução pra outra.

Rode o script de novo antes de cada ensaio: ele apaga o dia 2 do ensaio anterior.

**Onde mostrar:** no navegador do notebook em `http://localhost:3000`, com o modo celular do DevTools (375 px). O microfone só funciona em `localhost` ou HTTPS, então pelo celular na rede local ele não grava: pro celular, só com o staging.

**Arquivos pra ter à mão:** `data/demo/dia2.wav` (áudio do dia 2, se o microfone falhar) e as fotos `foto-alvenaria.jpg`, `foto-betoneira.jpg` e `foto-geral.jpg`.

## Passo a passo

| # | Tela | O que fazer | O que falar |
|---|---|---|---|
| 1 | Início (`2.1`) | Mostrar a obra com "3 em aberto". | O engenheiro abre o app no canteiro e já vê a obra em que está. |
| 2 | Pendências (`2.8`) | Abrir "Pendências das obras". | Ontem ficaram três coisas em aberto: a escavação do bloco C parada pela chuva, o pedido de aço e a falta de aço. O Argos guarda isso só a partir do RDO aprovado. |
| 3 | RDO de ontem (`2.9`) | Abrir a obra e, em "RDOs aprovados", o nº 001. | Esse RDO foi preenchido pela IA a partir de três áudios curtos. O engenheiro só revisou e aprovou. |
| 4 | Pasta da obra (`2.3`) | Voltar à obra. Mostrar "Ficou dos dias anteriores", com "não citado hoje". | Hoje é o dia 2. A memória da obra já está carregada. |
| 5 | Registro (`3.2`) | "Registrar", gravar o áudio do dia 2 (texto abaixo) e tirar 3 fotos. | Um áudio de um minuto e as fotos, com hora e local carimbados. |
| 6 | Pasta da obra | Esperar o registro sair de "O Argos está entendendo". Abrir "O que o Argos ouviu". | O Gemini transcreve, e a Claude entende o que foi dito: efetivo, betoneira, alvenaria, clima. |
| 7 | Revisão (`3.3`) | "Gerar RDO". Esperar uns 30 segundos. | **O diferencial:** o engenheiro não falou de nenhuma pendência de ontem, e o Argos cobra as três antes de fechar o dia. |
| 8 | Revisão | Responder as três cobranças (abaixo). Mostrar que viram desfecho em "Itens em aberto". | Cada item sai fechado, mantido ou atualizado, sempre confirmado pelo engenheiro. |
| 9 | Revisão | Responder a pergunta que sobrar, como a da grua. | A IA não inventa: o que não foi falado, ela pergunta. |
| 10 | Aprovado (`3.4`) | "Aprovar RDO". Mostrar "Amanhã o Argos vai perguntar por". | Aprovado com responsável, data e hora. Amanhã o Argos já sabe o que cobrar. |
| 11 | Pendências | Mostrar o pedido de aço em "Fechados nos últimos 7 dias". | A memória atravessa os dias. |

### Áudio do dia 2

Ler em uns 20 segundos:

> Bom dia, dia vinte e cinco. Começamos às sete. Hoje são dez pedreiros nossos e três serventes. A betoneira dois parou às oito e meia, foi pra manutenção. Começamos a alvenaria do segundo pavimento no bloco B. Tempo nublado de manhã e sol à tarde, deu pra trabalhar o dia todo. Encerramos às cinco, uma hora de almoço.

Se o microfone falhar, use "Usar um áudio já gravado" e escolha `data/demo/dia2.wav`.

### Respostas às cobranças

| Item | Resposta |
|---|---|
| Retomar a escavação do bloco C | Botão "Continua igual" |
| Fazer o pedido de aço | Escrever: "Pedido feito hoje com a Ferragens Silva, entrega na quinta" |
| Falta de aço | Escrever: "Continua faltando até a entrega de quinta" |
| Grua | Escrever: "Grua parada o dia todo" |

## Se der errado

| Sintoma | O que fazer |
|---|---|
| Registro fica em "O Argos está entendendo" por mais de 1 minuto | O Gemini passou do limite de 60 s. Recarregue a pasta: o registro sai como `failed` e entra no RDO sem transcrição. Gere o RDO assim mesmo, ou rode o seed e use o `dia2.wav`. |
| "Montando o RDO" passa de 1 minuto | Recarregue a página. Se aparecer "Não deu pra montar o RDO", volte e clique em "Gerar RDO" de novo. |
| "Aprovar RDO" desligado | Falta campo: o aviso vermelho no topo diz qual. Sem 3 fotos no dia, o RDO não aprova. |
| A API caiu | `pnpm --filter @argos/api dev` e recarregue. Os dados estão no Postgres. |

## Números pro pitch

- Dia 1: três áudios de 10 a 20 segundos viraram um RDO completo, com duas perguntas do agente.
- Dia 2: um áudio de 20 segundos, três cobranças de pendências que o engenheiro não citou.
- Cada chamada fica no Langfuse, com prompt, resposta, tokens e custo.
