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
