# 2. Arquitetura

## Visão de conjunto

O Sleevebook é um **site estático**: HTML, CSS e módulos JavaScript (ES modules) servidos como arquivos, sem etapa de build, sem framework e sem dependências de runtime ([ADR 0001](adr/0001-site-estatico-sem-build.md)). Tudo roda no navegador. A única peça fora dele é opcional: um Worker da Cloudflare para links curtos.

```
                          ┌────────────────────────── navegador ──────────────────────────┐
                          │                                                                │
   GitHub Pages ─────────►│  index.html + src/css + src/js (módulos ES) + sw.js            │
   (arquivos estáticos)   │                                                                │
                          │   app.js ──► book.js, library.js, collection.js, wishlist.js   │
                          │      │         (telas)                                          │
                          │      ├──► store.js ──► IndexedDB  (álbuns, cartas, slots…)      │
                          │      ├──► search.js ─► providers/*  ─────────► APIs de cartas   │
                          │      └──► share.js, shortlink.js ───────────► Worker (opcional) │
                          └────────────────────────────────────────────────────────────────┘
        APIs de cartas: TCGdex, Pokémon TCG API, Scryfall, YGOPRODeck   Imagens: CDNs dos provedores e Scrydex
```

Princípios:

- **Local-first**: os dados do usuário ficam no navegador; nada vai para um servidor sem o usuário pedir ([ADR 0002](adr/0002-indexeddb-local-first.md)).
- **Lógica pura separada da tela**: regras de grade, cor, estatísticas, validação de links e armazenamento ficam em módulos testáveis, sem depender do DOM.
- **Sem build**: o código que você edita é o código que roda. Um empacotador pode ser adicionado depois sem reescrever.

## Estrutura de arquivos

```
index.html                 página única: todas as telas e diálogos
manifest.webmanifest       instalação como app (PWA)
sw.js                      service worker (uso offline)
icon.svg                   ícone
src/css/app.css            todos os estilos
src/js/                    módulos (tabela abaixo)
src/js/providers/          um módulo por fonte de cartas
tests/                     testes de lógica, rodam no navegador
tools/serve.ps1            servidor estático para quem não tem Python/Node
worker/                    Worker da Cloudflare (links curtos) e instruções
docs/                      esta documentação, ADRs e mockups
.github/                   template de PR, templates de issue e workflow de deploy
```

## Módulos de `src/js`

| Módulo | Responsabilidade |
|---|---|
| `app.js` | Orquestra: carrega dados, liga botões, navega entre telas, aplica o modo de visualização |
| `store.js` | Camada fina sobre o IndexedDB; exportar e importar JSON; preferências (`meta`) |
| `grid.js` | Regras puras: grade, folhas e páginas, capacidade, presets, medidas do livro, chave de slot |
| `book.js` | O livro: folhas 3D, virar página, slots, arrastar, foil, modo de uma página |
| `library.js` | A prateleira de fichários e a animação de aproximar/afastar a capa |
| `cardform.js` | Diálogo de cadastro de carta (abas no celular) |
| `search.js` | Interface de busca (filtros, resultados, "mostrar mais") |
| `providers/` | `pokemon.js`, `tcgdex.js`, `scryfall.js`, `yugioh.js`, `images.js`, `index.js` |
| `collection.js`, `stats.js` | Tela e cálculos da Coleção (progresso por álbum e por set) |
| `wishlist.js` | Tela e diálogo da Wishlist |
| `color.js`, `wheel.js` | Cor do álbum: derivação do tema e seletor (roda, hexadecimal, cores prontas) |
| `share.js` | Codificar, comprimir, validar e ler links de compartilhamento |
| `shortlink.js` | Link curto: cifrar, enviar ao Worker, buscar, decifrar, apagar |
| `config.js` | Endereço do Worker (`SHORTLINK_API`); vazio desliga o link curto |
| `util.js` | Funções pequenas: `esc` (escape de HTML), `uid`, `toast`, download de JSON |

## Modelo de dados

```
Album    { id, name, game, rows, cols, pages, color, createdAt }          // pages = lados das folhas (folhas × 2)
Slot     { key, albumId, page, row, col, cardId }
Card     { id, name, set, setTotal, number, image, imageFallback?, language?, foil?,
           condition, qty, notes, owned, source, sourceId, updatedAt }
Wishlist { id, name, set, number, image, priority, notes, setTotal, source, sourceId }
```

