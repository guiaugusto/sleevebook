# Sleevebook

Álbum digital para catalogar sua coleção de cartas TCG. Você define o tamanho do álbum (2×2, 3×3, 4×4…), a quantidade de páginas e a cor, folheia as páginas como num livro e cadastra cada carta no seu slot.

> Status: em desenvolvimento. Veja o andamento em [docs/PLANEJAMENTO.md](docs/PLANEJAMENTO.md).

## Funcionalidades

Acompanhe o que já está pronto no [roadmap](docs/PLANEJAMENTO.md#roadmap).

- Álbum com grade e número de páginas configuráveis
- Visual de livro com páginas que viram (botões, teclado e deslize no celular)
- Cor do álbum por roda de cores ou hexadecimal, com papel, bolsos e texto adaptados
- Cadastro de carta por slot, com busca em bases públicas (Pokémon TCG, Scryfall, YGOPRODeck)
- Vários álbuns, arrastar cartas entre slots
- Painel da coleção, lista pesquisável, preço estimado e wishlist
- Funciona offline (PWA) e guarda tudo no navegador, com exportação em JSON

## Rodando localmente

Não há etapa de build nem dependências. Basta servir a pasta como site estático.

Com Python:

```bash
python -m http.server 8080
```

Com PowerShell (sem instalar nada):

```powershell
powershell -ExecutionPolicy Bypass -File tools/serve.ps1
```

Depois abra <http://localhost:8080>. Os testes ficam em <http://localhost:8080/tests/>.

## Publicando

O site é estático: qualquer hospedagem de arquivos serve. Há um workflow para o GitHub Pages em `.github/workflows/pages.yml`, hoje com gatilho manual porque o Pages não está disponível para repositórios privados no plano gratuito. Para ativar: torne o repositório público, em Settings → Pages escolha a fonte "GitHub Actions" e troque o gatilho do workflow para `push` na `master` (instruções no próprio arquivo).

O app é instalável e abre offline (PWA). Os dados ficam no navegador (IndexedDB); use **Exportar** para fazer backup.

## Estrutura

```
index.html          página do app
manifest.webmanifest, sw.js   instalação e uso offline
src/css/            estilos
src/js/             módulos ES (store, color, book, cards, providers…)
tests/              testes de lógica pura, rodam no navegador
tools/serve.ps1     servidor estático para quem não tem Python/Node
docs/               planejamento, ADRs e mockups
.github/            template de PR, templates de issue, workflows
```

## Documentação

- [Planejamento e roadmap](docs/PLANEJAMENTO.md)
- [Decisões técnicas (ADRs)](docs/adr)
- [Mockups do planejamento](docs/mockups/planejamento.html)
- [Como contribuir](CONTRIBUTING.md)

## Licença

[MIT](LICENSE)
