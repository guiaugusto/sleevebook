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

const norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Mantém só os resultados em que todas as palavras extras aparecem no nome, no set ou no número.
 * Se nenhum resultado sobrar, devolve a lista inteira (melhor mostrar algo do que nada).
 */
export function refineResults(results, extraWords) {
  const words = extraWords.map(norm).filter(Boolean);
  if (!words.length) return results;
  const hit = results.filter(c => {
    const hay = norm(`${c.name} ${c.set} ${c.number}`);
    return words.every(w => hay.includes(w));
  });
  return hit.length ? hit : results;
}

/**
 * Busca no provedor do jogo. A API só entende o nome da carta; por isso, se a busca com todas as palavras
 * não achar nada ("turtwig 040", "turtwig mep"), buscamos só pela primeira palavra e filtramos pelas demais
 * (set, número…).
 */
export async function searchCards(game, query, opts) {
  const p = GAMES[game]?.provider;
  if (!p) return [];
  const q = String(query || '').trim();
  if (q.length < 2) return [];
  const results = await p.search(q, opts);
  const words = q.split(/\s+/);
  if (results.length || words.length < 2 || words[0].length < 2) return results;
  return refineResults(await p.search(words[0], opts), words.slice(1));
}