- **Chave do slot**: `albumId:página:linha:coluna`. Um slot liga uma posição a uma carta.
- **Reduzir a grade não apaga cartas**: as que ficam fora continuam guardadas e voltam se a grade aumentar.
- **`owned === false`** significa "ainda quero" (cinza no álbum); sem o campo, a carta é "tenho".
- **`foil`**: `holo`, `reverse` ou `none`; ausente em cartas antigas, e o app descobre pelo TCGdex ao passar o mouse.
- **`imageFallback: 'en'`**: a imagem é a versão em inglês da carta, usada quando não existe imagem no idioma dela.

### Onde cada dado fica

| Dado | Onde | Observação |
|---|---|---|
| Álbuns, cartas, slots, wishlist | IndexedDB, banco `sleevebook` | Sem expiração; limpar os dados do site apaga tudo |
| Último álbum aberto | IndexedDB, loja `meta` | |
| Foil ligado/desligado | `localStorage` (`sleevebook-foil`) | Preferência por navegador |
| Última escolha de "tenho / ainda quero" | `localStorage` (`sleevebook-new-card-owned`) | |
| Códigos de exclusão dos links curtos | `localStorage` (`sleevebook-short-tokens`) | Só no navegador que criou o link |
| Álbum em visualização | Memória | Não é gravado até a pessoa adicionar à biblioteca |

## Telas e navegação

A página tem cinco áreas: **Biblioteca**, **Álbum**, **Coleção**, **Wishlist** e os diálogos. Só uma das áreas principais fica visível por vez. O endereço guarda a tela: vazio é a biblioteca, `#album`, `#colecao` e `#wishlist` são as outras. Abrir `#album` mostra o último álbum aberto, sem animação. Durante a visualização de um álbum compartilhado, o endereço é o do próprio link.

O estado em memória (`state` em `app.js`) tem o álbum aberto, seus slots e as cartas. O livro redesenha a partir dele, e toda gravação passa por `store.js`.

## Fluxos principais

**Cadastrar uma carta**
1. Clicar num slot abre o diálogo e leva o foco ao campo de busca.
2. A busca consulta os provedores do jogo do álbum e mostra os resultados; escolher um resultado preenche o formulário.
3. Salvar grava a carta e o slot no IndexedDB e atualiza só aquele slot no livro.

**Busca de Pokémon** ([ADR 0004](adr/0004-busca-pokemon-com-reserva.md)): o TCGdex é a fonte principal (12 idiomas, filtros, busca por número do Pokédex entre idiomas) e a Pokémon TCG API complementa; os resultados são juntados. Imagens que o TCGdex lista mas não existem (404) são consertadas na hora, procurando a imagem em inglês ou no CDN do Scrydex.

**Abrir um fichário**: a capa da prateleira é clonada e "voa" até o tamanho e a posição que a capa tem no livro ([ADR 0007](adr/0007-biblioteca-de-ficharios.md)). Com "reduzir movimento" ativo no sistema, não há animação.

**Foil** ([ADR 0005](adr/0005-efeito-foil.md)): só enquanto o ponteiro está sobre a carta; uma camada interna inclina em 3D e uma camada de faixas segue o ponteiro. É uma aproximação: as imagens são planas e não trazem máscaras de quais áreas brilham.

**Compartilhar**: ver [Compartilhamento](05-compartilhamento.md).

## Uso offline e atualizações (service worker)

- Arquivos do próprio site: **rede primeiro**, com revalidação (`cache: 'no-cache'`), e cache como reserva offline. Assim, quem está online sempre vê a versão mais nova.
- Requisições a outros sites (busca de cartas, imagens, Worker) **passam direto**: não são guardadas.
- Todo módulo novo precisa entrar na lista `SHELL` de `sw.js`, e a versão do cache (`CACHE`) sobe quando o conjunto de arquivos muda.
- Quem deixa a aba aberta vê o aviso "Há uma versão nova" com o botão Recarregar; o navegador também procura versão nova ao voltar para a aba e a cada 30 minutos.

## Testes

Os testes de lógica rodam no navegador (`tests/index.html`), com um mini-executor próprio (`tests/run.js`), sem dependências. Cobrem cor, grade e folhas, armazenamento (com IndexedDB de verdade), provedores, estatísticas, compartilhamento por link e o Worker de links curtos (com um KV simulado). Telas, animações e o efeito foil são verificados manualmente (ver [Operação](07-operacao.md#como-o-projeto-é-verificado)).

## Publicação

O workflow `.github/workflows/pages.yml` publica no GitHub Pages a cada push na `master`, copiando só `index.html`, `manifest.webmanifest`, `icon.svg`, `sw.js` e `src/`. A pasta `worker/`, os testes e a documentação **não** vão para o site. O Worker é publicado à parte, manualmente, na conta da Cloudflare.
