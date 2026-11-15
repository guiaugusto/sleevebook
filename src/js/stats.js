// Agregações da coleção: linhas da lista, filtros, ordenação, resumo e progresso por set.
import { inGrid, describeSlot } from './grid.js';

/** Uma linha por carta cadastrada, com o álbum e a posição dela. Só inclui cartas dentro da grade atual. */
export function buildRows(albums, slots, cards) {
  const albumById = new Map(albums.map(a => [a.id, a]));
  const cardById = new Map(cards.map(c => [c.id, c]));
  const rows = [];
  for (const slot of slots) {
    const album = albumById.get(slot.albumId), card = cardById.get(slot.cardId);
    if (!album || !card || !inGrid(album, slot)) continue;
    rows.push({ card, album, slot, location: `${album.name} · ${describeSlot(slot)}` });
  }
  return rows;
}

const norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function filterRows(rows, { q = '', albumId = '', condition = '' } = {}) {
  const terms = norm(q).split(/\s+/).filter(Boolean);
  return rows.filter(r => {
    if (albumId && r.album.id !== albumId) return false;
    if (condition && r.card.condition !== condition) return false;
    const hay = norm(`${r.card.name} ${r.card.set} ${r.card.number} ${r.card.notes}`);
    return terms.every(t => hay.includes(t));
  });
}

export const SORTS = {
  name: (a, b) => a.card.name.localeCompare(b.card.name, 'pt'),
  value: (a, b) => (b.card.price ?? -1) * b.card.qty - (a.card.price ?? -1) * a.card.qty,
  location: (a, b) => a.album.name.localeCompare(b.album.name, 'pt') || a.slot.page - b.slot.page || a.slot.row - b.slot.row || a.slot.col - b.slot.col,
  recent: (a, b) => (b.card.updatedAt ?? 0) - (a.card.updatedAt ?? 0),
};

export const sortRows = (rows, key = 'location') => [...rows].sort(SORTS[key] ?? SORTS.location);

/** Valor de uma linha: preço × quantidade (0 se não houver preço). */
export const rowValue = r => (typeof r.card.price === 'number' ? r.card.price * (r.card.qty || 1) : 0);

/** "4/102" → "4". Compara só o número da carta dentro do set. */
const cardNumber = n => String(n ?? '').split('/')[0].trim().toLowerCase();

/** Progresso por set: cartas diferentes que você tem / total do set (só sets com total conhecido). */
export function setProgress(rows) {
  const sets = new Map();
  for (const { card } of rows) {
    if (!card.set || !card.setTotal) continue;
    const key = `${card.source || ''}|${card.set}`;
    const s = sets.get(key) || { set: card.set, total: card.setTotal, numbers: new Set() };
    s.numbers.add(cardNumber(card.number) || card.name);
    sets.set(key, s);
  }
  return [...sets.values()]
    .map(s => ({ set: s.set, owned: s.numbers.size, total: s.total, pct: Math.min(100, Math.round(s.numbers.size / s.total * 100)) }))
    .sort((a, b) => b.pct - a.pct || a.set.localeCompare(b.set, 'pt'));
}

export function summarize(rows, albums) {
  const priced = rows.filter(r => typeof r.card.price === 'number');
  return {
    cards: rows.length,
    copies: rows.reduce((n, r) => n + (r.card.qty || 1), 0),
    albums: albums.length,
    value: rows.reduce((n, r) => n + rowValue(r), 0),
    unpriced: rows.length - priced.length,
    sets: setProgress(rows),
  };
}

/** Progresso de cada álbum: slots preenchidos / total. */
export function albumProgress(albums, slots) {
  return albums.map(a => {
    const filled = slots.filter(s => s.albumId === a.id && inGrid(a, s)).length;
    const total = a.rows * a.cols * a.pages;
    return { album: a, filled, total, pct: total ? Math.round(filled / total * 100) : 0 };
  });
}

export const money = v => `US$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
