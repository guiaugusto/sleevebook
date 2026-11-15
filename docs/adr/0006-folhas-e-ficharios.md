# ADR 0006: Folhas (frente e verso) e tamanhos de fichário do mercado

- Status: aceito
- Data: 2026-11-15

## Contexto

Na primeira versão, o tamanho do álbum era dado em **páginas**, e cada lado da folha contava como uma página. Quem tem um fichário de verdade pensa em **folhas**: a folha de plástico tem bolsos nos dois lados. Um fichário "de 20 folhas" tinha 40 lados no app e aparecia como "40 páginas"; quem configurou "20 páginas" ficou com um álbum com a metade do tamanho real.

## Decisão

- A interface passa a pedir **folhas (frente e verso)**. Internamente o álbum continua guardando `pages` (os lados), sempre `folhas × 2`; `sanitizeBinder` converte. Álbuns antigos com número ímpar de páginas aparecem com as folhas arredondadas para cima, e ao salvar ganham o lado que faltava.
- O diálogo de configuração mostra a conta: "9 bolsos por página · 20 folhas, 40 páginas (frente e verso) · cabem 360 cartas".
- **Presets com tamanhos do mercado** (`BINDER_PRESETS` em `grid.js`). Capacidade = bolsos × 2 lados × folhas:

| Preset | Capacidade | Observação |
|---|---|---|
| 4 bolsos (2×2), 20 folhas | 160 cartas | compacto; cerca de 160 cartas em fichários de 4 bolsos de 20 folhas |
| 9 bolsos (3×3), 20 folhas | 360 cartas | o mais comum; fichário oficial do Pokémon TCG e PRO-Binder da Ultra PRO |
| 9 bolsos (3×3), 40 folhas | 720 cartas | fichários vendidos no Brasil com 20 folhas e espaço para até 40 |
| 12 bolsos (3×4), 20 folhas | 480 cartas | PRO-Binder zipado de 12 bolsos da Ultra PRO |

- O álbum novo começa como o preset mais comum (9 bolsos, 20 folhas, 360 cartas). Dá para escolher qualquer outra combinação (linhas e colunas de 1 a 6, até 250 folhas).

## Consequências

- O que eu entendia por "20 páginas" estava errado em relação ao uso do usuário; o texto da tela agora fala "folhas" e mostra o total de cartas, para conferir com o fichário real.
- Os presets vêm de fichários e anúncios consultados na busca de mercado (Ultra PRO, fichário oficial do Pokémon TCG vendido no Brasil, Vault X). Há mais modelos no mercado (por exemplo, 18 bolsos); o 18 bolsos costuma ser o mesmo de 9 bolsos contado nos dois lados, que já está coberto pela conta de folhas.
