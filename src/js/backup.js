// Validação do conteúdo de um backup importado (ADR 0010). `validateExport` (store.js) só confere a estrutura do
// arquivo; aqui cada registro é limpo e limitado, como já é feito com links de compartilhamento. Um backup pode vir
// de qualquer pessoa, então nada dele é confiado: campos desconhecidos são descartados, textos e números são
// limitados, ids e endereços de imagem precisam ter formato válido e registros quebrados são ignorados (e contados).
import { CONDITIONS } from './cardform.js';
import { DEFAULT_COLOR } from './color.js';
import { sanitizeLayout, MAX_PAGES, MAX_GRID } from './grid.js';
import { GAMES } from './providers/index.js';
import { text } from './share.js';

export const BACKUP_LIMITS = { albums: 500, cards: 100_000, slots: 100_000, wishlist: 20_000, fileBytes: 60 * 1024 * 1024 };
const FOILS = ['holo', 'reverse', 'none'];
const ID = /^[\w-]{1,80}$/;
const DATA_IMAGE = /^data:image\/(?:jpeg|png|webp|gif);base64,[A-Za-z0-9+/=]+$/;

const num = (v, fallback) => (Number.isFinite(v) ? v : fallback);
const posInt = (v, max) => (Number.isFinite(v) && v >= 1 ? Math.min(max, Math.trunc(v)) : null);

/**
 * Imagem de um backup: foto enviada (data:image/…;base64) ou endereço http(s). Diferente do link de compartilhamento,
 * qualquer site é aceito, porque o usuário pode ter digitado o endereço de uma imagem em qualquer lugar; `javascript:`,
 * `data:text/html` e outros esquemas são descartados.
 */
export function backupImage(v) {
  if (typeof v !== 'string' || !v) return '';
  if (v.startsWith('data:')) return v.length <= 2_000_000 && DATA_IMAGE.test(v) ? v : '';
  if (v.length > 2000) return '';
  try { const u = new URL(v); return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : ''; } catch { return ''; }
}

const game = v => (typeof v === 'string' && Object.hasOwn(GAMES, v) ? v : 'pokemon');
const source = v => (v === 'manual' || (typeof v === 'string' && Object.hasOwn(GAMES, v)) ? v : 'manual');
const sourceId = v => (typeof v === 'string' && /^[\w.\-]{1,60}$/.test(v) ? v : null);

function album(a, now) {
  if (!a || typeof a.id !== 'string' || !ID.test(a.id)) return null;
  return {
    id: a.id, name: text(a.name, 60) || 'Álbum', game: game(a.game),
    ...sanitizeLayout({ rows: a.rows, cols: a.cols, pages: a.pages }),
    color: typeof a.color === 'string' && /^#[0-9a-f]{6}$/i.test(a.color) ? a.color.toLowerCase() : DEFAULT_COLOR,
    createdAt: num(a.createdAt, now),
  };
}

function card(c, now) {
  if (!c || typeof c.id !== 'string' || !ID.test(c.id)) return null;
  const out = {
    id: c.id, name: text(c.name, 100) || 'Carta sem nome', set: text(c.set, 80), number: text(String(c.number ?? ''), 20),
    setTotal: posInt(c.setTotal, 100_000), image: backupImage(c.image), source: source(c.source), sourceId: sourceId(c.sourceId),
    condition: CONDITIONS.includes(c.condition) ? c.condition : CONDITIONS[1], qty: posInt(c.qty, 9999) ?? 1,
    notes: text(c.notes, 500), owned: c.owned !== false, updatedAt: num(c.updatedAt, now),
  };
  if (typeof c.language === 'string' && /^[a-z]{2,3}(-[a-z]{2,4})?$/i.test(c.language)) out.language = c.language;
  if (FOILS.includes(c.foil)) out.foil = c.foil;
  if (c.imageFallback === 'en') out.imageFallback = 'en';
  if (Number.isFinite(c.price) && c.price >= 0) out.price = c.price;       // campo antigo, sem uso na interface
  return out;
}

function wish(w) {
  if (!w || typeof w.id !== 'string' || !ID.test(w.id)) return null;
  return {
    id: w.id, name: text(w.name, 100) || 'Carta sem nome', set: text(w.set, 80), number: text(String(w.number ?? ''), 20),
    image: backupImage(w.image), priority: [1, 2, 3].includes(w.priority) ? w.priority : 2, notes: text(w.notes, 300),
    setTotal: posInt(w.setTotal, 100_000), source: source(w.source), sourceId: sourceId(w.sourceId),
  };
}

/**
 * Limpa o backup inteiro. Devolve `{ data, report }`: `data` tem o mesmo formato de `exportAll()` e `report` conta
 * quantos registros foram ignorados por estarem inválidos. A estrutura (listas) deve ter passado em `validateExport`.
 */
export function sanitizeBackup(raw, { now = Date.now() } = {}) {
  const list = (v, max) => (Array.isArray(v) ? v.slice(0, max) : []);
  const report = { albums: 0, cards: 0, slots: 0, wishlist: 0 };
  const take = (items, fn, kind, max) => {
    const kept = list(items, max).map(x => fn(x, now)).filter(Boolean);
    report[kind] = (Array.isArray(items) ? items.length : 0) - kept.length;      // inválidos e o que passou do limite
    return kept;
  };

  const albums = take(raw.albums, album, 'albums', BACKUP_LIMITS.albums);
  const albumById = new Map(albums.map(a => [a.id, a]));
  const cards = take(raw.cards, card, 'cards', BACKUP_LIMITS.cards);
  const cardIds = new Set(cards.map(c => c.id));
  const wishlist = take(raw.wishlist, wish, 'wishlist', BACKUP_LIMITS.wishlist);

  // Slots: a chave é refeita a partir dos números, e o slot precisa apontar para um álbum e uma carta do backup.
  const seen = new Set();
  const slots = take(raw.slots, s => {
    if (!s || typeof s.albumId !== 'string' || typeof s.cardId !== 'string') return null;
    const al = albumById.get(s.albumId), page = s.page;
    if (!al || !cardIds.has(s.cardId) || !Number.isInteger(page) || page < 1 || page > MAX_PAGES || !Number.isInteger(s.row) || !Number.isInteger(s.col)) return null;
    if (s.row < 0 || s.col < 0 || s.row >= MAX_GRID || s.col >= MAX_GRID) return null;
    const key = `${s.albumId}:${page}:${s.row}:${s.col}`;
    if (seen.has(key)) return null;
    seen.add(key);
    return { key, albumId: s.albumId, page, row: s.row, col: s.col, cardId: s.cardId };
  }, 'slots', BACKUP_LIMITS.slots);

  const ignored = report.albums + report.cards + report.slots + report.wishlist;
  return { data: { app: raw.app, version: raw.version, exportedAt: text(raw.exportedAt, 40), albums, cards, slots, wishlist }, report, ignored };
}
