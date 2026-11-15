# ADR 0002: IndexedDB como armazenamento, local-first

- Status: aceito
- Data: 2026-11-14

## Contexto

O álbum guarda imagens de cartas. O `localStorage` tem limite de cerca de 5 MB e armazena apenas texto, o que não comporta centenas de imagens. Também não queremos exigir conta para começar.

## Decisão

Guardar tudo em **IndexedDB**, com quatro coleções: `albums`, `slots`, `cards`, `wishlist`. Uma camada fina em `src/js/store.js` expõe operações assíncronas simples. Exportar e importar em JSON continua disponível como backup e como forma de levar os dados para outro dispositivo.

Separar `Slot` (posição no álbum) de `Card` (dados da carta) permite mudar a grade de um álbum sem perder cartas e alimentar a lista da coleção.

## Consequências

- Funciona offline e sem conta. Os dados ficam no navegador do usuário; limpar os dados do site apaga o álbum, por isso a exportação é recomendada.
- Sincronização entre dispositivos e links públicos exigem um backend, que está fora do escopo até a v1.0 (ver roadmap).
