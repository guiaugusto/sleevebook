// Compartilhar um álbum por link (ADR 0008). O álbum vira um JSON compacto, é comprimido e codificado em base64url
// no fragmento da URL (`#compartilhar=...`). O fragmento nunca é enviado a servidores, então não precisa de backend.
// O que chega por link é dado de terceiros: tudo é validado, limitado e recebe ids novos antes de ir para o banco.
import { CONDITIONS } from './cardform.js';
import { DEFAULT_COLOR } from './color.js';
import { sanitizeLayout, inGrid } from './grid.js';
import { GAMES } from './providers/index.js';
import { uid } from './util.js';

export const SHARE_VERSION = 1;
export const SHARE_PREFIX = '#compartilhar=';
/** Acima disso o link pode ser cortado por apps de mensagem; a tela avisa e sugere o arquivo de backup. */
export const SAFE_LINK_LENGTH = 8000;
const MAX_JSON_BYTES = 2_000_000;          // limite do JSON já descomprimido (protege contra "bomba de compressão")
const MAX_LINK_LENGTH = 1_500_000;
const MAX_CARDS = 20000;

const IMAGE_HOSTS = ['assets.tcgdex.net', 'images.scrydex.com', 'images.pokemontcg.io', 'cards.scryfall.io', 'images.ygoprodeck.com'];
const FOILS = ['holo', 'reverse', 'none'];

/* ---------- Texto e imagem confiáveis ---------- */
const text = (v, max) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max) : '');

/** Só aceita imagens https dos provedores que o app já usa. Qualquer outra coisa (data:, javascript:, outros hosts) é descartada. */
export function safeImage(url) {
  if (typeof url !== 'string' || url.length > 300) return '';
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && IMAGE_HOSTS.includes(u.hostname) ? u.href : '';
  } catch { return ''; }
}

/* ---------- Álbum <-> payload compacto ---------- */
// Cada carta é uma lista: [página, linha, coluna, nome, set, número, total do set, fonte, sourceId, idioma,
//                          sinalizadores, quantidade, condição, foil, notas, imagem]
// sinalizadores: bit 1 = "tenho" (ausente = quero), bit 2 = imagem em inglês no lugar do idioma da carta.
// Campos vazios no fim da lista são cortados. Fotos enviadas pelo usuário (data:) não entram: são pesadas.

/** Monta o payload de um álbum. `includeNotes` é opcional: notas podem ser pessoais. */
export function buildPayload(album, slots, cards, { includeNotes = false } = {}) {
  const byId = new Map(cards.map(c => [c.id, c]));
  const rows = [];
  for (const s of slots) {
    const c = byId.get(s.cardId);
    if (!c || !inGrid(album, s)) continue;
    const flags = (c.owned === false ? 0 : 1) | (c.imageFallback === 'en' ? 2 : 0);
    const cond = CONDITIONS.indexOf(c.condition);      // vazio = "NM", a condição padrão (índice 1)
    const row = [s.page, s.row, s.col, c.name || '', c.set || '', c.number || '', c.setTotal ?? '', c.source || '', c.sourceId || '', c.language || '',
      flags, c.qty > 1 ? c.qty : '', cond < 0 || cond === 1 ? '' : cond, c.foil || '', includeNotes ? (c.notes || '') : '', safeImage(c.image)];
    while (row.length > 3 && row[row.length - 1] === '') row.pop();
    rows.push(row);
  }
  return { v: SHARE_VERSION, a: { n: album.name, g: album.game, r: album.rows, c: album.cols, p: album.pages, k: album.color }, s: rows };
}

/**
 * Transforma o payload recebido em registros prontos para o banco ({album, cards, slots}), com ids novos.
 * Lança Error (em português) se o payload não servir. Nada vindo do link é confiado.
 */
