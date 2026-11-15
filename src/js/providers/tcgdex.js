// TCGdex (https://tcgdex.dev): catálogo Pokémon aberto, sem chave, com CORS liberado, vários idiomas
// e filtros por campo (set, raridade, ilustrador…). É a fonte principal da busca de Pokémon (ADR 0004).
const API = 'https://api.tcgdex.net/v2';

/** Idiomas do TCGdex. Cada idioma tem o seu próprio catálogo: sets só japoneses, por exemplo, só existem em "ja". */
export const LANGUAGES = {
  en: 'Inglês', pt: 'Português', ja: 'Japonês', ko: 'Coreano', 'zh-tw': 'Chinês (tradicional)', 'zh-cn': 'Chinês (simplificado)',
  fr: 'Francês', de: 'Alemão', es: 'Espanhol', it: 'Italiano', id: 'Indonésio', th: 'Tailandês',
};
export const PAGE_SIZE = 30;

/**
 * Tipo de foil a partir das versões que a carta tem no TCGdex ({ holo, reverse, normal… }):
 * 'holo' (a arte brilha), 'reverse' (só a moldura brilha) ou 'none'. Sem a informação (`undefined`), devolve `undefined`.
 */
export function foilFromVariants(variants) {
  if (!variants || typeof variants !== 'object') return undefined;
  if (variants.holo) return 'holo';
  if (variants.reverse) return 'reverse';
  return 'none';
}

/** Carta detalhada do TCGdex → formato do app. `lang` é o idioma do catálogo em que a carta foi buscada. */
export function normalizeTcgdex(card, lang = 'en') {
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
    rarity: card.rarity && card.rarity !== 'None' ? card.rarity : '',   // o TCGdex usa "None" quando a carta não tem raridade
    illustrator: card.illustrator ?? '',
    language: lang,
    foil: foilFromVariants(card.variants),
    source: 'pokemon',
    sourceId: card.id,
  };
}

/** Filtros preenchidos? ({ setId, rarity, illustrator }) */
export const hasFilters = f => !!(f && (f.setId || f.rarity || f.illustrator));

/** Monta a consulta da lista de cartas: nome (contém) ou número da Pokédex + filtros exatos + paginação. */
export function buildParams({ query = '', filters = {}, page = 1, dexId = null } = {}) {
  const p = new URLSearchParams();
  if (dexId) p.set('dexId', `eq:${dexId}`);
  else if (query.trim()) p.set('name', query.trim());
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

/**
 * Números da Pokédex dos Pokémon cujo nome em inglês contém `query` (no máximo 3). Serve para achar a carta em
 * outro idioma digitando o nome em inglês: "Bibarel" não existe no catálogo japonês, mas o Pokémon nº 400 sim.
 */
export async function dexIdsForEnglishName(query, signal) {
  const list = await getJson(`${API}/en/cards?${buildParams({ query, page: 1 })}`, signal);
  const ids = new Set();
  for (const c of list.slice(0, 5)) {
    try { (await getJson(`${API}/en/cards/${encodeURIComponent(c.id)}`, signal)).dexId?.forEach(n => ids.add(n)); }
    catch (e) { if (e.name === 'AbortError') throw e; }
    if (ids.size >= 3) break;
  }
  return [...ids].slice(0, 3);
}

/**
 * Busca cartas (lista + detalhes de cada uma, para ter set e raridade).
 * Em outro idioma que não o inglês, se o nome digitado não existir naquele catálogo (por exemplo, "Bibarel" em
 * japonês, que é ビーダル), procura o Pokémon em inglês e busca as cartas dele pelo número da Pokédex.
 */
export async function search(query, { signal, filters = {}, page = 1, lang = 'en' } = {}) {
  const base = `${API}/${lang}/cards`;
  let list = await getJson(`${base}?${buildParams({ query, filters, page })}`, signal);
  if (!list.length && lang !== 'en' && query.trim()) {
    const dexIds = await dexIdsForEnglishName(query, signal);
    const lists = await Promise.all(dexIds.map(dexId => getJson(`${base}?${buildParams({ filters, page, dexId })}`, signal)));
    const seen = new Set();
    list = lists.flat().filter(c => !seen.has(c.id) && seen.add(c.id)).slice(0, PAGE_SIZE);
  }
  const details = await Promise.all(list.map(async c => {
    try { return await getJson(`${base}/${encodeURIComponent(c.id)}`, signal); }
    catch (e) { if (e.name === 'AbortError') throw e; return c; }   // sem detalhes: usa o resumo da lista
  }));
  return details.map(d => normalizeTcgdex(d, lang));
}

/* ---------- Opções dos filtros (carregadas uma vez por idioma) ---------- */
const cache = new Map();
const once = (key, load) => { if (!cache.has(key)) cache.set(key, load().catch(e => { cache.delete(key); throw e; })); return cache.get(key); };

export const listSets = (lang = 'en') => once(`sets:${lang}`, async () =>
  (await getJson(`${API}/${lang}/sets`)).map(s => ({ id: s.id, name: s.name, total: s.cardCount?.total ?? 0 })));

export const listRarities = (lang = 'en') => once(`rar:${lang}`, () => getJson(`${API}/${lang}/rarities`));

export const listIllustrators = (lang = 'en') => once(`ill:${lang}`, async () =>
  (await getJson(`${API}/${lang}/illustrators`)).filter(n => n && !n.includes('"')));

/** Tipo de foil de uma carta já cadastrada, consultando o TCGdex (para cartas salvas antes de guardarmos o foil). */
export async function fetchFoil(sourceId, lang = 'en', signal) {
  const card = await getJson(`${API}/${lang}/cards/${encodeURIComponent(sourceId)}`, signal);
  return foilFromVariants(card.variants);
}
