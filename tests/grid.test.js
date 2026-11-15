import { test, eq } from './run.js';
import { sanitizeLayout, sheetCount, slotKey, parseSlotKey, inGrid, visiblePages, spreadForPage, countByPage, totalSlots } from '../src/js/grid.js';

test('sanitizeLayout limita grade e páginas', () => {
  eq(sanitizeLayout({ rows: 0, cols: 99, pages: '' }), { rows: 1, cols: 6, pages: 1 });
  eq(sanitizeLayout({ rows: '3', cols: '3', pages: '20' }), { rows: 3, cols: 3, pages: 20 });
  eq(sanitizeLayout({ rows: 2, cols: 2, pages: 9999 }).pages, 500);
});
test('sheetCount arredonda para cima', () => {
  eq(sheetCount(20), 10); eq(sheetCount(21), 11); eq(sheetCount(1), 1);
});
test('chave de slot faz ida e volta', () => {
  eq(parseSlotKey(slotKey('abc', 7, 2, 1)), { albumId: 'abc', page: 7, row: 2, col: 1 });
});
test('inGrid respeita limites', () => {
  const a = { rows: 3, cols: 3, pages: 20 };
  eq(inGrid(a, { page: 1, row: 0, col: 0 }), true);
  eq(inGrid(a, { page: 20, row: 2, col: 2 }), true);
  eq(inGrid(a, { page: 21, row: 0, col: 0 }), false);
  eq(inGrid(a, { page: 1, row: 3, col: 0 }), false);
  eq(inGrid(a, { page: 0, row: 0, col: 0 }), false);
});
test('visiblePages: capa, miolo e fim com número par e ímpar de páginas', () => {
  eq(visiblePages(0, 20), [null, 1]);
  eq(visiblePages(1, 20), [2, 3]);
  eq(visiblePages(10, 20), [20, null]);
  eq(visiblePages(2, 3), [null, null]);
  eq(visiblePages(1, 3), [2, 3]);
});
test('spreadForPage leva à folha em que a página aparece', () => {
  eq(spreadForPage(1), 0); eq(spreadForPage(2), 1); eq(spreadForPage(3), 1); eq(spreadForPage(7), 3); eq(spreadForPage(8), 4);
  for (let p = 1; p <= 20; p++) eq(visiblePages(spreadForPage(p), 20).includes(p), true, `página ${p}`);
});
test('countByPage ignora cartas fora da grade', () => {
  const a = { rows: 2, cols: 2, pages: 2 };
  eq(countByPage(a, [{ page: 1, row: 0, col: 0 }, { page: 1, row: 1, col: 1 }, { page: 2, row: 0, col: 0 }, { page: 1, row: 2, col: 0 }, { page: 3, row: 0, col: 0 }]), { 1: 2, 2: 1 });
});
test('totalSlots', () => { eq(totalSlots({ rows: 3, cols: 3, pages: 20 }), 180); });
