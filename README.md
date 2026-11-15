# Sleevebook

Álbum digital para catalogar sua coleção de cartas TCG. Você define o tamanho do álbum (2×2, 3×3, 4×4…), a quantidade de páginas e a cor, folheia as páginas como num livro e cadastra cada carta no seu slot.

> Status: as fases v0.1, v0.2 e v0.3 estão prontas; conta, sincronização, link público e scanner dependem de backend e não foram iniciados. Detalhes e limitações em [docs/PLANEJAMENTO.md](docs/PLANEJAMENTO.md).

## Funcionalidades

Acompanhe o que já está pronto no [roadmap](docs/PLANEJAMENTO.md#roadmap).

- Álbum com grade e número de páginas configuráveis
- Visual de fichário: começa fechado, abre com a capa de dentro à esquerda e a página 1 à direita; páginas que viram (botões, teclado e deslize no celular)
- Cor do álbum por roda de cores ou hexadecimal, com papel, bolsos e texto adaptados
- Cadastro de carta por slot, com busca em bases públicas (Pokémon, Magic, Yu-Gi-Oh!) e, para Pokémon, filtros por set, raridade, ilustrador e idioma
- Vários álbuns, arrastar cartas entre slots
- Coleção dos sonhos: marque cada carta como "tenho" ou "ainda quero"; as que faltam aparecem em cinza no álbum
- Painel da coleção (tenho, faltam, progresso por álbum e por set), lista pesquisável com filtro por situação e wishlist
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

O site está publicado em <https://guiaugusto.github.io/sleevebook/>. A cada push na `master`, o workflow `.github/workflows/pages.yml` publica no GitHub Pages (Settings → Pages com a fonte "GitHub Actions"). O site é estático, então qualquer outra hospedagem de arquivos também serve.

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
