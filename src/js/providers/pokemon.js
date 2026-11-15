// Pokémon TCG API (https://docs.pokemontcg.io). Funciona sem chave, com limite de requisições.
const BASE = 'https://api.pokemontcg.io/v2/cards';

/** Preço de mercado do primeiro tipo de impressão que tiver valor. */
function marketPrice(card) {
  const prices = card.tcgplayer?.prices || {};
  for (const kind of Object.keys(prices)) {
    const p = prices[kind]?.market ?? prices[kind]?.mid;
    if (typeof p === 'number') return p;
  }
  return null;
}

export function normalize(json) {
  return (json?.data || []).map(c => ({
    name: c.name,
    set: c.set?.name ?? '',
    setTotal: c.set?.printedTotal ?? c.set?.total ?? null,
    number: c.set?.printedTotal ? `${c.number}/${c.set.printedTotal}` : String(c.number ?? ''),
    image: c.images?.small ?? '',
    price: marketPrice(c),
    source: 'pokemon',
    sourceId: c.id,
  }));
}

export function buildUrl(query) {
  const q = query.replace(/["\\]/g, '').trim();
  const params = new URLSearchParams({
    q: `name:"${q}*"`,
    pageSize: '30',
    orderBy: '-set.releaseDate',
    select: 'id,name,number,set,images,tcgplayer',
  });
  return `${BASE}?${params}`;
}

/* ---------- Reserva: TCGdex (https://tcgdex.dev) ----------
   A Pokémon TCG API fica instável de vez em quando (respostas 502). Se ela falhar ou demorar,
   buscamos no TCGdex, que tem CORS aberto e preços do TCGplayer. */
const TCGDEX = 'https://api.tcgdex.net/v2/en/cards';

/** Carta detalhada do TCGdex → formato do app. */
export function normalizeTcgdex(card) {
  const tp = card.pricing?.tcgplayer || {};
  let price = null;
  for (const kind of Object.keys(tp)) {
    const v = tp[kind];
    if (v && typeof v === 'object' && typeof v.marketPrice === 'number') { price = v.marketPrice; break; }
  }
  const total = card.set?.cardCount?.official ?? null;
  return {
    name: card.name,
    set: card.set?.name ?? '',
    setTotal: total,
    number: total ? `${card.localId}/${total}` : String(card.localId ?? ''),
    image: card.image ? `${card.image}/low.webp` : '',
    price,
    source: 'pokemon',
    sourceId: card.id,
  };
}

async function searchTcgdex(query, signal) {
  const params = new URLSearchParams({ name: query, 'pagination:page': '1', 'pagination:itemsPerPage': '30' });
  const res = await fetch(`${TCGDEX}?${params}`, { signal });
  if (!res.ok) throw new Error(`TCGdex respondeu ${res.status}`);
  const list = await res.json();
  const details = await Promise.all(list.map(async c => {
    try { const r = await fetch(`${TCGDEX}/${encodeURIComponent(c.id)}`, { signal }); return r.ok ? await r.json() : c; }
    catch (e) { if (e.name === 'AbortError') throw e; return c; }
  }));
  return details.map(normalizeTcgdex);
}

/** Aborta `fetch` depois de `ms`, sem deixar de respeitar o `signal` de quem chamou. */
function withTimeout(ms, signal) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  signal?.addEventListener('abort', () => ctl.abort());
  return { signal: ctl.signal, done: () => clearTimeout(timer) };
}

export async function search(query, { signal } = {}) {
  const t = withTimeout(6000, signal);
  try {
    const res = await fetch(buildUrl(query), { signal: t.signal });
    if (!res.ok) throw new Error(`Pokémon TCG API respondeu ${res.status}`);
    return normalize(await res.json());
  } catch (e) {
    if (signal?.aborted) throw e;           // o usuário cancelou: não tenta a reserva
    return searchTcgdex(query, signal);
  } finally { t.done(); }
}
