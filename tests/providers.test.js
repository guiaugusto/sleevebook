import { test, eq, ok } from './run.js';
import * as pokemon from '../src/js/providers/pokemon.js';
import * as scryfall from '../src/js/providers/scryfall.js';
import * as yugioh from '../src/js/providers/yugioh.js';
import { searchCards, hasSearch, GAMES } from '../src/js/providers/index.js';

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
test('searchCards ignora buscas curtas e jogos sem provedor', async () => {
  eq(await searchCards('pokemon', 'a'), []);
  eq(await searchCards('other', 'charizard'), []);
  eq(hasSearch('other'), false);
  eq(hasSearch('magic'), true);
  ok(Object.keys(GAMES).includes('yugioh'));
});
