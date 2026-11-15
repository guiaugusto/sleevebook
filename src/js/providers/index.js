// Camada de provedores: todos devolvem cartas no mesmo formato
// { name, set, setTotal, number, image, price, source, sourceId }.
import * as pokemon from './pokemon.js';
import * as magic from './scryfall.js';
import * as yugioh from './yugioh.js';

export const GAMES = {
  pokemon: { label: 'Pokémon TCG', provider: pokemon },
  magic: { label: 'Magic: The Gathering', provider: magic },
  yugioh: { label: 'Yu-Gi-Oh!', provider: yugioh },
  other: { label: 'Outro (cadastro manual)', provider: null },
};

export const hasSearch = game => !!GAMES[game]?.provider;

export async function searchCards(game, query, opts) {
  const p = GAMES[game]?.provider;
  if (!p) return [];
  const q = String(query || '').trim();
  if (q.length < 2) return [];
  return p.search(q, opts);
}
