# 7. Operação e desenvolvimento

## Rodar localmente

Não há build nem dependências: basta servir a pasta como site estático.

```bash
python -m http.server 8080
```

Sem Python nem Node (PowerShell):

```powershell
powershell -ExecutionPolicy Bypass -File tools/serve.ps1
```

Abra <http://localhost:8080>. Para usar outra porta no PowerShell: `-Port 8791`. Os testes ficam em `/tests/`.

Observações:
- Abrir `index.html` direto do disco (`file://`) **não funciona**: módulos ES e service worker exigem `http://`.
- A Web Crypto (usada no link curto) exige HTTPS ou `localhost`.
- Para o Worker aceitar chamadas do seu servidor local, a origem (por exemplo, `http://localhost:8791`) precisa estar em `allowedOrigins`.

## Testes

Abra `tests/index.html` pelo servidor local. A página roda todos os testes e mostra "N passaram, M falharam" (o título da aba vira `OK` ou `FALHOU`).

| Arquivo | Cobre |
|---|---|
| `grid.test.js` | Grade, folhas, páginas, presets, medidas, primeiro slot livre |
| `color.test.js` | Derivação do tema a partir da cor |
| `store.test.js` | IndexedDB de verdade: gravar, ler, filtrar por álbum, exportar e importar |
| `providers.test.js` | Montagem de buscas e normalização de resultados |
| `stats.test.js` | Contagens e progresso por álbum e por set |
| `share.test.js` | Link de compartilhamento: ida e volta, dados maliciosos, imagens, links inválidos |
| `shortlink.test.js` | Worker (com KV simulado): criar, ler, apagar, limites, CORS; cliente: cifra e erros |
| `backup.test.js` | Validação do backup importado: ids e campos maliciosos, slots, imagens, limites |

Para um teste novo, crie `tests/<nome>.test.js`, use `test`, `eq` e `ok` de `tests/run.js` e inclua o nome na lista de `tests/index.html`.

### Como o projeto é verificado

