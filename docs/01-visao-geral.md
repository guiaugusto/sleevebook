# 1. Visão geral

## O que é

O Sleevebook é um **álbum digital para catalogar coleções de cartas TCG** (Pokémon, Magic, Yu-Gi-Oh!). Ele imita um fichário físico: você escolhe quantos bolsos cabem em cada página, quantas folhas o fichário tem e a cor da capa, folheia o livro e registra cada carta no seu bolso (slot).

Endereço publicado: <https://guiaugusto.github.io/sleevebook/>.

## Para quem

Colecionadores que querem ver e organizar a coleção do mesmo jeito que ela está guardada de verdade, sem criar conta e sem pagar. Tudo funciona no navegador, no computador e no celular.

## O que ele faz

**Organização**
- **Biblioteca** na tela inicial: todos os fichários em pé numa prateleira, com a cor, o formato e a espessura de cada um. Clicar abre o fichário com uma animação de aproximar.
- **Fichário configurável**: linhas × colunas (1 a 6), folhas (frente e verso) e presets de fichários vendidos no mercado (4, 9 e 12 bolsos).
- **Cor do álbum** por roda de cores, luminosidade, hexadecimal ou cores prontas. O restante do visual (papel, bolsos, texto) é derivado dessa cor.
- **Livro** que abre e vira páginas, com capa dura, capa de dentro e contracapa.

**Cartas**
- **Cadastro por slot** com busca em bases públicas (Pokémon, Magic, Yu-Gi-Oh!), preenchendo nome, set, número e imagem. Para Pokémon há filtros por set, raridade, ilustrador e idioma (12 idiomas, incluindo japonês).
- **"Tenho" e "ainda quero"**: cada carta é marcada; as que faltam aparecem em cinza no álbum.
- **Efeito foil**: cartas com versão holo brilham e inclinam ao passar o mouse ou tocar.
- **Mover cartas** arrastando (computador) ou pelo botão "Mover…" (celular).

**Coleção**
- **Painel**: cartas que tenho, que faltam, cópias, progresso por álbum e por set.
- **Lista pesquisável** de todas as cartas, com a localização de cada uma.
- **Wishlist** com prioridade e atalho para colocar a carta no álbum.

**Dados e compartilhamento**
- Tudo fica **no navegador** (IndexedDB), com exportar e importar em JSON.
- **Compartilhar por link**: o álbum vira um link; quem abre vê o álbum só para visualização e pode adicioná-lo à biblioteca. Há um link curto opcional (ver [Compartilhamento](05-compartilhamento.md)).
- **PWA**: instalável e com abertura offline.

## O que ele não faz (ainda)

- **Conta e sincronização entre dispositivos**: exigem servidor ([#16](https://github.com/guiaugusto/sleevebook/issues/16)). Hoje o caminho para outro dispositivo é exportar e importar o JSON, ou compartilhar por link.
- **Link público sempre atualizado** ([#17](https://github.com/guiaugusto/sleevebook/issues/17)): o link de compartilhamento é uma cópia de um momento, não uma página viva.
- **Scanner de carta pela câmera** ([#18](https://github.com/guiaugusto/sleevebook/issues/18)).
- **Valor estimado da coleção**: adiado por decisão do usuário; o app não mostra nem preenche preços ([#12](https://github.com/guiaugusto/sleevebook/issues/12)).
- **Busca offline**: sem internet a busca de cartas não funciona; o cadastro manual sim.

## Vocabulário

| Termo | Significado |
|---|---|
| **Fichário / álbum** | O conjunto de folhas, com a capa. Na biblioteca, cada um é uma capa na prateleira |
| **Folha** | A folha física de plástico, com bolsos nos dois lados (frente e verso) |
| **Página** | Cada lado de uma folha. Um fichário de 20 folhas tem 40 páginas |
| **Bolso / slot** | Um lugar para uma carta. Em um fichário 3×3 com 20 folhas cabem 3 × 3 × 40 = 360 cartas |
| **Preset** | Um tamanho de fichário do mercado (por exemplo, 9 bolsos e 20 folhas) |
| **Visualização** | O modo só de leitura em que um álbum recebido por link é aberto |
| **Link curto** | Versão curta do link de compartilhamento, que usa um Worker da Cloudflare |
