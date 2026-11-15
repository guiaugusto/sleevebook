# Links curtos: como configurar

Este Worker é **opcional**. Sem ele, o botão "Gerar link curto" não aparece e o app usa só o link longo. Com ele, o link do álbum fica com cerca de 50 caracteres.

O Worker guarda só o álbum **já cifrado no navegador**; a chave para abrir fica no fragmento do link (`#c=<id>.<chave>`), que nunca chega a servidor nenhum. Decisão completa no [ADR 0009](../docs/adr/0009-link-curto-com-worker.md).

## O que você precisa

- Uma conta gratuita na Cloudflare (https://dash.cloudflare.com). Não precisa instalar nada no computador: dá para fazer tudo pelo painel.
- Uns 10 minutos.

## Passo a passo (pelo painel)

Os nomes dos menus podem variar um pouco, porque a Cloudflare muda o painel de vez em quando.

1. **Criar o armazenamento (KV).** No painel, abra *Workers & Pages* → *KV* (ou *Storage & Databases* → *KV*) → *Create a namespace*. Nome sugerido: `sleevebook-links`.
2. **Criar o Worker.** *Workers & Pages* → *Create* → *Create Worker* → dê o nome `sleevebook-links` → *Deploy* (com o código de exemplo mesmo).
3. **Colar o código.** Abra o Worker → *Edit code*, apague tudo, cole o conteúdo inteiro de [`worker.js`](worker.js) e clique em *Deploy*.
4. **Ligar o KV ao Worker.** No Worker: *Settings* → *Bindings* → *Add* → *KV namespace*. Em *Variable name* escreva exatamente `LINKS` e escolha o namespace do passo 1. Salve/faça o deploy.
5. **(Opcional) Painel de consumo.** *Settings* → *Variables and Secrets* → adicione um **Secret** chamado `ADMIN_TOKEN` com uma senha longa sua. Com isso, `https://SEU-WORKER.workers.dev/stats` (com o cabeçalho `Authorization: Bearer <senha>`) mostra quantas gravações já foram usadas hoje.
6. **Copiar o endereço.** Na página do Worker aparece o endereço `https://sleevebook-links.<seu-usuario>.workers.dev`. Copie, sem a barra no final.
7. **Ligar no app.** Edite [`src/js/config.js`](../src/js/config.js) e coloque o endereço em `SHORTLINK_API`. Se quiser, peça para o Claude fazer essa edição e o commit.
8. **Conferir os sites autorizados.** Em `LIMITS.allowedOrigins` (no topo de `worker.js`) devem estar o endereço do app (`https://guiaugusto.github.io`) e, para testes locais, `http://localhost:8791`. Se mudar o domínio do app, atualize aí e cole o código de novo no passo 3.

Pronto: abra o app, entre num álbum, clique em **🔗 Compartilhar** e em **Gerar link curto**.

## Como ajustar os limites (e o custo)

Tudo fica no bloco `LIMITS` no topo de `worker.js`. Para mudar, edite o valor, cole o arquivo de novo no editor do Worker (passo 3) e clique em *Deploy*.

| Limite | Padrão | O que faz |
|---|---|---|
| `maxBodyBytes` | 120.000 | Tamanho máximo do álbum cifrado. Um fichário cheio fica em torno de 10 mil. |
| `ttlSeconds` | 90 dias | Quanto tempo o link vive. Não renova ao abrir (renovar gastaria uma gravação por leitura). Prazo menor = menos armazenamento. |
| `dailyWriteBudget` | 800 | Gravações por dia que o Worker aceita gastar. O plano gratuito do KV permite 1.000 por dia (confira na [página de limites](https://developers.cloudflare.com/kv/platform/limits)); a folga evita bater no limite da Cloudflare. |
| `writesPerCreate` | 2 | Cada link novo grava 2 vezes (o álbum e o contador do dia). Com os padrões, cabem cerca de 400 links por dia. |
| `readCacheSeconds` | 1 dia | O link nunca muda, então abrir de novo reaproveita o cache e não gasta leitura do KV. |
| `allowedOrigins` | seu site e localhost | Quem pode usar o Worker. |

Quando o orçamento do dia acaba, o Worker responde "cota" e o app avisa e oferece o link longo. O contador zera à meia-noite UTC. Para crescer além do plano gratuito, aumente `dailyWriteBudget` (e mude para o plano pago da Cloudflare).

Observações:
- A contagem do dia usa o KV, que é eventualmente consistente: ela pode errar por poucas unidades quando muitas pessoas criam links ao mesmo tempo. A folga de 200 gravações cobre isso.
- Quem cria um link curto recebe um código secreto de exclusão, guardado só naquele navegador. Pelo botão **Apagar link curto** ele some do KV.
