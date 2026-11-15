import { test, eq, ok } from './run.js';
import { buildRows, filterRows, sortRows, setProgress, summarize, albumProgress, isOwned } from '../src/js/stats.js';

const A = { id: 'a', name: 'Pokémon', rows: 3, cols: 3, pages: 2 };
const B = { id: 'b', name: 'Magic', rows: 2, cols: 2, pages: 1 };
const cards = [
  { id: 'c1', name: 'Charizard', set: 'Base Set', setTotal: 102, number: '4/102', qty: 1, condition: 'NM (Near Mint)', source: 'pokemon' },
  { id: 'c2', name: 'Blastoise', set: 'Base Set', setTotal: 102, number: '2/102', qty: 2, condition: 'LP (Lightly Played)', source: 'pokemon', owned: true },
  { id: 'c3', name: 'Pikaçhu', set: 'Jungle', setTotal: 64, number: '60/64', qty: 1, condition: 'NM (Near Mint)', source: 'pokemon', owned: false },
  { id: 'c4', name: 'Lightning Bolt', set: 'Alpha', qty: 1, condition: 'NM (Near Mint)', source: 'magic' },
  { id: 'c5', name: 'Fora', set: 'X', qty: 1, condition: 'NM (Near Mint)' },
  { id: 'c6', name: 'Venusaur', set: 'Base Set', setTotal: 102, number: '15/102', qty: 1, source: 'pokemon', owned: false },
];
const slots = [
  { key: 'a:1:0:0', albumId: 'a', page: 1, row: 0, col: 0, cardId: 'c1' },
  { key: 'a:1:0:1', albumId: 'a', page: 1, row: 0, col: 1, cardId: 'c2' },
  { key: 'a:2:2:2', albumId: 'a', page: 2, row: 2, col: 2, cardId: 'c3' },
  { key: 'b:1:0:0', albumId: 'b', page: 1, row: 0, col: 0, cardId: 'c4' },
  { key: 'b:1:5:5', albumId: 'b', page: 1, row: 5, col: 5, cardId: 'c5' },   // fora da grade
  { key: 'a:2:0:0', albumId: 'a', page: 2, row: 0, col: 0, cardId: 'c6' },
];
const rows = buildRows([A, B], slots, cards);

test('isOwned: sem o campo (cartas antigas) conta como "tenho"; só owned=false é "falta"', () => {
  eq([isOwned({}), isOwned({ owned: true }), isOwned({ owned: false }), isOwned(undefined)], [true, true, false, true]);
});
test('buildRows ignora cartas fora da grade e slots órfãos', () => {
  eq(rows.length, 5);
  eq(buildRows([A], [{ key: 'x', albumId: 'zzz', page: 1, row: 0, col: 0, cardId: 'c1' }], cards).length, 0);
});
test('localização legível', () => {
  eq(rows[0].location, 'Pokémon · pág. 1 · linha 1, coluna 1');
});
test('filterRows busca ignorando acento e caixa', () => {
  eq(filterRows(rows, { q: 'PIKACHU' }).map(r => r.card.id), ['c3']);
  eq(filterRows(rows, { q: 'base set' }).length, 3);
  eq(filterRows(rows, { q: '4/102' }).map(r => r.card.id), ['c1']);
});
test('filterRows por álbum e condição', () => {
  eq(filterRows(rows, { albumId: 'b' }).length, 1);
  eq(filterRows(rows, { condition: 'LP (Lightly Played)' }).map(r => r.card.id), ['c2']);
});
test('filterRows por situação: tenho e faltam', () => {
  eq(filterRows(rows, { status: 'owned' }).map(r => r.card.id).sort(), ['c1', 'c2', 'c4']);
  eq(filterRows(rows, { status: 'wanted' }).map(r => r.card.id).sort(), ['c3', 'c6']);
  eq(filterRows(rows, { status: '' }).length, 5);
});
test('sortRows por nome', () => {
  eq(sortRows(rows, 'name').map(r => r.card.id), ['c2', 'c1', 'c4', 'c3', 'c6']);
});
test('sortRows por localização segue álbum, página, linha e coluna', () => {
  eq(sortRows(rows, 'location').map(r => r.card.id), ['c4', 'c1', 'c2', 'c6', 'c3']);
});
test('summarize: tenho, faltam, cópias que tenho e álbuns (sem valores)', () => {
  const s = summarize(rows, [A, B]);
  eq([s.owned, s.wanted, s.copies, s.albums], [3, 2, 4, 2]);
  ok(!('value' in s) && !('unpriced' in s), 'o resumo não traz mais valores');
});
test('setProgress conta só as cartas que tenho e ignora sets sem total', () => {
  const p = setProgress(rows);
  eq(p.map(x => [x.set, x.owned, x.total, x.pct]), [['Base Set', 2, 102, 2]]);   // Jungle só tem carta que falta
});
test('setProgress não conta a mesma carta duas vezes', () => {
  const dup = [rows[0], { ...rows[0], card: { ...rows[0].card, id: 'dup' } }];
  eq(setProgress(dup)[0].owned, 1);
});
test('albumProgress: tenho / escolhidas por álbum', () => {
  const p = albumProgress([A, B], slots, cards);
  eq(p.map(x => [x.owned, x.chosen, x.pct]), [[2, 4, 50], [1, 1, 100]]);
});
