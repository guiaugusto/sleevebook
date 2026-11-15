import { test, eq, ok } from './run.js';
import { buildRows, filterRows, sortRows, setProgress, summarize, albumProgress, rowValue, money } from '../src/js/stats.js';

const A = { id: 'a', name: 'Pokémon', rows: 3, cols: 3, pages: 2 };
const B = { id: 'b', name: 'Magic', rows: 2, cols: 2, pages: 1 };
const cards = [
  { id: 'c1', name: 'Charizard', set: 'Base Set', setTotal: 102, number: '4/102', qty: 1, price: 350, condition: 'NM (Near Mint)', source: 'pokemon' },
  { id: 'c2', name: 'Blastoise', set: 'Base Set', setTotal: 102, number: '2/102', qty: 2, price: 40, condition: 'LP (Lightly Played)', source: 'pokemon' },
  { id: 'c3', name: 'Pikaçhu', set: 'Jungle', setTotal: 64, number: '60/64', qty: 1, price: null, condition: 'NM (Near Mint)', source: 'pokemon' },
  { id: 'c4', name: 'Lightning Bolt', set: 'Alpha', qty: 1, price: 10, condition: 'NM (Near Mint)', source: 'magic' },
  { id: 'c5', name: 'Fora', set: 'X', qty: 1, price: 999, condition: 'NM (Near Mint)' },
];
const slots = [
  { key: 'a:1:0:0', albumId: 'a', page: 1, row: 0, col: 0, cardId: 'c1' },
  { key: 'a:1:0:1', albumId: 'a', page: 1, row: 0, col: 1, cardId: 'c2' },
  { key: 'a:2:2:2', albumId: 'a', page: 2, row: 2, col: 2, cardId: 'c3' },
  { key: 'b:1:0:0', albumId: 'b', page: 1, row: 0, col: 0, cardId: 'c4' },
  { key: 'b:1:5:5', albumId: 'b', page: 1, row: 5, col: 5, cardId: 'c5' },   // fora da grade
];
const rows = buildRows([A, B], slots, cards);

test('buildRows ignora cartas fora da grade e slots órfãos', () => {
  eq(rows.length, 4);
  eq(buildRows([A], [{ key: 'x', albumId: 'zzz', page: 1, row: 0, col: 0, cardId: 'c1' }], cards).length, 0);
});
test('localização legível', () => {
  eq(rows[0].location, 'Pokémon · pág. 1 · linha 1, coluna 1');
});
test('filterRows busca ignorando acento e caixa', () => {
  eq(filterRows(rows, { q: 'PIKACHU' }).map(r => r.card.id), ['c3']);
  eq(filterRows(rows, { q: 'base set' }).length, 2);
  eq(filterRows(rows, { q: '4/102' }).map(r => r.card.id), ['c1']);
});
test('filterRows por álbum e condição', () => {
  eq(filterRows(rows, { albumId: 'b' }).length, 1);
  eq(filterRows(rows, { condition: 'LP (Lightly Played)' }).map(r => r.card.id), ['c2']);
});
test('sortRows por valor total (preço × quantidade) e por nome', () => {
  eq(sortRows(rows, 'value').map(r => r.card.id), ['c1', 'c2', 'c4', 'c3']);
  eq(sortRows(rows, 'name').map(r => r.card.id), ['c2', 'c1', 'c4', 'c3']);
});
test('sortRows por localização segue álbum, página, linha e coluna', () => {
  eq(sortRows(rows, 'location').map(r => r.card.id), ['c4', 'c1', 'c2', 'c3']);
});
test('rowValue sem preço é zero', () => {
  eq(rowValue({ card: { price: null, qty: 3 } }), 0);
  eq(rowValue({ card: { price: 2.5, qty: 2 } }), 5);
});
test('summarize: totais, valor e cartas sem preço', () => {
  const s = summarize(rows, [A, B]);
  eq([s.cards, s.copies, s.albums, s.value, s.unpriced], [4, 5, 2, 350 + 80 + 10, 1]);
});
test('setProgress conta números diferentes e ignora sets sem total', () => {
  const p = setProgress(rows);
  eq(p.map(x => [x.set, x.owned, x.total, x.pct]), [['Base Set', 2, 102, 2], ['Jungle', 1, 64, 2]]);
});
test('setProgress não conta a mesma carta duas vezes', () => {
  const dup = [rows[0], { ...rows[0], card: { ...rows[0].card, id: 'dup' } }];
  eq(setProgress(dup)[0].owned, 1);
});
test('albumProgress', () => {
  const p = albumProgress([A, B], slots);
  eq(p.map(x => [x.filled, x.total, x.pct]), [[3, 18, 17], [1, 4, 25]]);
});
test('money formata em dólares com vírgula decimal', () => {
  ok(money(1234.5).includes('1.234,50'), money(1234.5));
});
