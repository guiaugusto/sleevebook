# 6. Segurança e privacidade

Esta página descreve o que o sistema protege, como, e onde estão os limites. Segue a regra do restante da documentação: o que foi verificado está dito como verificado, e o que não foi está dito como pendente.

## Panorama

- **Sem conta, sem servidor próprio, sem cookies, sem analytics**: o Sleevebook não coleta dados de uso. O código roda no navegador e os dados ficam nele.
- **Superfície pequena**: um site estático, **zero dependências de runtime** (nenhum script de CDN) e, opcionalmente, um Worker com três operações.
- **O que mais importa proteger**: a coleção do usuário (privacidade) e a segurança do navegador ao abrir conteúdo vindo de fora (links de compartilhamento, arquivos de backup, respostas de APIs).

## Que dados existem e para onde vão

| Dado | Onde fica | Sai do navegador? |
|---|---|---|
| Álbuns, cartas, slots, wishlist, notas | IndexedDB do navegador | Só se você exportar, ou gerar um link de compartilhamento |
| Preferências e códigos de exclusão | `localStorage` | Não |
| O texto que você digita na busca | Memória | **Sim**: vai ao provedor do jogo (TCGdex, Pokémon TCG API, Scryfall ou YGOPRODeck) |
| Imagens das cartas | Carregadas do CDN do provedor | **Sim**: o CDN vê o seu endereço IP, como em qualquer imagem da web |
| Álbum em link longo | Dentro do link | Vai para quem você enviar o link |
| Álbum em link curto | Cifrado, no KV da Cloudflare | **Sim, cifrado**; a chave só está no link |

Dados que **não** são coletados: nome, e-mail, localização, histórico, identificadores de dispositivo. O app não cria conta e não envia telemetria.

## Ameaças consideradas e proteções

### 1. Injeção de HTML (XSS)

O app monta telas com `innerHTML` a partir de dados (nomes de cartas, sets, notas, ids). A defesa é **escapar toda saída**: a função `esc` (`util.js`) converte `& < > " '`, e é usada em textos e valores de atributos. Textos simples usam `textContent`. Os diálogos de leitura (como a janela de uma carta compartilhada) usam `textContent` e `style.backgroundImage` em vez de HTML.

