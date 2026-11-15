# Planejamento do Sleevebook

Última atualização: 2026-11-14

Fonte de verdade do que o projeto é, do que está pronto e do que falta. Os mockups do planejamento original estão em [mockups/planejamento.html](mockups/planejamento.html).

## Visão

Um álbum digital para catalogar coleções de cartas TCG, no formato de um álbum físico: o usuário escolhe o tamanho da grade, o número de páginas e a cor, folheia o livro e cadastra cada carta no seu slot.

## Resumo do estado

| Fase | Estado |
|---|---|
| v0.1 · MVP | ✅ pronto |
| v0.2 · Cartas de verdade | ✅ pronto |
| v0.3 · Coleção e dados | ✅ pronto |
| v1.0 · PWA e deploy | ✅ no ar em https://guiaugusto.github.io/sleevebook/ (offline em si por confirmar) |
| v1.0 · Itens que dependem de backend | ⬜ não iniciados (conta, sincronização, link público, scanner) |

## Decisões técnicas

| Tema | Decisão | Registro |
|---|---|---|
| Nome | Sleevebook | este documento |
| Stack | HTML, CSS e módulos ES, sem build | [ADR 0001](adr/0001-site-estatico-sem-build.md) |
| Armazenamento | IndexedDB, local-first, export JSON | [ADR 0002](adr/0002-indexeddb-local-first.md) |
| Cor do álbum | uma cor base, o resto derivado | [ADR 0003](adr/0003-cor-do-album-derivada.md) |
| Efeito foil | CSS ao passar o mouse; tipo pelo TCGdex | [ADR 0005](adr/0005-efeito-foil.md) |
| Busca de cartas | provedores por jogo; Pokémon: TCGdex principal com filtros + Pokémon TCG API como complemento | [ADR 0004](adr/0004-busca-pokemon-com-reserva.md) |
| Licença | MIT | [LICENSE](../LICENSE) |

### O que mudou em relação ao planejamento inicial

