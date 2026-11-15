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

## Atualização (2026-11-15): o efeito piscava nas cartas da página da direita

- **Sintoma**: nas cartas da página da direita, o foil ficava instável, como se o mouse entrasse e saísse da carta mesmo se movendo dentro dela. Na página da esquerda funcionava.
- **Causa**: o próprio slot (quem recebe o mouse) era inclinado e levantado com `transform`. Com o slot inclinado, a área que responde ao mouse se desloca sob o ponteiro e o mouse "sai" da carta; ao sair, o efeito desliga, a carta volta ao lugar e o mouse "entra" de novo. Medi: com a inclinação máxima, 80 de 81 pontos dentro de uma carta da direita deixavam de acertar o slot; na esquerda (página no verso da folha, espelhada) nenhum falhava.
- **Correção**: o slot fica **parado** e é o único alvo do mouse. A imagem, o rótulo e as camadas de brilho ficam num `.card3d` interno com `pointer-events: none`, e só ele inclina e levanta (inclusive o "levantar" ao passar o mouse, que também deslocava a área). O brilho virou um elemento `.foil` dentro do `.card3d`, no lugar do `::before` do slot.
- **Regra para o futuro**: nunca aplicar `transform` ao elemento que decide o `hover`/`pointermove`; aplicar a um filho sem eventos.

## Atualização 2 (2026-11-15): a carta volta a inclinar "como na mão"

- A correção do piscar (acima) teve um efeito colateral que eu não tinha percebido: a carta passou a inclinar **dentro** do slot, que cortava tudo que saía dele (`overflow: hidden`). Por isso a carta parecia quase parada, sem o movimento de "segurar a carta na mão" que existia antes.
- **Correção**: o slot (alvo do mouse, parado) deixou de cortar (`overflow: visible`) e o corte arredondado foi para o `.card3d`, que se mexe sozinho. Enquanto a carta brilha ela inclina por inteiro (até 14°), cresce 7%, levanta e ganha uma sombra maior, e o slot sobe de camada (`z-index`) para a carta passar por cima das vizinhas. A abertura do bolso continua parada atrás.
- Os fundos de "carta sem imagem" e "ainda não tenho" também foram para o `.card3d`, para acompanharem o movimento.

## Atualização 3 (2026-11-15): com o mouse de verdade, a carta só levantava

- **Sintoma**: depois das duas correções anteriores, com o mouse sobre a carta ela só subia um pouco, sem girar. O movimento de "carta girando no próprio eixo", parecido com o do Pokémon TCG Pocket, não aparecia.
- **Causa**: a regra de "levantar ao passar o mouse" (`.slot[data-page].filled:hover .card3d`, 5 seletores) tinha especificidade maior que a regra do foil (`.slot.foiling[data-foil] .card3d`, 4 seletores). Com o `:hover` real, a regra do levantar ganhava e a inclinação era ignorada, embora as variáveis `--rx`/`--ry` estivessem corretas. Nos meus testes anteriores eu simulava a classe `foiling` por JavaScript, sem `:hover` real, então nunca vi isso.
- **Correção**: a regra do foil passou a ter especificidade maior (`.slot.filled.foiling[data-page][data-foil] .card3d`). Também tirei o aumento de 7% do tamanho: a carta gira no próprio eixo (como antes), sem crescer. O slot sem corte, a sombra maior e o `z-index` continuam.
- **Como verificar**: sempre com o ponteiro de verdade. Com o mouse em quatro pontos (centro-esquerda, canto superior, canto inferior, bordas), `--rx`/`--ry` mudam com a posição, o `transform` do `.card3d` é `matrix3d` (inclinada) e o foil continua ligado também nas bordas.
