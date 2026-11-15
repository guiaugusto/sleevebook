# 3. Decisões técnicas

Cada decisão relevante tem um registro curto em [`docs/adr`](adr) (contexto, decisão, consequências). Esta página reúne todas num lugar só, com o motivo e o que foi descartado, e lista as decisões menores que não têm ADR.

## Resumo

| Decisão | Resumo | Registro |
|---|---|---|
| Site estático, JavaScript puro, sem build | Sem Node na máquina de desenvolvimento e sem servidor próprio; módulos ES nativos | [ADR 0001](adr/0001-site-estatico-sem-build.md) |
| Dados no navegador (IndexedDB) | Local-first: funciona offline e sem conta; exportar e importar em JSON | [ADR 0002](adr/0002-indexeddb-local-first.md) |
| Cor do álbum derivada | Uma cor base gera capa, texto, papel, bolsos e capa de dentro | [ADR 0003](adr/0003-cor-do-album-derivada.md) |
| Busca de Pokémon com duas fontes | TCGdex principal, Pokémon TCG API como complemento | [ADR 0004](adr/0004-busca-pokemon-com-reserva.md) |
| Efeito foil só em CSS | Brilho e inclinação enquanto o ponteiro está na carta | [ADR 0005](adr/0005-efeito-foil.md) |
| Tamanho em folhas e presets de mercado | "Folha" tem dois lados; capacidades conferidas em fichários reais | [ADR 0006](adr/0006-folhas-e-ficharios.md) |
| Biblioteca como tela inicial | Prateleira de fichários com animação de aproximar | [ADR 0007](adr/0007-biblioteca-de-ficharios.md) |
| Compartilhar por link | Álbum comprimido no fragmento da URL; visualização antes de adicionar | [ADR 0008](adr/0008-compartilhar-por-link.md) |
| Link curto com Worker opcional | Cifrado no navegador; limites configuráveis | [ADR 0009](adr/0009-link-curto-com-worker.md) |

## Por quê, e o que foi descartado

**Sem build e sem framework (ADR 0001).** O planejamento inicial sugeria Vite e TypeScript. Sem Node instalado e sem necessidade de empacotamento, JavaScript nativo é o caminho mais simples: o que se edita é o que roda, e não há dependências para atualizar. O custo é não ter tipos nem otimização de pacote. Dá para acrescentar um build depois sem reescrever.

**IndexedDB próprio, sem Dexie (ADR 0002).** A camada de armazenamento tem poucas operações (`all`, `get`, `put`, `del`, em lote, por álbum), então uma camada de ~50 linhas basta. Descartado: `localStorage` (limite pequeno e síncrono) e backend desde o início (conta, custo, privacidade). Consequência assumida: limpar os dados do site apaga o álbum, por isso existe Exportar.

**Cor derivada de uma só (ADR 0003).** Em vez de pedir várias cores, o usuário escolhe uma e o app calcula as outras, garantindo contraste do texto e coerência visual com qualquer cor, inclusive muito claras ou escuras.

**Pokémon com duas fontes (ADR 0004).** A Pokémon TCG API oscila e não tem todas as cartas (por exemplo, promos recentes); o TCGdex é mais completo, tem 12 idiomas e filtros. A busca consulta os dois e junta. Imagens que faltam no TCGdex vêm do CDN do Scrydex, cujo endereço **não é uma API documentada** e pode mudar sem aviso; por isso há também o conserto automático e a opção de enviar imagem própria.

**Foil como aproximação (ADR 0005).** Reproduzir o foil de verdade exigiria máscaras por carta, que as imagens não têm. A versão 1 usa faixas de arco-íris e inclinação 3D só sob o ponteiro, o que é leve (um efeito por vez). Foi iterada com feedback: a inclinação fica numa camada interna para o elemento que recebe o mouse não se mover e evitar tremida.

**Folhas e não páginas (ADR 0006).** Inicialmente "página" era cada lado; isso fazia o tamanho do fichário ficar pela metade em relação ao real. Agora o tamanho é em folhas (frente e verso), com presets de 4, 9 e 12 bolsos. O app guarda `pages` (lados) internamente; a interface fala em folhas.

**Biblioteca com animação (ADR 0007).** Para quem tem vários fichários, abrir direto no último esconde a coleção. A prateleira mostra todos de frente e a animação (Web Animations API) reforça a ideia de "chegar perto". Respeita "reduzir movimento" e tem limite de tempo para não prender a tela se a aba for para segundo plano.

**Link no fragmento da URL (ADR 0008).** O que vem depois do `#` nunca é enviado a servidores, então o site continua estático e os dados não passam por ninguém. Descartado: hash curto derivado do conteúdo (não dá para recuperar o álbum de um hash), encurtadores de terceiros (privacidade, cota, dependência) e importar direto ao abrir.

**Visualizar antes de adicionar (ADR 0008, revisado).** Abrir um link não grava nada: o álbum aparece em modo só leitura, e só o botão "Adicionar à biblioteca" o grava, como álbum novo. Isso evita encher a biblioteca por engano e deixa a pessoa decidir depois de ver.

**Worker opcional para link curto (ADR 0009).** Um link curto exige que alguém guarde o álbum. Um Worker com KV é o menor servidor possível, com plano gratuito e sem manutenção de máquina. Decisões de projeto:
- **Cifrar no navegador**, com a chave no fragmento: o servidor guarda só dados ilegíveis.
- **Limites num bloco só** (`LIMITS`): tamanho, prazo, orçamento diário de gravações, cache e sites autorizados, para ajustar custo sem mexer na lógica.
- **Sem renovar o prazo ao abrir**: cada renovação gastaria uma gravação, e o plano gratuito tem poucas por dia.
- **Sem limite por pessoa**: cada contagem também gastaria gravações; fica só o teto global do dia e o tamanho máximo.
- **Recurso desligado por padrão**: sem `SHORTLINK_API` o app usa só o link longo. Qualquer falha cai para o link longo.

## Decisões menores (sem ADR)

- **Sem preços** na interface: a pedido do usuário, "não vamos incluir informações de valores por enquanto". Cartas antigas podem ter o campo `price` guardado, sem uso.
- **Cartas "ainda quero"** ficam no álbum em cinza e não contam no progresso, em vez de viverem só na wishlist; assim o álbum já mostra o que falta.
- **Sem texto sobre as cartas** no álbum: os detalhes aparecem ao clicar; só cartas sem imagem mostram o nome.
- **Capa dura proporcional**: as medidas do livro ficam em `UNITS` (`grid.js`), usadas pelo livro e pela biblioteca, para as duas terem sempre a mesma proporção.
- **Cadastro em janela larga no computador e em tela cheia com abas no celular**: ver [Web e mobile](04-web-e-mobile.md).
- **Atualização com aviso**: depois de bugs "já corrigidos" aparecerem em abas antigas, o app ganhou o aviso de versão nova e o service worker passou a revalidar sempre.
- **PRs sem rodapé de co-autoria**: a pedido do usuário, os commits e PRs não levam `Co-Authored-By` nem a assinatura do assistente.

## Como propor ou mudar uma decisão

1. Abra uma issue com o contexto.
2. Crie um novo ADR em `docs/adr` com o próximo número (`0010-…`), contexto, decisão e consequências.
3. Se a decisão substitui outra, mude o status da antiga para "substituído" e linke as duas.
