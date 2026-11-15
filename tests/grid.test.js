import { test, eq, ok } from './run.js';
import { sanitizeLayout, sanitizeBinder, sheetsToPages, pagesToSheets, capacity, presetLabel, BINDER_PRESETS, sheetCount, totalSheets, slotKey, parseSlotKey, inGrid, visiblePages, spreadForPage, countByPage, totalSlots, firstEmptySlot } from '../src/js/grid.js';

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
test('totalSheets conta a capa e a contracapa', () => {
  eq(totalSheets(20), 12); eq(totalSheets(15), 10); eq(totalSheets(1), 3);
});
test('visiblePages: fechado, capa de dentro + página 1, miolo e fim (páginas pares e ímpares)', () => {
  eq(visiblePages(0, 20), [null, null]);      // fechado, mostrando a capa
  eq(visiblePages(1, 20), [null, 1]);         // capa de dentro à esquerda, página 1 à direita
  eq(visiblePages(2, 20), [2, 3]);
  eq(visiblePages(10, 20), [18, 19]);
  eq(visiblePages(11, 20), [20, null]);       // última página + capa de dentro da contracapa
  eq(visiblePages(12, 20), [null, null]);     // fechado, mostrando a contracapa
  eq(visiblePages(8, 15), [14, 15]);
  eq(visiblePages(9, 15), [null, null]);      // folha em branco + capa de dentro da contracapa
});
test('spreadForPage leva à folha em que a página aparece', () => {
  eq(spreadForPage(1), 1); eq(spreadForPage(2), 2); eq(spreadForPage(3), 2); eq(spreadForPage(7), 4); eq(spreadForPage(8), 5);
  for (const total of [1, 2, 15, 20]) for (let p = 1; p <= total; p++) eq(visiblePages(spreadForPage(p), total).includes(p), true, `página ${p} de ${total}`);
});
test('countByPage ignora cartas fora da grade', () => {
  const a = { rows: 2, cols: 2, pages: 2 };
  eq(countByPage(a, [{ page: 1, row: 0, col: 0 }, { page: 1, row: 1, col: 1 }, { page: 2, row: 0, col: 0 }, { page: 1, row: 2, col: 0 }, { page: 3, row: 0, col: 0 }]), { 1: 2, 2: 1 });
});
test('firstEmptySlot acha o primeiro livre e devolve null com álbum cheio', () => {
  const a = { id: 'a', rows: 1, cols: 2, pages: 2 };
  eq(firstEmptySlot(a, new Set()).key, 'a:1:0:0');
  eq(firstEmptySlot(a, new Set(['a:1:0:0'])).key, 'a:1:0:1');
  eq(firstEmptySlot(a, new Set(['a:1:0:0', 'a:1:0:1'])).key, 'a:2:0:0');
  eq(firstEmptySlot(a, new Set(['a:1:0:0', 'a:1:0:1', 'a:2:0:0', 'a:2:0:1'])), null);
});
test('totalSlots', () => { eq(totalSlots({ rows: 3, cols: 3, pages: 20 }), 180); });

/* ---------- Folhas e fichários do mercado ---------- */
test('folhas ↔ páginas: cada folha tem frente e verso', () => {
  eq([sheetsToPages(20), pagesToSheets(40), pagesToSheets(15), pagesToSheets(1)], [40, 20, 8, 1]);
});
test('sanitizeBinder recebe folhas e devolve páginas, com limites', () => {
  eq(sanitizeBinder({ rows: 3, cols: 3, sheets: 20 }), { rows: 3, cols: 3, pages: 40 });
  eq(sanitizeBinder({ rows: 0, cols: 99, sheets: 9999 }), { rows: 1, cols: 6, pages: 500 });
  eq(sanitizeBinder({ rows: 2, cols: 2, sheets: '' }).pages, 2);
});
test('presets do mercado: capacidade = bolsos × 2 lados × folhas', () => {
  const cap = id => { const p = BINDER_PRESETS.find(x => x.id === id); return capacity({ rows: p.rows, cols: p.cols, pages: sheetsToPages(p.sheets) }); };
  eq([cap('4x20'), cap('9x20'), cap('9x40'), cap('12x20')], [160, 360, 720, 480]);
});
test('presets: bolsos batem com a grade e o rótulo mostra tudo', () => {
  for (const p of BINDER_PRESETS) eq(p.rows * p.cols, p.pockets, p.id);
  eq(presetLabel(BINDER_PRESETS.find(p => p.id === '9x20')), '9 bolsos (3×3) · 20 folhas · 360 cartas');
});

/* ---------- Medidas da capa (biblioteca) ---------- */
import { pageUnits, coverRatio, UNITS } from '../src/js/grid.js';

test('pageUnits: página = cartas + espaços + margem', () => {
  eq(pageUnits(3, 3), { W: 63 * 3 + 5 * 2 + 24, H: 88 * 3 + 5 * 2 + 24 });
  eq(pageUnits(1, 1), { W: 63 + 24, H: 88 + 24 });
});
test('coverRatio: capa dura = página + 10 na borda de fora e 10 em cima e embaixo', () => {
  const { W, H } = pageUnits(3, 3);
  ok(Math.abs(coverRatio(3, 3) - (W + UNITS.HARD) / (H + 2 * UNITS.HARD)) < 1e-9);
  ok(coverRatio(2, 3) > coverRatio(3, 3), 'menos linhas → capa mais larga que alta');
});
