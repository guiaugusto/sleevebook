# 5. Compartilhamento

É possível compartilhar um álbum de dois jeitos, e o segundo é opcional:

| | Link de compartilhamento (longo) | Link curto |
|---|---|---|
| Aparência | `…/#compartilhar=<código comprido>` | `…/#c=<id>.<chave>`, cerca de 55 caracteres |
| Onde o álbum fica | **Dentro do próprio link** | Em um Worker da Cloudflare, cifrado |
| Precisa de servidor | Não | Sim (Worker + KV), opcional |
| Validade | Para sempre (é o próprio conteúdo) | Cerca de 90 dias |
| Tamanho | Milhares de caracteres (cerca de 6 mil para 360 cartas, em teste) | Fixo e curto |
| Pode ser apagado | Não | Sim, por quem criou, no mesmo navegador |
| Privacidade | O conteúdo só passa por quem recebe o link | O servidor guarda só texto cifrado; a chave vai no link |

Em ambos, quem abre o link vê o álbum **só para visualização**; adicioná-lo à biblioteca é uma ação explícita.

## Como usar

**Compartilhar**
1. Abra o álbum e clique em **🔗 Compartilhar**.
2. Escolha se quer incluir as suas **notas** (desmarcado por padrão).
3. Copie o link longo, ou clique em **Gerar link curto** (se o recurso estiver ligado) e copie o curto. No celular, **Enviar…** usa o menu de compartilhar do sistema.
4. Para desfazer um link curto, abra o diálogo de novo e clique em **Apagar link curto**, no navegador em que o criou.

**Receber**
1. Abra o link (ou cole-o numa aba do Sleevebook que já esteja aberta).
2. O álbum aparece com o aviso **"Álbum compartilhado: só para ver"**. Dá para folhear, ver as cartas e clicar numa carta para ver os dados.
3. Para guardar, clique em **Adicionar à biblioteca** (no aviso ou na barra do álbum). Ele entra como álbum novo.
4. Para sair sem guardar, use qualquer aba, o botão **← Biblioteca** ou **Esc**.

## O que vai no link e o que não vai

| Vai | Não vai |
|---|---|
| Nome, jogo, linhas, colunas, folhas e cor do álbum | Fotos enviadas por você (arquivos) |
| Cada carta: posição, nome, set, número, total do set, idioma, "tenho ou quero", condição, quantidade, foil | Notas, a menos que você marque a caixa |
| O endereço da imagem, quando vem de um provedor conhecido | Imagens de outros endereços |
| | Cartas que ficaram fora da grade |

## Formato (versão 1)

```
{ v: 1,
  a: { n: nome, g: jogo, r: linhas, c: colunas, p: páginas, k: cor },
  s: [ [página, linha, coluna, nome, set, número, total, fonte, sourceId, idioma,
        sinalizadores, quantidade, condição, foil, notas, imagem], … ] }
```

- Cada carta é uma lista curta; campos vazios no fim são cortados.
- `sinalizadores`: bit 1 = "tenho"; bit 2 = imagem em inglês no lugar do idioma da carta.
- `condição`: índice na lista de condições; vazio é "NM", a padrão.
- `imagem`: se for um endereço do TCGdex que segue o padrão `…/{idioma}/{série}/{set}/{número}/high.webp`, vai só `~{série}` e o resto é refeito a partir do idioma e do `sourceId`. Isso reduziu o link em 23% num álbum de teste de 360 cartas.
- O JSON é comprimido com `CompressionStream('deflate-raw')` e codificado em base64url.
- O campo `v` permite evoluir o formato: links de uma versão mais nova que o app geram um aviso para recarregar.

Tamanho medido: 360 cartas de teste (4 sets, nomes variados) geraram um código de 5.878 caracteres; sem nenhuma imagem seriam 5.570. Acima de 8 mil caracteres, o app avisa que apps de mensagem podem cortar o link e sugere o arquivo de backup.

## Link curto

### Como funciona

