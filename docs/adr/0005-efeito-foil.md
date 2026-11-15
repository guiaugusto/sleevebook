# ADR 0005: Efeito foil nas cartas (versão 1)

- Status: aceito
- Data: 2026-11-15

## Contexto

Queremos que as cartas com versão holo tenham um brilho parecido com o da carta de verdade. Um protótipo mostrou que dá para reproduzir o efeito só com CSS, com limites: as imagens que usamos são planas e não trazem as máscaras de cada carta (que áreas brilham), então o efeito é uma aproximação.

## Decisão

- **Onde**: só no álbum, **enquanto o mouse ou o dedo está sobre a carta**. Não há efeito em todas as cartas ao mesmo tempo (custo de desempenho).
- **Como**: camada `::before` do slot com faixas de arco-íris (`repeating-linear-gradient`, `mix-blend-mode: color-dodge`) cuja posição segue o ponteiro, mais uma leve inclinação 3D (`perspective` + `rotateX/Y`, até 14°). O brilho do plástico do bolso (`::after`) fica por cima.
- **Tipos** (campo `foil` da carta): `holo` (a carta toda), `reverse` (só a moldura; máscara aproximada que deixa de fora a janela da arte) e `none`. Cartas sem versão foil e cartas "ainda não tenho" (cinza) nunca brilham.
- **De onde vem o tipo**: do TCGdex (`variants`: `holo` tem prioridade sobre `reverse`; sem nenhuma das duas, `none`), gravado ao cadastrar pela busca. Cartas Pokémon salvas antes disso são descobertas na primeira vez que o mouse passa por cima (uma consulta ao TCGdex, gravada na carta). No cadastro dá para escolher à mão: Automático, Holo, Reverse holo ou Sem foil.
- **Liga e desliga**: caixa "Efeito foil nas cartas" nas configurações, vale para todos os álbuns (guardada no navegador). Com "reduzir movimento" ativo no sistema, o efeito não aparece.

## Consequências

- Não há máscaras por carta, então o reverse holo é aproximado e raridades especiais (rainbow, dourada, VMAX, Illustration rare) recebem o mesmo holo genérico.
- O desempenho com muitas cartas não foi medido; por isso só uma carta brilha por vez.
- No celular o efeito segue o toque; o giro do aparelho (DeviceOrientation) ficou para depois.
