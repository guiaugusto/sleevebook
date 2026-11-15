// Busca de cartas Pokémon. Fonte principal: TCGdex (filtros por set, raridade, ilustrador e idioma).
// Complemento: Pokémon TCG API (https://docs.pokemontcg.io), que preenche imagem e preço que faltarem e traz
// cartas que o TCGdex não tem. As duas são consultadas ao mesmo tempo (ADR 0004).
import { search as searchTcgdex, hasFilters, normalizeTcgdex } from './tcgdex.js';
import { fillMissingImages } from './images.js';

export { normalizeTcgdex };

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
    rarity: c.rarity ?? '',
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
    select: 'id,name,number,set,images,tcgplayer,rarity',
  });
  return `${BASE}?${params}`;
}

/** Aborta `fetch` depois de `ms`, sem deixar de respeitar o `signal` de quem chamou. */
function withTimeout(ms, signal) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  signal?.addEventListener('abort', () => ctl.abort());
  return { signal: ctl.signal, done: () => clearTimeout(timer) };
}

async function searchPokemonTcg(query, signal) {
  const t = withTimeout(6000, signal);
  try {
    const res = await fetch(buildUrl(query), { signal: t.signal });
    if (!res.ok) throw new Error(`Pokémon TCG API respondeu ${res.status}`);
    return normalize(await res.json());
  } finally { t.done(); }
}

const norm = s => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
/** "040/102" → "40"; "GG31/70" → "gg31". Compara o número da carta sem zeros à esquerda nem o total do set. */
const numKey = n => norm(String(n ?? '').split('/')[0]).replace(/^0+(?=\d)/, '');

/** Duas fontes descrevem a mesma carta? Mesmo nome e número, e nomes de set iguais ou um contido no outro. */
export function sameCard(a, b) {
  if (norm(a.name) !== norm(b.name) || numKey(a.number) !== numKey(b.number)) return false;
  const sa = norm(a.set), sb = norm(b.set);
  return !sa || !sb || sa === sb || sa.includes(sb) || sb.includes(sa);
}

/** Junta as fontes: tudo de `main` e, de `extra`, só o que `main` não tem. */
export function mergeResults(main, extra) {
  return [...main, ...extra.filter(c => !main.some(m => sameCard(m, c)))];
}

/** Preenche imagem e preço que faltam em `card` com os de uma carta igual em `others`. */
export function fillMissing(card, others) {
  if (card.image && card.price != null) return card;
  const match = others.find(o => sameCard(o, card));
  return match ? { ...card, image: card.image || match.image, price: card.price ?? match.price } : card;
}

/**
 * Busca no TCGdex e, quando é uma busca simples por nome em inglês (sem filtros, primeira página), também na
 * Pokémon TCG API. Resultado: cartas do TCGdex (com imagem e preço completados pela outra fonte) mais as que
 * só a outra fonte tem. Só falha se todas as fontes consultadas falharem.
 */
export async function search(query, { signal, filters = {}, page = 1, lang = 'en' } = {}) {
  const simple = !hasFilters(filters) && page === 1 && lang === 'en' && query.trim().length >= 2;
  const [a, b] = await Promise.allSettled([
    searchTcgdex(query, { signal, filters, page, lang }),
    simple ? searchPokemonTcg(query, signal) : Promise.resolve([]),
  ]);
  if (signal?.aborted) throw new DOMException('Busca cancelada', 'AbortError');
  if (a.status === 'rejected' && (b.status === 'rejected' || !simple)) throw a.reason;
  const main = a.value ?? [], extra = b.value ?? [];
  const merged = mergeResults(main.map(c => fillMissing(c, extra)), extra);
  const withImages = await fillMissingImages(merged);
  if (signal?.aborted) throw new DOMException('Busca cancelada', 'AbortError');
  return withImages;
}
