import { test, eq, ok } from './run.js';
import * as pokemon from '../src/js/providers/pokemon.js';
import { mergeResults, sameCard } from '../src/js/providers/pokemon.js';
import * as scryfall from '../src/js/providers/scryfall.js';
import * as yugioh from '../src/js/providers/yugioh.js';
import { searchCards, hasSearch, GAMES, refineResults } from '../src/js/providers/index.js';

test('Pokémon: normaliza carta com preço e total do set', () => {
  const [c] = pokemon.normalize({ data: [{ id: 'base1-4', name: 'Charizard', number: '4', set: { name: 'Base', printedTotal: 102 },
    images: { small: 'https://img/s.png' }, tcgplayer: { prices: { holofoil: { market: 350.5 } } } }] });
  eq(c, { name: 'Charizard', set: 'Base', setTotal: 102, number: '4/102', image: 'https://img/s.png', price: 350.5, source: 'pokemon', sourceId: 'base1-4' });
});
test('Pokémon: carta sem preço fica com price null', () => {
  eq(pokemon.normalize({ data: [{ id: 'x', name: 'A', number: '1', set: { name: 'S', printedTotal: 10 } }] })[0].price, null);
});
test('Pokémon: URL escapa aspas e usa a busca por prefixo', () => {
  const u = decodeURIComponent(pokemon.buildUrl('char"izard'));
  ok(u.includes('name:"charizard*"'), u);
});
test('Pokémon (reserva TCGdex): normaliza carta detalhada com preço do TCGplayer', () => {
  const c = pokemon.normalizeTcgdex({ id: 'base1-4', localId: '4', name: 'Charizard', image: 'https://assets/x/4',
    set: { name: 'Base Set', cardCount: { official: 102 } }, pricing: { tcgplayer: { unit: 'USD', holofoil: { marketPrice: 987.13 } } } });
  eq([c.number, c.setTotal, c.image, c.price], ['4/102', 102, 'https://assets/x/4/low.webp', 987.13]);
});
test('Pokémon (reserva TCGdex): item da lista, sem detalhes, não quebra', () => {
  const c = pokemon.normalizeTcgdex({ id: 'x-1', localId: '1', name: 'A' });
  eq([c.set, c.setTotal, c.price, c.number], ['', null, null, '1']);
});
test('Magic: usa a imagem da primeira face em cartas de duas faces', () => {
  const [c] = scryfall.normalize({ data: [{ id: 'i', name: 'Delver', set_name: 'Innistrad', collector_number: '51',
    card_faces: [{ image_uris: { small: 'f1' } }, { image_uris: { small: 'f2' } }], prices: { usd: '1.25' } }] });
  eq([c.image, c.price, c.number, c.setTotal], ['f1', 1.25, '51', null]);
});
test('Yu-Gi-Oh!: pega o primeiro set e converte o preço', () => {
  const [c] = yugioh.normalize({ data: [{ id: 46986414, name: 'Dark Magician', card_sets: [{ set_name: 'LOB', set_code: 'LOB-005' }],
    card_images: [{ image_url_small: 'u' }], card_prices: [{ tcgplayer_price: '2.50' }] }] });
  eq([c.set, c.number, c.price, c.sourceId], ['LOB', 'LOB-005', 2.5, '46986414']);
});
test('respostas vazias não quebram', () => {
  for (const p of [pokemon, scryfall, yugioh]) { eq(p.normalize({}), []); eq(p.normalize(null), []); }
});
test('Pokémon: junta as duas fontes sem repetir a mesma carta', () => {
  const main = [{ name: 'Turtwig', set: 'Temporal Forces', number: '10/162', image: 'a' }];
  const extra = [
    { name: 'Turtwig', set: 'Temporal Forces', number: '010/162', image: 'b' },      // mesma carta (zero à esquerda)
    { name: 'Turtwig', set: 'MEP Black Star Promos', number: '040', image: '' },    // só existe na segunda fonte
    { name: 'Turtwig', set: 'Diamond & Pearl', number: '10/130', image: 'c' },      // mesmo número, outro set
  ];
  const r = mergeResults(main, extra);
  eq(r.map(c => c.set), ['Temporal Forces', 'MEP Black Star Promos', 'Diamond & Pearl']);
  eq(r[0].image, 'a');   // a primeira fonte tem prioridade
});
test('Pokémon: sameCard tolera nome de set com prefixo e ignora acento', () => {
  ok(sameCard({ name: 'Pikachu', set: 'Ultra Prism', number: '60' }, { name: 'PIKACHU', set: 'Sun & Moon Ultra Prism', number: '060' }));
  ok(!sameCard({ name: 'Pikachu', set: 'A', number: '1' }, { name: 'Raichu', set: 'A', number: '1' }));
});
test('refineResults filtra por set ou número e ignora acento e caixa', () => {
  const list = [
    { name: 'Turtwig', set: 'MEP Black Star Promos', number: '040' },
    { name: 'Turtwig', set: 'Diamond & Pearl', number: '103' },
    { name: 'Turtwig', set: 'Platinum', number: '131' },
  ];
  eq(refineResults(list, ['040']).map(c => c.set), ['MEP Black Star Promos']);
  eq(refineResults(list, ['mep']).length, 1);
  eq(refineResults(list, ['PLATINUM']).map(c => c.number), ['131']);
  eq(refineResults(list, ['mep', '040']).length, 1);
});
test('refineResults devolve tudo quando nada combina', () => {
  const list = [{ name: 'A', set: 'S', number: '1' }, { name: 'B', set: 'T', number: '2' }];
  eq(refineResults(list, ['xyz']).length, 2);
  eq(refineResults(list, []).length, 2);
});
test('searchCards ignora buscas curtas e jogos sem provedor', async () => {
  eq(await searchCards('pokemon', 'a'), []);
  eq(await searchCards('other', 'charizard'), []);
  eq(hasSearch('other'), false);
  eq(hasSearch('magic'), true);
  ok(Object.keys(GAMES).includes('yugioh'));
});
