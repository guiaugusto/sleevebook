# Como contribuir

Este documento descreve como o trabalho é organizado no Sleevebook.

## Fluxo

1. Toda mudança parte de uma **issue** (ou cria uma).
2. Crie uma branch a partir da `master`: `feat/nome-curto`, `fix/nome-curto`, `chore/nome-curto`…
3. Faça commits pequenos, no padrão abaixo.
4. Abra um **Pull Request** para a `master` usando o template (`.github/pull_request_template.md`).
5. Depois do merge (squash), a branch é apagada. A `master` deve estar sempre pronta para publicar.

## Padrão de commit e de título de PR

```
tipo: descrição curta no imperativo, minúscula, sem ponto final
```

| Tipo | Quando usar |
|---|---|
| `feat` | nova funcionalidade |
| `fix` | correção de bug |
| `chore` | manutenção, configuração, CI |
| `docs` | documentação |
| `refactor` | refatoração sem mudar comportamento |
| `style` | visual, CSS, formatação |
| `perf` | desempenho |
| `test` | testes |

Exemplos: `feat: create card registration modal`, `fix: keep cards when the grid shrinks`, `docs: add color derivation ADR`.

O título do PR segue o mesmo padrão, porque o merge é feito com *squash* e o título vira a mensagem do commit na `master`.

## Decisões técnicas

Escolhas relevantes viram um registro curto em [`docs/adr`](docs/adr), com contexto, decisão e consequências. Assim dá para entender depois por que algo foi feito de certo jeito.

## Rodar localmente

O projeto é um site estático, sem etapa de build. Veja o [README](README.md#rodando-localmente).

## Testes

Os testes de lógica pura ficam em `tests/` e rodam no navegador: abra `tests/index.html` pelo servidor local.
