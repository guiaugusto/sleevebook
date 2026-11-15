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
