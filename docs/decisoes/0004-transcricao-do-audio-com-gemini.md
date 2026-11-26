# 0004 Transcrição do áudio com Gemini (D17)

- **Data:** 25/11/2026, revisado em 26/11/2026
- **Situação:** aceita (em uso no staging e na demonstração; falta medir o erro com áudio real de obra)

## Contexto

O registro do engenheiro é um áudio. A API da Claude não aceita áudio: o bloco `audio` não existe na API de mensagens e o bloco `document` só aceita PDF (testado em 25/11/2026). A transcrição precisa vir de outro serviço.

## Decisão

A API transcreve com a API do Gemini, mandando o áudio como veio do celular (`audio/webm` no Chrome). A transcrição entra no agente como texto; a Claude interpreta e monta o RDO.

- **Modelos:** o principal é `gemini-3.1-flash-lite` (`GEMINI_MODEL`). Os de reserva vêm de `GEMINI_FALLBACK_MODELS`, separados por vírgula (padrão `gemini-flash-lite-latest,gemini-3.5-flash-lite,gemini-3.6-flash`). A chave fica em `GEMINI_API_KEY`.
- **Modelos em paralelo:** a API chama o principal e, se ele não responder em 4 segundos ou falhar, dispara o próximo da lista sem cancelar o anterior. Vale a primeira resposta, e as outras chamadas são canceladas. Cada tentativa tem tempo limite de 20 segundos, e a lista é percorrida no máximo duas vezes. Se todas falharem, o registro fica `failed`.
- **Silêncio:** o prompt manda responder `[sem fala]` sem fala audível, e a API trata isso como transcrição vazia (registro `failed`). Áudio com `durationSeconds` menor que 1 nem é enviado.
- **Onde a transcrição é usada:** no registro do dia, na correção falada do RDO e na resposta falada a uma pergunta, que é aplicada como a digitada.
- **IA desligada:** `AI_ENABLED=false` desliga toda chamada de IA, à Anthropic e ao Gemini: o registro nasce `processed` sem transcrição, o RDO é montado vazio para o engenheiro preencher, e a correção falada, a resposta falada e o diagnóstico respondem 409 `AI_DISABLED` sem chamar nada.
- **Testes:** `AI_FAKE=true` (só fora de produção) troca a transcrição pelo conteúdo do arquivo enviado como áudio e o agente por respostas fixas, para os testes de ponta a ponta em `scripts/e2e` rodarem sem rede.

## Consequências

- Falta medir erro de palavras com áudio real de obra, com ruído e jargão, e comparar com outro serviço (AWS Transcribe, por exemplo). Nos testes com fala sintetizada e silêncio, num segundo de silêncio o modelo inventou uma frase; o prompt e a duração mínima existem por causa disso. Se o resultado com áudio real for ruim, um novo ADR substitui este.
- A cota e a disponibilidade dos modelos variam (houve 429 e 503 nos testes). Os modelos em paralelo deixam a transcrição mais rápida e mais estável, mas uma transcrição lenta pode gastar até duas chamadas ao mesmo tempo.
- O áudio do engenheiro sai da API para o Google. Isso precisa de aval de privacidade antes de produção.
- `audio/mp4` (Safari) não foi testado.
