# ADR 0004: Busca de cartas por provedores, com reserva para Pokémon

- Status: aceito
- Data: 2026-11-14

## Contexto

O cadastro preenche a carta a partir de bases públicas. Os três jogos suportados (Pokémon, Magic, Yu-Gi-Oh!) têm APIs diferentes. Durante o desenvolvimento a Pokémon TCG API devolveu `502` em algumas chamadas; como o erro vem sem cabeçalho CORS, o navegador o mostra como "Failed to fetch".

## Decisão

- Cada jogo é um módulo em `src/js/providers/` que expõe `search(query, { signal })` e uma função pura `normalize` que converte a resposta para o formato do app: `{ name, set, setTotal, number, image, price, source, sourceId }`.
- `providers/index.js` mapeia jogo → provedor. Jogos sem provedor ("Outro") usam só o cadastro manual.
- Para Pokémon, a busca principal é a Pokémon TCG API com limite de 6 s. Se falhar ou demorar, usa-se o **TCGdex** (CORS aberto, total do set e preço do TCGplayer). Se o usuário cancelar a busca, a reserva não é chamada.
- Nenhuma chave de API é necessária nem guardada.

## Consequências

- Adicionar um jogo novo é criar um módulo e registrá-lo em `GAMES`.
- Os preços vêm em dólar (TCGplayer) e são informativos. Cartas sem preço ficam fora do valor total, e a tela Coleção avisa quantas são.
- Sem internet a busca falha com mensagem; o cadastro manual segue funcionando.
- As APIs públicas têm limite de uso e podem mudar de formato; os testes de `normalize` com respostas de exemplo ajudam a perceber quebras.