- **Sem Vite/TypeScript**: não há Node na máquina de desenvolvimento, então o projeto é JavaScript puro com módulos ES (ADR 0001). Pode ganhar um build depois sem reescrita.
- **Sem Dexie**: a camada de IndexedDB é própria e pequena (`src/js/store.js`).
- **Pokémon com duas fontes**: a Pokémon TCG API oscila e não tem todas as cartas; a busca consulta também o TCGdex e junta os resultados (ADR 0004).
- **Deploy**: o GitHub Pages não estava disponível com o repositório privado no plano gratuito. Depois que o repositório virou público, o Pages foi ativado e o workflow passou a publicar a cada push na `master` ([#31](https://github.com/guiaugusto/sleevebook/pull/31)).

## Modelo de dados

```
Album    { id, name, game, rows, cols, pages, color, createdAt }
Slot     { key, albumId, page, row, col, cardId }
Card     { id, name, set, setTotal, number, image, condition, qty, notes, owned, source, sourceId, updatedAt }   // owned === false: ainda não tenho (cinza no álbum); sem o campo = tenho
Wishlist { id, name, set, number, image, priority, notes, setTotal, source, sourceId }
```

A chave de um slot é `albumId:página:linha:coluna`. Reduzir a grade não apaga cartas: as que ficam fora continuam guardadas e voltam se a grade aumentar.

## Roadmap

Legenda: ⬜ a fazer · ✅ pronto · 🟡 parcial

### v0.1 · MVP

- ✅ Criar álbum com linhas × colunas e número de páginas ([#19](https://github.com/guiaugusto/sleevebook/pull/19), [#20](https://github.com/guiaugusto/sleevebook/pull/20))
- ✅ Folhear em visual de fichário: começa fechado, abre com a capa de dentro à esquerda e a página 1 à direita, bolsos de plástico sobre o fundo da cor do álbum, sem texto sobre as cartas (botões, teclado, deslizar, salto para página) ([#20](https://github.com/guiaugusto/sleevebook/pull/20))
- ✅ Cor do álbum por roda de cores, luminosidade, hexadecimal e cores prontas ([#21](https://github.com/guiaugusto/sleevebook/pull/21))
- ✅ Cadastrar carta por slot: nome, set, número, condição, quantidade, preço, notas, imagem por URL ou envio ([#21](https://github.com/guiaugusto/sleevebook/pull/21))
- ✅ Salvar no navegador, exportar e importar JSON, com mesclar ou substituir ([#19](https://github.com/guiaugusto/sleevebook/pull/19), [#20](https://github.com/guiaugusto/sleevebook/pull/20))

### v0.2 · Cartas de verdade

- ✅ Buscar carta em base pública e preencher os campos: Pokémon (TCGdex como fonte principal, completado pela Pokémon TCG API), Scryfall, YGOPRODeck, com filtro por palavras extras ([#22](https://github.com/guiaugusto/sleevebook/pull/22), [#35](https://github.com/guiaugusto/sleevebook/pull/35))
- ✅ Filtros avançados na busca de Pokémon: set, raridade, ilustrador e idioma (12 idiomas, incluindo japonês; dá para digitar o nome em inglês), busca só por filtros e "Mostrar mais"
- ✅ Vários álbuns: criar, trocar, renomear, excluir ([#23](https://github.com/guiaugusto/sleevebook/pull/23))
- ✅ Mover e trocar cartas de slot arrastando, inclusive entre páginas ([#24](https://github.com/guiaugusto/sleevebook/pull/24))
- ✅ Contagem por página, frente e verso separados ([#24](https://github.com/guiaugusto/sleevebook/pull/24))

### v0.3 · Coleção e dados

- ✅ Painel: total de cartas, cópias, álbuns e progresso por álbum e por set ([#25](https://github.com/guiaugusto/sleevebook/pull/25))
- ✅ Lista e busca de toda a coleção, com filtros, ordenação e a localização de cada carta ([#25](https://github.com/guiaugusto/sleevebook/pull/25))
- ⏸ Valor estimado: **adiado** por decisão do usuário. Os preços saíram da interface (cadastro, busca, Coleção); o app não preenche nem mostra mais preço. Cartas antigas podem ter o campo `price` guardado, que fica sem uso ([#12](https://github.com/guiaugusto/sleevebook/issues/12))
- ✅ Efeito foil (versão 1): carta com versão holo brilha e inclina ao passar o mouse ou tocar; tipo pelo TCGdex ou escolhido no cadastro; liga/desliga nas configurações ([ADR 0005](adr/0005-efeito-foil.md))
- ✅ Cartas "tenho" e "ainda quero": cada carta tem o marcador "Já tenho esta carta"; as que faltam aparecem em cinza no álbum, com contagem "faltam" e filtro na Coleção; progresso por álbum e por set conta só as que tenho
- ✅ Wishlist com prioridade e atalho "Colocar no álbum" ([#25](https://github.com/guiaugusto/sleevebook/pull/25))

### v1.0+

- ✅ App instalável (PWA) ([#26](https://github.com/guiaugusto/sleevebook/pull/26)): manifesto, ícone e service worker. No site publicado o service worker registrou (`activated`) e guardou os 21 arquivos do app. Falta só **abrir o app sem internet** para confirmar o uso offline de ponta a ponta (a issue [#14](https://github.com/guiaugusto/sleevebook/issues/14) segue aberta por isso).
- ✅ Deploy no GitHub Pages ([#26](https://github.com/guiaugusto/sleevebook/pull/26), [#31](https://github.com/guiaugusto/sleevebook/pull/31)): https://guiaugusto.github.io/sleevebook/, publicado a cada push na `master`.
- ⬜ Login e sincronização entre dispositivos ([#16](https://github.com/guiaugusto/sleevebook/issues/16)): exige backend.
- ⬜ Link público para mostrar o álbum ([#17](https://github.com/guiaugusto/sleevebook/issues/17)): exige backend.
- ⬜ Scanner de carta pela câmera ([#18](https://github.com/guiaugusto/sleevebook/issues/18)): exige reconhecimento de imagem.
- ✅ Modo de uma página no celular e mover cartas por toque ([#27](https://github.com/guiaugusto/sleevebook/issues/27)).

## Limitações conhecidas

- **Celular**: em telas estreitas o livro mostra uma página por vez (botões, deslizar) e a carta pode ser movida pelo botão "Mover…" do cadastro. Foi testado só em janela estreita no computador, não em celular físico. O arrastar com o mouse continua sendo o jeito direto no computador.
- **Dados só no navegador**: limpar os dados do site apaga o álbum. Use **Exportar** para backup.
- **Páginas ímpares**: a última tela do livro mostra o verso em branco da última folha.
- **Preços**: vêm em dólar (TCGplayer), são aproximados e nem toda carta tem preço.
- **Busca offline**: sem internet a busca não funciona; o cadastro manual sim.
- **Imagens por URL**: dependem do site de origem continuar no ar; imagens enviadas por arquivo ficam guardadas no navegador. As imagens que o TCGdex não tem vêm do CDN do Scrydex (endereço não documentado como API; ver ADR 0004).

## Como foi verificado

- 73 testes de lógica pura rodando no navegador (`tests/index.html`): cor, grade, armazenamento (IndexedDB real), provedores e estatísticas.
- Telas testadas manualmente no navegador embutido do app: álbum, virar páginas, mudar grade, escolher cor, cadastrar e buscar carta, vários álbuns, arrastar (com eventos de arrastar simulados), Coleção e Wishlist.
- Chamadas reais às APIs de Scryfall, YGOPRODeck, TCGdex e Pokémon TCG.
- No site publicado: página carrega, service worker ativo, 21 arquivos em cache, sem erros no console.
- **Não verificado**: abrir o app sem internet; arrastar com o mouse de verdade; teste em celular físico.

## Organização do trabalho

- Milestones: v0.1, v0.2, v0.3, v1.0. Labels: `feat`, `bug`, `chore`, `docs`, `ideia` e de área (`album`, `cadastro`, `dados`, `ui`).
- Cada mudança entra por PR na `master`, com o [template](../.github/pull_request_template.md) (tipo de ajuste, descrição da solução, evidências e checklist de padrão de commit e PR). Fluxo em [CONTRIBUTING.md](../CONTRIBUTING.md).
