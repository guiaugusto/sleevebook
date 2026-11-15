// TCGdex (https://tcgdex.dev): catálogo Pokémon aberto, sem chave, com CORS liberado, vários idiomas
// e filtros por campo (set, raridade, ilustrador…). É a fonte principal da busca de Pokémon (ADR 0004).
const API = 'https://api.tcgdex.net/v2';

export const LANGUAGES = { en: 'Inglês', pt: 'Português' };
export const PAGE_SIZE = 30;

/** Carta detalhada do TCGdex → formato do app. */
export function normalizeTcgdex(card) {
  const tp = card.pricing?.tcgplayer || {};
  let price = null;
  for (const kind of Object.keys(tp)) {
    const v = tp[kind];
    if (v && typeof v === 'object' && typeof v.marketPrice === 'number') { price = v.marketPrice; break; }
  }
  const total = card.set?.cardCount?.official || null;
  return {
    name: card.name,
    set: card.set?.name ?? '',
    setTotal: total,
    number: total ? `${card.localId}/${total}` : String(card.localId ?? ''),
    image: card.image ? `${card.image}/low.webp` : '',
    price,
    rarity: card.rarity ?? '',
    illustrator: card.illustrator ?? '',
    source: 'pokemon',
    sourceId: card.id,
  };
}

/** Filtros preenchidos? ({ setId, rarity, illustrator }) */
export const hasFilters = f => !!(f && (f.setId || f.rarity || f.illustrator));

/** Monta a consulta da lista de cartas: nome (contém) + filtros exatos + paginação. */
export function buildParams({ query = '', filters = {}, page = 1 } = {}) {
  const p = new URLSearchParams();
  if (query.trim()) p.set('name', query.trim());
  if (filters.setId) p.set('set.id', `eq:${filters.setId}`);
  if (filters.rarity) p.set('rarity', `eq:${filters.rarity}`);
  if (filters.illustrator) p.set('illustrator', `eq:${filters.illustrator}`);
  p.set('pagination:page', String(page));
  p.set('pagination:itemsPerPage', String(PAGE_SIZE));
  return p;
}

async function getJson(url, signal) {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`TCGdex respondeu ${res.status}`);
  return res.json();
}

/** Busca cartas (lista + detalhes de cada uma, para ter set, preço e raridade). */
export async function search(query, { signal, filters = {}, page = 1, lang = 'en' } = {}) {
  const base = `${API}/${lang}/cards`;
  const list = await getJson(`${base}?${buildParams({ query, filters, page })}`, signal);
  const details = await Promise.all(list.map(async c => {
    try { return await getJson(`${base}/${encodeURIComponent(c.id)}`, signal); }
    catch (e) { if (e.name === 'AbortError') throw e; return c; }   // sem detalhes: usa o resumo da lista
  }));
  return details.map(normalizeTcgdex);
}

/* ---------- Opções dos filtros (carregadas uma vez por idioma) ---------- */
const cache = new Map();
const once = (key, load) => { if (!cache.has(key)) cache.set(key, load().catch(e => { cache.delete(key); throw e; })); return cache.get(key); };

export const listSets = (lang = 'en') => once(`sets:${lang}`, async () =>
  (await getJson(`${API}/${lang}/sets`)).map(s => ({ id: s.id, name: s.name, total: s.cardCount?.total ?? 0 })));

export const listRarities = (lang = 'en') => once(`rar:${lang}`, () => getJson(`${API}/${lang}/rarities`));

export const listIllustrators = (lang = 'en') => once(`ill:${lang}`, async () =>
  (await getJson(`${API}/${lang}/illustrators`)).filter(n => n && !n.includes('"')));