export function parsePayload(p, { newId = uid, now = Date.now() } = {}) {
  if (!p || typeof p !== 'object' || !p.a || !Array.isArray(p.s)) throw new Error('Este link não contém um álbum do Sleevebook.');
  if (!(p.v >= 1)) throw new Error('Este link não contém um álbum do Sleevebook.');
  if (p.v > SHARE_VERSION) throw new Error('Este link é de uma versão mais nova do Sleevebook. Recarregue a página e tente de novo.');
  if (p.s.length > MAX_CARDS) throw new Error('O álbum do link tem cartas demais.');

  const a = p.a;
  const layout = sanitizeLayout({ rows: a.r, cols: a.c, pages: a.p });
  const album = {
    id: newId(), name: text(a.n, 60) || 'Álbum compartilhado', game: Object.hasOwn(GAMES, a.g) ? a.g : 'pokemon', ...layout,
    color: /^#[0-9a-f]{6}$/i.test(a.k) ? a.k.toLowerCase() : DEFAULT_COLOR, createdAt: now,
  };
  const cards = [], slots = [], used = new Set();
  for (const r of p.s) {
    if (!Array.isArray(r)) continue;
    const [page, row, col, name, set, number, setTotal, source, sourceId, language, flags, qty, cond, foil, notes, image] = r;
    const pos = { page: Math.trunc(page), row: Math.trunc(row), col: Math.trunc(col) };
    if (!Number.isFinite(pos.page + pos.row + pos.col) || !inGrid(album, pos)) continue;
    const key = `${album.id}:${pos.page}:${pos.row}:${pos.col}`;
    if (used.has(key)) continue;
    const cardName = text(name, 100);
    if (!cardName) continue;
    used.add(key);
    const f = Number.isInteger(flags) ? flags : 1;
    const card = {
      id: newId(), name: cardName, set: text(set, 80), number: text(String(number ?? ''), 20),
      setTotal: Number.isFinite(setTotal) && setTotal > 0 ? Math.trunc(setTotal) : null,
      source: source === 'manual' || Object.hasOwn(GAMES, source) ? source : 'manual',
      sourceId: /^[\w.\-]{1,60}$/.test(sourceId) ? sourceId : null,
      language: /^[a-z]{2,3}(-[a-z]{2,4})?$/i.test(language) ? language : undefined,
      condition: CONDITIONS[Number.isInteger(cond) && cond >= 0 && cond < CONDITIONS.length ? cond : 1],
      qty: Number.isFinite(qty) && qty > 1 ? Math.min(9999, Math.trunc(qty)) : 1,
      owned: !!(f & 1), notes: text(notes, 500), image: safeImage(image), updatedAt: now,
    };
    if (FOILS.includes(foil)) card.foil = foil;
    if (f & 2 && card.image) card.imageFallback = 'en';
    if (card.language === undefined) delete card.language;
    cards.push(card);
    slots.push({ key, albumId: album.id, page: pos.page, row: pos.row, col: pos.col, cardId: card.id });
  }
  return { album, cards, slots };
}

/* ---------- Compressão e base64url ---------- */
const toB64u = bytes => {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const fromB64u = s => {
  if (!/^[A-Za-z0-9_-]*$/.test(s)) throw new Error('bad');
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(bin, ch => ch.charCodeAt(0));
};

async function pipe(bytes, stream, limit = Infinity) {
  const reader = new Blob([bytes]).stream().pipeThrough(stream).getReader();
  const parts = []; let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > limit) { await reader.cancel(); throw new Error('big'); }
    parts.push(value);
  }
  const out = new Uint8Array(size); let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
}

/** payload → texto base64url comprimido. */
export async function encodePayload(payload) {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  return toB64u(await pipe(bytes, new CompressionStream('deflate-raw')));
}

/** texto base64url → payload. Lança Error amigável para links cortados, corrompidos ou grandes demais. */
export async function decodePayload(str) {
  try {
    if (str.length > MAX_LINK_LENGTH) throw new Error('big');
    const bytes = await pipe(fromB64u(str), new DecompressionStream('deflate-raw'), MAX_JSON_BYTES);
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new Error('Não foi possível ler este link. Ele pode ter sido cortado ao ser enviado; peça para gerar de novo ou use o arquivo de backup.');
  }
}

/* ---------- Links ---------- */
export async function buildShareLink(base, album, slots, cards, opts) {
  return `${base}${SHARE_PREFIX}${await encodePayload(buildPayload(album, slots, cards, opts))}`;
}

/** Devolve o texto codificado se o hash for de compartilhamento, senão null. */
export const shareFromHash = hash => (typeof hash === 'string' && hash.startsWith(SHARE_PREFIX) ? hash.slice(SHARE_PREFIX.length) : null);

/** hash → registros prontos para importar. */
export async function readShareLink(hash, opts) {
  const code = shareFromHash(hash);
  if (code == null) throw new Error('Este não é um link de álbum do Sleevebook.');
  return parsePayload(await decodePayload(code), opts);
}
