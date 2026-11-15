# Planejamento do Sleevebook

Última atualização: 2026-11-14

Este documento é a fonte de verdade do que o projeto é, do que está pronto e do que falta. Os mockups navegáveis do planejamento original estão em [mockups/planejamento.html](mockups/planejamento.html).

## Visão

Um álbum digital para catalogar coleções de cartas TCG, no formato de um álbum físico: o usuário escolhe o tamanho da grade, o número de páginas e a cor, folheia o livro e cadastra cada carta no seu slot.

## Decisões já tomadas

| Tema | Decisão | Registro |
|---|---|---|
| Nome | Sleevebook | este documento |
| Stack | HTML, CSS e módulos ES, sem build | [ADR 0001](adr/0001-site-estatico-sem-build.md) |
| Armazenamento | IndexedDB, local-first, export JSON | [ADR 0002](adr/0002-indexeddb-local-first.md) |
| Cor do álbum | uma cor base, o resto derivado | [ADR 0003](adr/0003-cor-do-album-derivada.md) |
| Licença | MIT | [LICENSE](../LICENSE) |

## Modelo de dados

```
Album    { id, name, game, rows, cols, pages, color, createdAt }
Slot     { albumId, page, row, col, cardId }
Card     { id, name, set, setTotal, number, image, condition, qty, notes, price, source, sourceId }
Wishlist { id, name, set, number, image, priority, notes }
```

Um slot é identificado por `albumId:página:linha:coluna`. Reduzir a grade não apaga cartas: as que ficam fora continuam guardadas e voltam se a grade aumentar.

## Roadmap

Legenda: ⬜ a fazer · ✅ pronto

### v0.1 · MVP

- ✅ Criar álbum com linhas × colunas e número de páginas
- ✅ Folhear em visual de livro (botões, teclado, deslizar)
- ✅ Cor do álbum por roda de cores e hexadecimal
- ✅ Cadastrar carta por slot (nome, set, número, condição, quantidade, imagem)
- ✅ Salvar no navegador, exportar e importar JSON

### v0.2 · Cartas de verdade

- ✅ Buscar carta em base pública e preencher os campos (Pokémon TCG API com reserva TCGdex, Scryfall, YGOPRODeck)
- ✅ Vários álbuns
- ✅ Mover e trocar cartas de slot arrastando
- ✅ Contagem por página (frente e verso)

### v0.3 · Coleção e dados

- ⬜ Painel: total de cartas, progresso por set
- ⬜ Lista e busca de toda a coleção, com a localização de cada carta
- ⬜ Valor estimado
- ⬜ Wishlist

### v1.0+ · Conta e compartilhamento

- ⬜ App instalável (PWA) e uso offline
- ⬜ Login e sincronização entre dispositivos (exige backend)
- ⬜ Link público para mostrar o álbum (exige backend)
- ⬜ Scanner de carta pela câmera

## Fora do escopo por enquanto

Itens que dependem de servidor (conta, sincronização, link público) ou de reconhecimento de imagem (scanner) não fazem parte do que o projeto entrega sem backend. Estão no roadmap para quando houver essa infraestrutura.

## Organização do trabalho

- Milestones no GitHub: v0.1, v0.2, v0.3, v1.0.
- Labels: `feat`, `bug`, `chore`, `docs`, `ideia`, e as de área (`album`, `cadastro`, `dados`, `ui`).
- Fluxo de branches, commits e PRs em [CONTRIBUTING.md](../CONTRIBUTING.md).
