# 4. Web e mobile

O mesmo código atende computador e celular. Não há dois apps: a página se adapta por **largura da janela** e por **tipo de ponteiro** (mouse ou toque).

## Resumo das diferenças

| Aspecto | Computador (janela larga) | Celular (janela estreita) |
|---|---|---|
| **Livro** | Duas páginas lado a lado, com capa dura | Uma página por vez (abaixo de 700 px): capa → páginas → contracapa |
| **Virar página** | Botões, teclado (← →), deslizar | Botões e **deslizar** o dedo |
| **Mover carta** | Arrastar e soltar (cartas trocam de lugar se o destino está ocupado) | Botão **Mover…** no cadastro, depois tocar no slot de destino |
| **Cadastro de carta** | Janela larga: busca à esquerda, dados e prévia à direita, rodapé fixo | Tela cheia com duas abas, **Buscar** e **Dados da carta**, rodapé fixo |
| **Foil** | Ao passar o mouse | Ao tocar e segurar sobre a carta |
| **Biblioteca** | Prateleira com várias colunas | 2 colunas, capas menores |
| **Atalhos** | ← → viram página, Esc volta à biblioteca | Sem teclado físico |
| **Instalação** | Opcional (PWA pelo navegador) | Adicionar à tela inicial (PWA) |

## Largura da janela: pontos de quebra

| Largura | O que muda |
|---|---|
| até 560 px | Cabeçalho mais compacto |
| até 600 px | Biblioteca com capas e espaços menores (2 colunas) |
| até 700 px | O livro passa a mostrar **uma página por vez** (`SINGLE_PAGE_MAX_WIDTH` em `book.js`) |
| até 720 px | Filtros da Coleção em duas colunas |
| até 760 px | O diálogo de cadastro vira **tela cheia** (`100dvh`) com abas |

O livro recalcula o tamanho ao redimensionar a janela (`resize`), e as medidas vêm de uma só tabela (`UNITS` em `grid.js`), então a capa da biblioteca e o livro mantêm a mesma proporção.

## Toque e ponteiro

- **Eventos de ponteiro** (`pointer*`) em vez de `mouse*`, para que mouse, toque e caneta funcionem com o mesmo código.
- **Deslizar para virar**: um arrasto horizontal de mais de 60 px fora de um slot vira a página. Começar o gesto sobre uma carta não vira, para não atrapalhar o toque.
- **Foil por toque**: o efeito acompanha o dedo enquanto está sobre a carta e termina ao soltar (`pointerup` com toque).
- **Arrastar e soltar** usa o recurso nativo do navegador, que **não funciona em telas de toque**. Por isso existe o "Mover…", que é o caminho no celular.
- A área do livro usa `touch-action` para permitir rolar e deslizar sem conflito.

## Telas com recorte e barras do sistema

O CSS respeita as áreas seguras (`env(safe-area-inset-*)`) no cabeçalho, no rodapé do cadastro, no aviso de movimento e nas notificações, para nada ficar sob o recorte da câmera ou a barra de gestos. O cadastro em tela cheia usa `100dvh`, que acompanha a barra de endereço do navegador no celular.

## PWA e uso offline

- **Instalável**: `manifest.webmanifest` (nome, ícone, cores, `display: standalone`) e um service worker.
- **Offline**: depois de aberto uma vez, o app abre sem internet com os arquivos guardados. O **cadastro manual funciona offline**; a **busca de cartas e as imagens externas não**, porque dependem das APIs e dos CDNs.
- **Atualizações**: o service worker busca na rede primeiro; há um aviso "Há uma versão nova" com botão Recarregar para abas abertas.
- **Dados**: ficam no IndexedDB do navegador. No celular, limpar dados do navegador, ou o navegador liberar espaço, pode apagar o álbum; use **Exportar** com regularidade.

## Movimento e acessibilidade

- **Reduzir movimento**: com a preferência ativa no sistema, a animação da biblioteca e o efeito foil são desligados e as transições do livro ficam instantâneas.
- **Teclado**: os slots são botões focáveis (`role="button"`, `tabindex`), os diálogos usam `<dialog>` nativo, e a página tem rótulos (`aria-label`) nos controles principais.
- **Contraste**: o texto da capa e do papel é derivado da cor escolhida para manter a legibilidade.

## Compatibilidade de navegador

O app usa recursos modernos: módulos ES, `<dialog>`, IndexedDB, Web Animations API, `CompressionStream` e Web Crypto (`crypto.subtle`). O link de compartilhamento e o link curto exigem navegadores recentes; **a Web Crypto só existe em contexto seguro** (HTTPS ou `localhost`), e o site publicado usa HTTPS. Não há suporte para navegadores antigos, e eu não testei versões específicas. O botão "Enviar…" usa a Web Share API, que aparece só onde o navegador a oferece (em geral no celular).

## O que foi testado e o que não foi

Testado: janela estreita (375 px) no navegador embutido, sem rolagem horizontal nas telas principais (biblioteca, álbum, diálogo de compartilhar, aviso de visualização); lógica de uma página, de deslizar e do "Mover…" por simulação.

**Não testado:**
- celular físico (toque real, teclado virtual, barra de endereço que recolhe);
- arrastar com mouse de verdade (foi simulado com eventos);
- fluidez das animações (o painel de testes roda em segundo plano e não permite avaliar);
- uso offline de ponta a ponta (a issue [#14](https://github.com/guiaugusto/sleevebook/issues/14) segue aberta);
- Safari/iOS e Firefox, que podem ter diferenças com `<dialog>`, `dvh` e `CompressionStream`.

Se algo se comportar diferente no seu aparelho, abra uma issue com o modelo do aparelho e o navegador.