1. O navegador monta o mesmo código do link longo e o **cifra** com AES-GCM de 128 bits, com uma chave gerada na hora.
2. Só o **texto cifrado** é enviado ao Worker, que guarda no KV e devolve um id aleatório de 12 caracteres e um código secreto de exclusão.
3. O link final é `…/#c=<id>.<chave>`. A **chave fica depois do `#`**, parte que o navegador nunca envia a nenhum servidor.
4. Quem abre o link: o app busca o texto cifrado pelo id, decifra no navegador com a chave do link, valida e mostra o álbum.

O Worker nunca vê o álbum, só um bloco de dados que não consegue ler.

### API do Worker

| Pedido | Resposta | Observações |
|---|---|---|
| `POST /s` (corpo: texto cifrado em base64url) | `201` com `{ id, token, ttlDays }` | `400` se o corpo é inválido, `413` se passa do tamanho, `429` se a cota do dia acabou, `403` se o site não é autorizado |
| `GET /s/<id>` | `200` com o texto cifrado | `404` se não existe ou expirou; resposta com cache longo (o link nunca muda) |
| `DELETE /s/<id>` (cabeçalho `X-Delete-Token`) | `204` | `403` se o código está errado; o Worker guarda só o hash do código |
| `GET /stats` (cabeçalho `Authorization: Bearer <ADMIN_TOKEN>`) | Consumo do dia | Só existe se a variável secreta `ADMIN_TOKEN` estiver definida |

### Limites e custo

Todos ficam no bloco `LIMITS` no topo de [`worker/worker.js`](../worker/worker.js):

| Limite | Padrão | Efeito |
|---|---|---|
| `maxBodyBytes` | 120.000 | Tamanho máximo do álbum cifrado (um fichário cheio fica em torno de 10 mil) |
| `ttlSeconds` | 90 dias | O link expira sozinho; **não renova ao abrir** (renovar gastaria uma gravação por leitura) |
| `dailyWriteBudget` | 800 | Gravações por dia que o Worker aceita; o plano gratuito do KV permite 1.000 |
| `writesPerCreate` | 2 | Cada link grava o álbum e o contador do dia, então cabem cerca de 400 links por dia |
| `readCacheSeconds` | 1 dia | O link é imutável: abrir de novo reaproveita o cache |
| `allowedOrigins` | o site e `localhost:8791` | Quais sites podem usar o Worker |

Ao chegar ao orçamento do dia, o Worker recusa novos links (429) e o app oferece o link longo. O contador zera à meia-noite UTC. A contagem usa o KV, que é eventualmente consistente, então pode errar por poucas unidades; a folga de 200 gravações cobre isso. Os números do plano gratuito vêm da [página de limites do KV](https://developers.cloudflare.com/kv/platform/limits) e podem mudar: confira antes de depender deles.

### Quando algo falha

| Situação | O que o app faz |
|---|---|
| Cota do dia esgotada | Avisa e mantém o link longo disponível |
| Álbum grande demais para o link curto | Avisa e sugere o link longo ou o backup |
| Sem rede ou Worker fora do ar | Avisa; o link longo continua funcionando |
| Link curto expirado ou apagado | "Este link curto não existe mais" |
| Chave errada ou link cortado | "Este link curto está incompleto ou corrompido" |
| `SHORTLINK_API` vazio | O botão "Gerar link curto" não aparece; abrir um link curto avisa que o serviço não está ligado |

### Ligar, ajustar e desligar

- **Ligar**: crie o KV e o Worker na Cloudflare e preencha `SHORTLINK_API` em [`src/js/config.js`](../src/js/config.js). Passo a passo em [`worker/README.md`](../worker/README.md).
- **Ajustar limites**: edite `LIMITS` e cole o arquivo de novo no editor do Worker.
- **Desligar**: esvazie `SHORTLINK_API`. Os links curtos já criados deixam de abrir neste site.

## Limitações

- **É uma cópia, não uma sincronização**: mudanças feitas depois pelo dono não chegam a quem já abriu ou adicionou.
- **Quem tem o link vê o álbum inteiro** e não há como cancelar um link longo. O link curto pode ser apagado, mas só pelo navegador que o criou (o código de exclusão fica no `localStorage`).
- **Links longos podem ser cortados** por apps de mensagem; o link curto resolve isso.
- **O link curto depende do Worker**: se a conta da Cloudflare for removida, esses links deixam de abrir.
- **A visualização não é guardada**: fechar a aba e voltar sem o link a perde (o link continua válido).
