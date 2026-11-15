# ADR 0003: Cor do álbum derivada de uma única cor base

- Status: aceito
- Data: 2026-11-14

## Contexto

Queremos que o usuário escolha livremente a cor do álbum (roda de cores ou hexadecimal) sem que a interface fique ilegível ou as cartas percam destaque.

## Decisão

O usuário escolhe **uma cor base**. O restante é calculado em `src/js/color.js`:

- **Capa:** a própria cor base.
- **Texto da capa:** branco ou escuro, o que der maior contraste (WCAG) com a capa.
- **Papel e bolsos:** mesma matiz, saturação limitada a 40% e luminosidade alta (92% e 83%), para ficarem sempre claros e neutros.
- As cores são aplicadas por variáveis CSS (`--alb`, `--alb-ink`, `--paper`, `--pocket`) no elemento do álbum.

## Consequências

- Qualquer hexadecimal é aceito; cores muito claras ou escuras continuam legíveis.
- A cor é salva por álbum.
- Cores que dependam de outras relações (por exemplo, esquema complementar) exigiriam novas regras de derivação.

## Atualização (2026-11-15): visual de fichário

O álbum deixou de ser "páginas de papel claro dentro de uma capa" e passou a parecer um fichário de verdade:

- **Tudo é da cor do álbum.** `deriveTheme` devolve `base` (capa de fora), `page` (fundo das páginas, um tom que se afasta do extremo mais próximo: +5 de luminosidade se a cor é escura, −5 se é clara), `inside` (capa de dentro, mais fechada) e `ink` (texto da capa). As variáveis CSS passam a ser `--alb`, `--alb-ink`, `--page` e `--inside`; `--paper` e a saturação limitada do papel deixaram de existir.
- **Bolsos de plástico transparente**: a abertura de cada slot é um preto translúcido sobre o fundo da página (`--pocket`), com borda clara (`--pocket-edge`) e um brilho diagonal. A cor do bolso não depende da cor do álbum.
- **Livro**: começa fechado, mostrando a capa. Ao abrir, a capa de dentro (sem cartas) fica à esquerda e a página 1 à direita. A capa e a contracapa são folhas "duras", um pouco maiores que as páginas. Há `totalSheets(páginas) = folhas de páginas + 2`, e os spreads vão de 0 (fechado, capa) a `totalSheets` (fechado, contracapa).
- **Sem texto sobre as cartas** nem cabeçalho nas páginas: os detalhes aparecem ao clicar no slot. Só cartas sem imagem mostram o nome, para dar para identificá-las. A contagem de cartas passou para a barra de páginas.
