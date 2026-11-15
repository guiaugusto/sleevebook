// Agregações da coleção: linhas da lista, filtros, ordenação, resumo e progresso por set.
// Uma carta pode estar "na coleção" (tenho) ou "desejada" (ainda não tenho). `owned === false` marca a desejada;
// cartas antigas, sem o campo, contam como "tenho".
import { inGrid, describeSlot } from './grid.js';

export const isOwned = card => card?.owned !== false;

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

/** `status`: '' (todas), 'owned' (tenho) ou 'wanted' (faltam). */
export function filterRows(rows, { q = '', albumId = '', condition = '', status = '' } = {}) {
  const terms = norm(q).split(/\s+/).filter(Boolean);
  return rows.filter(r => {
    if (albumId && r.album.id !== albumId) return false;
    if (condition && r.card.condition !== condition) return false;
    if (status === 'owned' && !isOwned(r.card)) return false;
    if (status === 'wanted' && isOwned(r.card)) return false;
    const hay = norm(`${r.card.name} ${r.card.set} ${r.card.number} ${r.card.notes}`);
    return terms.every(t => hay.includes(t));
  });
}

export const SORTS = {
  name: (a, b) => a.card.name.localeCompare(b.card.name, 'pt'),
  location: (a, b) => a.album.name.localeCompare(b.album.name, 'pt') || a.slot.page - b.slot.page || a.slot.row - b.slot.row || a.slot.col - b.slot.col,
  recent: (a, b) => (b.card.updatedAt ?? 0) - (a.card.updatedAt ?? 0),
};

export const sortRows = (rows, key = 'location') => [...rows].sort(SORTS[key] ?? SORTS.location);

/** "4/102" → "4". Compara só o número da carta dentro do set. */
const cardNumber = n => String(n ?? '').split('/')[0].trim().toLowerCase();

/** Progresso por set: cartas diferentes que você TEM / total do set (só sets com total conhecido). */
export function setProgress(rows) {
  const sets = new Map();
  for (const { card } of rows) {
    if (!card.set || !card.setTotal) continue;
    const key = `${card.source || ''}|${card.set}`;
    const s = sets.get(key) || { set: card.set, total: card.setTotal, numbers: new Set() };
    if (isOwned(card)) s.numbers.add(cardNumber(card.number) || card.name);
    sets.set(key, s);
  }
  return [...sets.values()]
    .filter(s => s.numbers.size > 0)
    .map(s => ({ set: s.set, owned: s.numbers.size, total: s.total, pct: Math.min(100, Math.round(s.numbers.size / s.total * 100)) }))
    .sort((a, b) => b.pct - a.pct || a.set.localeCompare(b.set, 'pt'));
}

/** Resumo: cartas que tenho, cartas que faltam, cópias que tenho, álbuns e progresso por set. */
export function summarize(rows, albums) {
  const owned = rows.filter(r => isOwned(r.card));
  return {
    owned: owned.length,
    wanted: rows.length - owned.length,
    copies: owned.reduce((n, r) => n + (r.card.qty || 1), 0),
    albums: albums.length,
    sets: setProgress(rows),
  };
}

/** Progresso de cada álbum: cartas que tenho / cartas escolhidas (tenho + faltam). */
export function albumProgress(albums, slots, cards) {
  const cardById = new Map(cards.map(c => [c.id, c]));
  return albums.map(a => {
    let owned = 0, chosen = 0;
    for (const s of slots) {
      if (s.albumId !== a.id || !inGrid(a, s)) continue;
      const card = cardById.get(s.cardId);
      if (!card) continue;
      chosen++;
      if (isOwned(card)) owned++;
    }
    return { album: a, owned, chosen, total: a.rows * a.cols * a.pages, pct: chosen ? Math.round(owned / chosen * 100) : 0 };
  });
}