- **Automático**: os testes acima (lógica pura).
- **Manual, no navegador**: telas, virar páginas, mudar grade e cor, cadastrar e buscar carta, vários álbuns, Coleção, Wishlist, biblioteca, link de compartilhamento e link curto de ponta a ponta com o Worker real.
- **APIs reais**: chamadas a TCGdex, Pokémon TCG API, Scryfall e YGOPRODeck durante o desenvolvimento.
- **No site publicado**: carregamento, service worker ativo, arquivos em cache e console sem erros.
- **Não verificado**: abrir o app sem internet de ponta a ponta, arrastar com mouse real, celular físico e fluidez de animações (ver [Web e mobile](04-web-e-mobile.md#o-que-foi-testado-e-o-que-não-foi)).

## Publicar

O site é publicado **automaticamente** a cada push na `master` pelo workflow `.github/workflows/pages.yml` (Settings → Pages com a fonte "GitHub Actions"). Também dá para rodá-lo manualmente em *Actions → Run workflow*. O deploy leva cerca de um minuto.

Ao mudar o conjunto de arquivos do app:
1. Inclua o novo módulo em `SHELL`, no `sw.js`.
2. Suba a versão do cache (`CACHE`, por exemplo `sleevebook-v8` para `v9`).

Quem já usa o app vê o aviso "Há uma versão nova" e recarrega.

## Link curto: configurar e operar o Worker

Passo a passo completo: [`worker/README.md`](../worker/README.md). Resumo:

1. Crie uma conta gratuita na Cloudflare.
2. Crie um **KV namespace** (`sleevebook-links`) e um **Worker** com o conteúdo de [`worker/worker.js`](../worker/worker.js). Use a opção "Hello World", não a de importar repositório.
3. No Worker, ligue o KV com o nome de variável **`LINKS`** (*Settings → Bindings*).
4. (Opcional) Crie o Secret `ADMIN_TOKEN` para usar o `/stats`.
5. Coloque o endereço do Worker em `SHORTLINK_API` ([`src/js/config.js`](../src/js/config.js)) e publique.

**Conferir**: abrir o endereço do Worker no navegador deve mostrar `{"error":"not_found"}`.

**Ajustar limites**: edite `LIMITS` em `worker.js`, cole o arquivo de novo no editor do Worker e clique em *Deploy*. Valores e efeitos na tabela de [Compartilhamento](05-compartilhamento.md#limites-e-custo).

**Ver o consumo**: com `ADMIN_TOKEN`, `GET /stats` com `Authorization: Bearer <senha>` mostra gravações usadas hoje, orçamento e links criados. Sem ele, veja os pares em *KV → sleevebook-links → KV Pairs* (só texto cifrado).

**Custo**: no plano gratuito, ao passar dos limites as operações falham, sem cobrança. Confira os números atuais na [página de limites do KV](https://developers.cloudflare.com/kv/platform/limits).

**Desligar**: esvazie `SHORTLINK_API`. Para apagar os dados, remova o namespace no painel.

## Backup e recuperação

- **Exportar** gera um JSON com **todos** os álbuns, cartas, slots e wishlist. Guarde-o fora do navegador (nuvem, e-mail). Recomendado antes de limpar dados do navegador, trocar de aparelho ou fazer qualquer operação arriscada.
- **Importar** pergunta entre **Mesclar** (mantém o que existe e soma o backup; ids iguais são sobrescritos) e **Substituir** (apaga tudo e usa só o backup).
- Para levar **um álbum** a outra pessoa, prefira o [link de compartilhamento](05-compartilhamento.md).
- O conteúdo do backup é validado na importação e o diálogo avisa quantos itens foram ignorados ([Segurança](06-seguranca-e-privacidade.md#2-arquivos-de-backup-json-importado)). Ainda assim, prefira backups que você mesmo exportou.

## Como contribuir

O fluxo completo está em [CONTRIBUTING.md](../CONTRIBUTING.md). Em resumo:

1. Toda mudança parte de uma issue (ou cria uma).
2. Branch a partir da `master`: `feat/…`, `fix/…`, `chore/…`, `docs/…`.
3. Commits e título do PR no padrão `tipo: descrição no imperativo` (ex.: `feat: create card registration modal`). O merge é *squash*, então o título do PR vira a mensagem na `master`.
4. PR com o [template](../.github/pull_request_template.md): tipo de ajuste, descrição detalhada, evidências e o checklist.
5. Decisão relevante vira um [ADR](adr).
6. Para validar na prática, rode os testes e confira a mudança no navegador, incluindo a largura de celular (375 px).

**Boas práticas do código**
- Valores que vêm de dados e entram em HTML passam por `esc(...)` (ver [Segurança](06-seguranca-e-privacidade.md#1-injeção-de-html-xss)).
- Regras puras ficam em módulos sem DOM, com teste.
- Novo módulo: entra em `SHELL` do `sw.js`.
- Texto da interface em português do Brasil.

## Problemas comuns

| Sintoma | Causa provável | O que fazer |
|---|---|---|
| Tela em branco ao abrir `index.html` | Aberto por `file://` | Sirva por `http://localhost` |
| Vejo uma versão antiga do site | Aba aberta com código antigo | Clique em "Recarregar" ou use Ctrl+F5 |
| "Gerar link curto" não aparece | `SHORTLINK_API` vazio | Preencha o endereço do Worker |
| Link curto dá "limite de hoje acabou" | Orçamento diário esgotado | Use o link longo ou espere a meia-noite UTC; aumente `dailyWriteBudget` se necessário |
| Erro 403 ao criar link curto | Site fora de `allowedOrigins` | Inclua a origem no `LIMITS` do Worker e publique de novo |
| Worker responde com erro (500) | KV não ligado como `LINKS` | Confira o binding no painel |
| Imagem de carta não aparece | O provedor não tem a imagem | O app tenta a versão em inglês e o Scrydex; dá para enviar imagem própria |
| Carta não aparece na busca | Está em outro idioma ou set | Troque o idioma da busca ou use os filtros |
| Perdi meus álbuns | Dados do navegador foram limpos | Importe o último backup |
