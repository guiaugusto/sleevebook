# ADR 0004: Busca de cartas por provedores, com duas fontes para Pokémon

- Status: aceito
- Data: 2026-11-14

## Contexto

O cadastro preenche a carta a partir de bases públicas. Os três jogos suportados (Pokémon, Magic, Yu-Gi-Oh!) têm APIs diferentes. Durante o desenvolvimento a Pokémon TCG API devolveu `502` em algumas chamadas; como o erro vem sem cabeçalho CORS, o navegador o mostra como "Failed to fetch".

## Decisão

- Cada jogo é um módulo em `src/js/providers/` que expõe `search(query, { signal })` e uma função pura `normalize` que converte a resposta para o formato do app: `{ name, set, setTotal, number, image, price, source, sourceId }`.
- `providers/index.js` mapeia jogo → provedor. Jogos sem provedor ("Outro") usam só o cadastro manual.
- Para Pokémon, a busca consulta **as duas fontes ao mesmo tempo** (Pokémon TCG API, com limite de 6 s, e TCGdex) e junta os resultados, sem repetir a mesma carta (mesmo nome, mesmo número e set compatível). Motivo: nenhuma das duas tem todas as cartas (a Pokémon TCG API não tinha a promo MEP 040 do Turtwig, que o TCGdex tem) e a primeira às vezes fica fora do ar. Só falha se as duas falharem. A primeira fonte tem prioridade nos dados da carta (imagem, preço).
- Nenhuma chave de API é necessária nem guardada.

## Consequências

- Adicionar um jogo novo é criar um módulo e registrá-lo em `GAMES`.
- Os preços vêm em dólar (TCGplayer) e são informativos. Cartas sem preço ficam fora do valor total, e a tela Coleção avisa quantas são.
- Sem internet a busca falha com mensagem; o cadastro manual segue funcionando.
- As APIs públicas têm limite de uso e podem mudar de formato; os testes de `normalize` com respostas de exemplo ajudam a perceber quebras.

## Atualização (2026-11-14)

- **Duas fontes juntas** (descrito acima), em vez de "principal com reserva": a versão anterior só consultava o TCGdex quando a Pokémon TCG API falhava, então, com ela no ar, cartas que só o TCGdex tem não apareciam.
- **Palavras extras**: a API só entende o nome. Se a busca com todas as palavras não acha nada ("turtwig 040", "turtwig mep"), busca-se pela primeira palavra e filtra-se pelas demais no nome, set e número. Se o filtro não sobrar nada, mostra tudo.
- **Limite de 30 resultados** por provedor.

## Atualização 2 (2026-11-15): TCGdex como fonte principal, com filtros

- A **Pokémon TCG API está sendo descontinuada** (segundo comparativos de APIs: sem novos cadastros e chaves valendo até 1º de março de 2027). O app a usa sem chave, então deixou de ser a base da busca.
- O **TCGdex** passa a ser a **fonte principal** de Pokémon (`providers/tcgdex.js`). Ele filtra por campo no servidor, então a busca ganhou **filtros avançados**: set, raridade, ilustrador e idioma (inglês ou português). Dá para buscar só com filtros, sem digitar o nome, e há "Mostrar mais" (páginas de 30).
- A Pokémon TCG API continua sendo consultada junto em buscas simples por nome em inglês, só para **completar imagem e preço** que o TCGdex não tenha e para trazer cartas que ele não tenha. Com filtros ou em português ela não é usada.
- As listas de sets (221), raridades (44) e ilustradores (cerca de 400) vêm do próprio TCGdex e são carregadas uma vez por idioma.
- Os filtros valem só para Pokémon; Magic e Yu-Gi-Oh! seguem com busca por nome.

## Atualização 3 (2026-11-15): imagens que faltam no TCGdex

- O TCGdex **não tem imagem** para vários sets e promos recentes: nenhuma das 112 cartas do set MEP (incluindo o Turtwig 040) e cerca de 23% das primeiras 500 cartas do catálogo.
- O CDN de imagens do **Scrydex** (`images.scrydex.com/pokemon/<set>-<número>/small`) serve essas cartas sem chave. Para cada carta sem imagem, `providers/images.js` deriva os endereços prováveis a partir do id do TCGdex (sem zeros à esquerda: `sv05-010` → `sv5-10`), testa carregar cada um e usa o primeiro que funciona. Em 120 cartas que estavam sem imagem, as 120 foram resolvidas; o custo é de cerca de meio segundo por busca.
- **Risco**: é um endereço de imagem que o Scrydex não documenta como API pública. Pode mudar ou passar a exigir chave. Se isso acontecer, as cartas voltam a aparecer sem imagem (o cadastro continua funcionando e dá para colar uma URL ou enviar foto). O endereço da imagem fica salvo na carta, então cartas já cadastradas dependem do CDN continuar no ar.
