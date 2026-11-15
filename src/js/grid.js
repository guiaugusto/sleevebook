// Regras puras do álbum: grade, páginas, folhas e chaves de slot.

export const MAX_GRID = 6;
export const MAX_PAGES = 500;
export const MAX_SHEETS = MAX_PAGES / 2;

/**
 * Tamanhos de fichário vendidos no mercado. "Folha" é a folha física de plástico, com bolsos dos dois lados
 * (frente e verso); a "página" do app é cada lado. Então um fichário de 9 bolsos com 20 folhas guarda
 * 9 × 2 × 20 = 360 cartas. Capacidades conferidas em fichários da Ultra PRO e no fichário oficial do Pokémon TCG
 * (9 bolsos, 20 folhas, 360 cartas; vendido no Brasil com folhas extras até 40) e em fichários de 12 bolsos
 * (20 folhas, 480 cartas) e de 4 bolsos (20 folhas, cerca de 160 cartas). Ver ADR 0006.
 */
export const BINDER_PRESETS = [
  { id: '4x20', pockets: 4, rows: 2, cols: 2, sheets: 20, note: 'compacto' },
  { id: '9x20', pockets: 9, rows: 3, cols: 3, sheets: 20, note: 'o mais comum; fichário oficial do Pokémon TCG' },
  { id: '9x40', pockets: 9, rows: 3, cols: 3, sheets: 40, note: 'com folhas extras (limite de muitos fichários)' },
  { id: '12x20', pockets: 12, rows: 4, cols: 3, sheets: 20, note: 'maior; bom para jogos de 4 cópias' },
];

/** Páginas (lados) de um fichário com `sheets` folhas. */
export const sheetsToPages = sheets => sheets * 2;
/** Folhas necessárias para `pages` páginas (arredonda para cima). */
export const pagesToSheets = pages => Math.ceil(pages / 2);
/** Quantas cartas cabem: bolsos por página × páginas. */
export const capacity = ({ rows, cols, pages }) => rows * cols * pages;

/** Texto curto de um preset: "9 bolsos (3×3) · 20 folhas · 360 cartas". */
export const presetLabel = p => `${p.pockets} bolsos (${p.cols}×${p.rows}) · ${p.sheets} folhas · ${capacity({ rows: p.rows, cols: p.cols, pages: sheetsToPages(p.sheets) })} cartas`;

export function clamp(value, min, max) {
  let v = parseInt(value, 10);
  if (Number.isNaN(v)) v = min;
  return Math.min(max, Math.max(min, v));
}

/** Aplica limites a rows/cols/pages vindos de formulário. */
export function sanitizeLayout({ rows, cols, pages }) {
  return { rows: clamp(rows, 1, MAX_GRID), cols: clamp(cols, 1, MAX_GRID), pages: clamp(pages, 1, MAX_PAGES) };
}

/** Igual a `sanitizeLayout`, mas recebendo FOLHAS (frente e verso) e devolvendo as páginas. */
export function sanitizeBinder({ rows, cols, sheets }) {
  return sanitizeLayout({ rows, cols, pages: sheetsToPages(clamp(sheets, 1, MAX_SHEETS)) });
}

/** Folhas de páginas: cada folha tem duas páginas (frente e verso). */
export const sheetCount = pages => Math.ceil(pages / 2);

/**
 * Folhas do livro inteiro: a capa (frente = capa de fora, verso = capa de dentro), as folhas de páginas e a
 * contracapa (frente = capa de dentro, verso = capa de fora). `spread` vai de 0 (fechado, mostrando a capa)
 * até `totalSheets` (fechado, mostrando a contracapa).
 */
export const totalSheets = pages => sheetCount(pages) + 2;

export const slotKey = (albumId, page, row, col) => `${albumId}:${page}:${row}:${col}`;

export function parseSlotKey(key) {
  const [albumId, page, row, col] = key.split(':');
  return { albumId, page: +page, row: +row, col: +col };
}

export const slotsPerPage = a => a.rows * a.cols;
export const totalSlots = a => a.rows * a.cols * a.pages;

/** O slot ainda cabe na grade atual do álbum? */
export const inGrid = (a, s) => s.page >= 1 && s.page <= a.pages && s.row >= 0 && s.row < a.rows && s.col >= 0 && s.col < a.cols;

/**
 * Páginas visíveis quando `spread` folhas já foram viradas. Spread 0 é o livro fechado (nenhuma página).
 * Spread 1 mostra a capa de dentro à esquerda e a página 1 à direita; depois, esquerda = 2·(spread−1) e
 * direita = 2·spread − 1. `null` = não há página (capa de dentro, capa de fora ou folha em branco).
 */
export function visiblePages(spread, pages) {
  const left = spread >= 2 && 2 * (spread - 1) <= pages ? 2 * (spread - 1) : null;
  const right = spread >= 1 && 2 * spread - 1 <= pages ? 2 * spread - 1 : null;
  return [left, right];
}

/** Quantas folhas precisam estar viradas para a página `p` ficar visível. */
export const spreadForPage = p => (p % 2 ? (p + 1) / 2 : p / 2 + 1);

/** Slots ({page,row,col}) que estão dentro da grade. */
export const slotsInGrid = (album, slots) => slots.filter(s => inGrid(album, s));

/** Contagem de cartas por página, apenas dentro da grade. */
export function countByPage(album, slots) {
  const out = {};
  for (const s of slotsInGrid(album, slots)) out[s.page] = (out[s.page] || 0) + 1;
  return out;
}

/** Primeiro slot livre do álbum (página, linha, coluna). `occupied` é um Set de chaves de slot. */
export function firstEmptySlot(album, occupied) {
  for (let page = 1; page <= album.pages; page++)
    for (let row = 0; row < album.rows; row++)
      for (let col = 0; col < album.cols; col++) {
        const key = slotKey(album.id, page, row, col);
        if (!occupied.has(key)) return { key, page, row, col };
      }
  return null;
}

/** Posição legível: "pág. 7 · linha 2, coluna 3" */
export const describeSlot = s => `pág. ${s.page} · linha ${s.row + 1}, coluna ${s.col + 1}`;
