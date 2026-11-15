// YGOPRODeck (https://ygoprodeck.com/api-guide), para Yu-Gi-Oh!.
const BASE = 'https://db.ygoprodeck.com/api/v7/cardinfo.php';

export function normalize(json) {
  return (json?.data || []).slice(0, 12).map(c => {
    const set = c.card_sets?.[0];
    const price = parseFloat(c.card_prices?.[0]?.tcgplayer_price);
    return {
      name: c.name,
      set: set?.set_name ?? '',
      setTotal: null,
      number: set?.set_code ?? '',
      image: c.card_images?.[0]?.image_url_small ?? '',
      price: Number.isFinite(price) && price > 0 ? price : null,
      source: 'yugioh',
      sourceId: String(c.id),
    };
  });
}

export const buildUrl = query => `${BASE}?${new URLSearchParams({ fname: query.trim(), num: '12', offset: '0' })}`;

export async function search(query, { signal } = {}) {
  const res = await fetch(buildUrl(query), { signal });
  if (res.status === 400) return [];   // a API responde 400 quando nada combina
  if (!res.ok) throw new Error(`YGOPRODeck respondeu ${res.status}`);
  return normalize(await res.json());
}
