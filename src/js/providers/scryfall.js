// Scryfall (https://scryfall.com/docs/api), para Magic: The Gathering.
const BASE = 'https://api.scryfall.com/cards/search';

export function normalize(json) {
  return (json?.data || []).slice(0, 12).map(c => {
    const img = c.image_uris || c.card_faces?.[0]?.image_uris || {};
    const usd = c.prices?.usd ?? c.prices?.usd_foil;
    return {
      name: c.name,
      set: c.set_name ?? '',
      setTotal: null,
      number: String(c.collector_number ?? ''),
      image: img.small ?? img.normal ?? '',
      price: usd != null ? parseFloat(usd) : null,
      source: 'magic',
      sourceId: c.id,
    };
  });
}

export const buildUrl = query =>
  `${BASE}?${new URLSearchParams({ q: query.trim(), unique: 'prints', order: 'released', dir: 'desc' })}`;

export async function search(query, { signal } = {}) {
  const res = await fetch(buildUrl(query), { signal });
  if (res.status === 404) return [];   // Scryfall usa 404 para "nenhum resultado"
  if (!res.ok) throw new Error(`Scryfall respondeu ${res.status}`);
  return normalize(await res.json());
}
