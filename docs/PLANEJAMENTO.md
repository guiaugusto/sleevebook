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
| v1.0 · PWA e deploy | 🟡 PWA implementado (offline por confirmar); deploy preparado, mas manual |
| v1.0 · Itens que dependem de backend | ⬜ não iniciados (conta, sincronização, link público, scanner) |

## Decisões técnicas

| Tema | Decisão | Registro |
|---|---|---|
| Nome | Sleevebook | este documento |
| Stack | HTML, CSS e módulos ES, sem build | [ADR 0001](adr/0001-site-estatico-sem-build.md) |
| Armazenamento | IndexedDB, local-first, export JSON | [ADR 0002](adr/0002-indexeddb-local-first.md) |
| Cor do álbum | uma cor base, o resto derivado | [ADR 0003](adr/0003-cor-do-album-derivada.md) |
| Busca de cartas | provedores por jogo; Pokémon com reserva | [ADR 0004](adr/0004-busca-pokemon-com-reserva.md) |
| Licença | MIT | [LICENSE](../LICENSE) |

### O que mudou em relação ao planejamento inicial

- **Sem Vite/TypeScript**: não há Node na máquina de desenvolvimento, então o projeto é JavaScript puro com módulos ES (ADR 0001). Pode ganhar um build depois sem reescrita.
- **Sem Dexie**: a camada de IndexedDB é própria e pequena (`src/js/store.js`).
- **Pokémon com reserva**: a Pokémon TCG API oscilou durante os testes; há fallback para o TCGdex (ADR 0004).
- **Deploy manual**: o GitHub Pages não está disponível para repositório privado no plano gratuito. O workflow existe, mas só roda manualmente.

## Modelo de dados

```
Album    { id, name, game, rows, cols, pages, color, createdAt }
Slot     { key, albumId, page, row, col, cardId }
Card     { id, name, set, setTotal, number, image, condition, qty, notes, price, source, sourceId, updatedAt }
Wishlist { id, name, set, number, image, priority, notes, setTotal, price, source, sourceId }
```

A chave de um slot é `albumId:página:linha:coluna`. Reduzir a grade não apaga cartas: as que ficam fora continuam guardadas e voltam se a grade aumentar.

## Roadmap

Legenda: ⬜ a fazer · ✅ pronto · 🟡 parcial

### v0.1 · MVP

- ✅ Criar álbum com linhas × colunas e número de páginas ([#19](https://github.com/guiaugusto/sleevebook/pull/19), [#20](https://github.com/guiaugusto/sleevebook/pull/20))
- ✅ Folhear em visual de livro: botões, teclado, deslizar, salto para página ([#20](https://github.com/guiaugusto/sleevebook/pull/20))
- ✅ Cor do álbum por roda de cores, luminosidade, hexadecimal e cores prontas ([#21](https://github.com/guiaugusto/sleevebook/pull/21))
- ✅ Cadastrar carta por slot: nome, set, número, condição, quantidade, preço, notas, imagem por URL ou envio ([#21](https://github.com/guiaugusto/sleevebook/pull/21))
- ✅ Salvar no navegador, exportar e importar JSON, com mesclar ou substituir ([#19](https://github.com/guiaugusto/sleevebook/pull/19), [#20](https://github.com/guiaugusto/sleevebook/pull/20))

### v0.2 · Cartas de verdade

- ✅ Buscar carta em base pública e preencher os campos: Pokémon TCG API (com reserva TCGdex), Scryfall, YGOPRODeck ([#22](https://github.com/guiaugusto/sleevebook/pull/22))
- ✅ Vários álbuns: criar, trocar, renomear, excluir ([#23](https://github.com/guiaugusto/sleevebook/pull/23))
- ✅ Mover e trocar cartas de slot arrastando, inclusive entre páginas ([#24](https://github.com/guiaugusto/sleevebook/pull/24))
- ✅ Contagem por página, frente e verso separados ([#24](https://github.com/guiaugusto/sleevebook/pull/24))

### v0.3 · Coleção e dados

- ✅ Painel: total de cartas, cópias, álbuns e progresso por álbum e por set ([#25](https://github.com/guiaugusto/sleevebook/pull/25))
- ✅ Lista e busca de toda a coleção, com filtros, ordenação e a localização de cada carta ([#25](https://github.com/guiaugusto/sleevebook/pull/25))
- ✅ Valor estimado, a partir do preço da busca ou digitado ([#25](https://github.com/guiaugusto/sleevebook/pull/25))
- ✅ Wishlist com prioridade e atalho "Colocar no álbum" ([#25](https://github.com/guiaugusto/sleevebook/pull/25))

### v1.0+

- 🟡 App instalável (PWA) e uso offline ([#26](https://github.com/guiaugusto/sleevebook/pull/26)): manifesto, ícone e service worker prontos; o registro do service worker **não pôde ser testado** no navegador embutido do app, então o uso offline precisa ser confirmado num Chrome normal.
- 🟡 Deploy no GitHub Pages ([#26](https://github.com/guiaugusto/sleevebook/pull/26)): workflow pronto, só manual (ver README).
- ⬜ Login e sincronização entre dispositivos ([#16](https://github.com/guiaugusto/sleevebook/issues/16)): exige backend.
- ⬜ Link público para mostrar o álbum ([#17](https://github.com/guiaugusto/sleevebook/issues/17)): exige backend.
- ⬜ Scanner de carta pela câmera ([#18](https://github.com/guiaugusto/sleevebook/issues/18)): exige reconhecimento de imagem.
- ⬜ Modo de uma página no celular e mover cartas por toque ([#27](https://github.com/guiaugusto/sleevebook/issues/27)).

## Limitações conhecidas

- **Celular**: o livro mostra duas páginas lado a lado, então as cartas ficam pequenas; o arrastar de cartas usa o recurso nativo do navegador e não funciona em telas de toque ([#27](https://github.com/guiaugusto/sleevebook/issues/27)).
- **Dados só no navegador**: limpar os dados do site apaga o álbum. Use **Exportar** para backup.
- **Páginas ímpares**: a última tela do livro mostra o verso em branco da última folha.
- **Preços**: vêm em dólar (TCGplayer), são aproximados e nem toda carta tem preço.
- **Busca offline**: sem internet a busca não funciona; o cadastro manual sim.
- **Imagens por URL**: dependem do site de origem continuar no ar; imagens enviadas por arquivo ficam guardadas no navegador.

## Como foi verificado

- 45 testes de lógica pura rodando no navegador (`tests/index.html`): cor, grade, armazenamento (IndexedDB real), provedores e estatísticas.
- Telas testadas manualmente no navegador embutido do app: álbum, virar páginas, mudar grade, escolher cor, cadastrar e buscar carta, vários álbuns, arrastar (com eventos de arrastar simulados), Coleção e Wishlist.
- Chamadas reais às APIs de Scryfall, YGOPRODeck, TCGdex e Pokémon TCG.
- **Não verificado**: registro do service worker e uso offline; arrastar com o mouse de verdade; teste em celular físico.

## Organização do trabalho

- Milestones: v0.1, v0.2, v0.3, v1.0. Labels: `feat`, `bug`, `chore`, `docs`, `ideia` e de área (`album`, `cadastro`, `dados`, `ui`).
- Cada mudança entra por PR na `master`, com o [template](../.github/pull_request_template.md) (tipo de ajuste, descrição da solução, evidências e checklist de padrão de commit e PR). Fluxo em [CONTRIBUTING.md](../CONTRIBUTING.md).
