// Busca de cartas dentro do modal de cadastro. Resultado clicado preenche o formulário.
import { $, esc, debounce } from './util.js';
import { GAMES, hasSearch, searchCards } from './providers/index.js';

const CARD_IDS = { box: '#searchBox', input: '#qSearch', list: '#qResults', status: '#qStatus', game: '#qGame' };

/** `ids` permite reutilizar a busca em outro diálogo (ex.: wishlist). */
export function initSearch({ onPick, getGame, ids = CARD_IDS }) {
  const box = $(ids.box), input = $(ids.input), list = $(ids.list), status = $(ids.status), gameSel = $(ids.game);
  let ctl = null, results = [];

  gameSel.innerHTML = Object.entries(GAMES).filter(([k]) => k !== 'other').map(([k, g]) => `<option value="${k}">${g.label}</option>`).join('');

  async function run() {
    ctl?.abort();
    const q = input.value.trim();
    list.innerHTML = '';
    if (q.length < 2) { status.textContent = ''; return; }
    ctl = new AbortController();
    status.textContent = 'Buscando…';
    try {
      results = await searchCards(gameSel.value, q, { signal: ctl.signal });
      status.textContent = results.length ? `${results.length} resultado(s). Clique para preencher.` : 'Nada encontrado. Você pode preencher à mão.';
      list.innerHTML = results.map((c, i) => `<button type="button" class="res" data-i="${i}">
        ${c.image ? `<img src="${esc(c.image)}" alt="" loading="lazy">` : '<span class="noimg"></span>'}
        <span><b>${esc(c.name)}</b><small>${esc(c.set)} ${esc(c.number)}${c.price != null ? ` · US$ ${c.price.toFixed(2)}` : ''}</small></span></button>`).join('');
    } catch (e) {
      if (e.name === 'AbortError') return;
      status.textContent = 'Não foi possível buscar agora. Preencha à mão ou tente de novo.';
    }
  }

  input.addEventListener('input', debounce(run, 350));
  gameSel.addEventListener('change', run);
  list.addEventListener('click', e => {
    const b = e.target.closest('.res');
    if (b) onPick(results[+b.dataset.i]);
  });

  return {
    /** Prepara a busca ao abrir o modal. Esconde se o jogo do álbum não tem busca. */
    reset() {
      const game = getGame();
      box.hidden = !hasSearch(game);
      if (hasSearch(game)) gameSel.value = game;
      input.value = ''; list.innerHTML = ''; status.textContent = '';
      ctl?.abort();
    },
  };
}