**Verificado**: uma revisão de todos os pontos que interpolam dados em atributos ou HTML encontrou campos sem escape (`qty`, `setTotal`, ids, `page` e o id no filtro de álbuns da Coleção), alcançáveis por um **arquivo de backup malicioso**. Foram corrigidos no PR [#58](https://github.com/guiaugusto/sleevebook/pull/58) e testados com um backup com cargas `"><img src=x onerror=…>`: nenhum elemento é injetado e nenhum script roda na Coleção, na Wishlist e na Biblioteca.

**Regra para quem contribui**: todo valor que vem de dados (banco, backup, link, API) e entra em HTML ou atributo passa por `esc(...)`, inclusive números e ids.

### 2. Arquivos de backup (JSON importado)

A importação **valida só a estrutura** (`app`, `version`, listas de álbuns, cartas e slots), **não o conteúdo**. Isso significa que um backup de origem desconhecida pode trazer textos longos, ids e URLs de imagem arbitrários. Mitigações atuais: escape na saída (item 1) e o fato de a importação ser uma ação explícita do usuário, com escolha entre mesclar e substituir.

**Recomendação (não implementada)**: normalizar o backup na importação como já é feito com links (limites de texto, tipos numéricos, ids no formato esperado, imagens só de hosts conhecidos). Regra prática: **importe apenas backups que você mesmo exportou**.

### 3. Links de compartilhamento (conteúdo de terceiros)

Um link pode vir de qualquer pessoa, então `share.js` trata tudo como **não confiável** antes de mostrar ou gravar:

| Proteção | Como |
|---|---|
| Tamanhos de texto | Nome do álbum 60, carta 100, set 80, número 20, notas 500 caracteres; controles viram espaço |
| Grade e folhas | Passam por `sanitizeLayout` (linhas e colunas de 1 a 6, páginas até 500) |
| Cor | Só hexadecimal de 6 dígitos; senão a cor padrão |
| Jogo e fonte | Precisam existir na lista conhecida; senão `pokemon` e `manual` |
| `sourceId`, idioma | Só padrões simples (letras, números, `.`, `_`, `-`) |
| Posições | Fora da grade ou repetidas são descartadas; no máximo 20.000 cartas |
| Imagens | Só `https` dos hosts `assets.tcgdex.net`, `images.scrydex.com`, `images.pokemontcg.io`, `cards.scryfall.io` e `images.ygoprodeck.com`, com até 300 caracteres; `data:`, `javascript:` e outros hosts são descartados |
| Ids | Sempre **novos**; o álbum recebido nunca sobrescreve o que existe |
| "Bomba de compressão" | A descompressão para em 2 MB e o link aceito tem no máximo 1,5 milhão de caracteres |
| Link quebrado ou cortado | Erro em português, sem travar |
| Versão futura | Recusa com aviso para recarregar |

Além disso, o álbum recebido **abre em visualização**: não grava nada, não permite editar, mover ou configurar, e correções automáticas de imagem e foil ficam só na memória. Só o botão "Adicionar à biblioteca" grava, depois de a pessoa ver o conteúdo.

Há testes automatizados para esses casos, incluindo um conjunto de dados maliciosos (`tests/share.test.js`).

### 4. Link curto: confidencialidade e abuso

**Confidencialidade**
- O álbum é cifrado no navegador com **AES-GCM de 128 bits**, que também detecta alteração (um texto adulterado não decifra).
- A **chave está no fragmento** do link, que não é enviado a servidores: nem o Worker, nem a Cloudflare, nem o GitHub conseguem ler o álbum. O servidor guarda só dados ilegíveis.
- O id tem 72 bits aleatórios, então não dá para adivinhar ids; sem a chave, o conteúdo é inútil.
- O código de exclusão (128 bits) é guardado no Worker **apenas como hash SHA-256**.
- Teste: o registro guardado no KV não contém o nome nem o código de nenhuma carta.

**Abuso do endereço do Worker** (o endereço é público, como o de qualquer site)
- **Sites autorizados (CORS)**: só o site publicado e `localhost:8791` usam o Worker pelo navegador; outras origens recebem 403. Isso **não impede** um script fora de um navegador (por exemplo, `curl`) de criar links.
- **Tetos**: tamanho máximo por álbum e **orçamento diário** de gravações; ao esgotar, o Worker responde 429. Assim, o abuso gasta no máximo a cota do dia e não gera cobrança no plano gratuito.
- **Validação do corpo**: só texto base64url; qualquer outra coisa é recusada (400).
- **Expiração automática** (90 dias) limita o armazenamento acumulado.
- **`/stats`** só existe com `ADMIN_TOKEN` definido e exige o cabeçalho de autorização.

**Pontos de atenção**
- Não há limite **por pessoa**, só o teto global do dia: alguém pode esgotar a cota e impedir novos links curtos até a meia-noite UTC (o link longo continua funcionando).
- Quem tem o link completo abre o álbum, e **não há como revogar** um link já enviado, exceto apagá-lo (quem o criou, no mesmo navegador). Se o `localStorage` for limpo, o código de exclusão se perde e o link só some quando expirar.
- O `ADMIN_TOKEN`, se criado, deve ser uma senha longa e guardada como **Secret** no painel da Cloudflare, nunca no repositório.

### 5. Service worker e cache

- Só intercepta requisições **GET do mesmo site**; APIs externas, imagens externas e o Worker passam direto e nunca são guardados.
- Estratégia rede-primeiro com revalidação: um arquivo atualizado no servidor é o que o usuário vê; o cache é só reserva offline.
- O escopo é o do próprio app (`./`).

### 6. Dados no dispositivo

O IndexedDB **não é cifrado**: quem tiver acesso ao navegador do usuário (por exemplo, um computador compartilhado sem bloqueio de tela) pode ver a coleção. Não há senha no app. Para um computador compartilhado, use um perfil do navegador separado.

## Cadeia de suprimentos e publicação

- **Sem dependências de runtime**: não há pacotes do npm nem scripts de terceiros; o risco de uma dependência comprometida é praticamente nulo.
- **GitHub Actions**: o workflow de publicação usa ações oficiais (`checkout`, `configure-pages`, `upload-pages-artifact`, `deploy-pages`) e permissões mínimas (`contents: read`, `pages: write`, `id-token: write`). Publica apenas `index.html`, o manifesto, o ícone, `sw.js` e `src/`; **o Worker, os testes e as docs não vão para o site**.
- **Worker**: é publicado **manualmente** colando `worker.js` no painel da Cloudflare. Não há automação nem segredos no repositório; o endereço do Worker em `config.js` é público por natureza.
- **Mudanças**: tudo entra por PR na `master`, com o template do projeto.

## Pontos em aberto (melhorias recomendadas)

| Item | Risco | Ideia |
|---|---|---|
| **Sem Content Security Policy** | Defesa em profundidade contra XSS ausente | Adicionar uma CSP por `<meta>` (o GitHub Pages não permite cabeçalhos): `script-src 'self'`, `connect-src` só para as APIs e o Worker, `img-src` para os CDNs. O `index.html` não tem script inline, então é viável; os estilos inline exigem `'unsafe-inline'` em `style-src` |
| **Backup sem validação de conteúdo** | Texto/URL arbitrário importado | Normalizar na importação, reusando as regras de `share.js` |
| **Imagens por URL digitada** | Aceita qualquer endereço (revela o IP do usuário ao host da imagem) | É escolha do próprio usuário; aceitável, mas vale um aviso |
| **Sem limite por pessoa no Worker** | Um abusador esgota a cota diária | Cloudflare Rate Limiting ou um contador por IP (custa gravações) |
| **Dados locais sem cifra** | Acesso físico ao navegador | Opção de senha/cifra local, se um dia houver demanda |
| **Endereço do Worker público** | Qualquer script pode tentar criar links | É inerente a um site estático; os tetos limitam o impacto |

## Reportar uma vulnerabilidade

Veja [SECURITY.md](../SECURITY.md). Em resumo: não publique detalhes de uma falha em uma issue pública; use o relato privado do GitHub (aba *Security* → *Report a vulnerability*).
