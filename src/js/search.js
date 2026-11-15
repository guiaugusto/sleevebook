// Busca de cartas dentro do modal de cadastro. Resultado clicado preenche o formulário.
// Para Pokémon há filtros avançados (set, raridade, ilustrador, idioma) e "Mostrar mais".
import { $, esc, debounce } from './util.js';
import { GAMES, LANGUAGES, PAGE_SIZE, hasSearch, hasFilters, searchCards, supportsFilters, loadFilterOptions } from './providers/index.js';

const CARD_IDS = {
  box: '#searchBox', input: '#qSearch', list: '#qResults', status: '#qStatus', game: '#qGame',
  adv: { box: '#advBox', set: '#qSet', rarity: '#qRarity', illus: '#qIllus', lang: '#qLang', clear: '#qClear', dlSets: '#dlSets', dlIllus: '#dlIllus', more: '#qMore', langBox: '#qLangBox', langHint: '#qLangHint' },
};

/** `ids` permite reutilizar a busca em outro diálogo (ex.: wishlist, sem filtros avançados). */
export function initSearch({ onPick, getGame, ids = CARD_IDS }) {
  const box = $(ids.box), input = $(ids.input), list = $(ids.list), status = $(ids.status), gameSel = $(ids.game);
  const adv = ids.adv && Object.fromEntries(Object.entries(ids.adv).map(([k, sel]) => [k, $(sel)]));
  let ctl = null, results = [], page = 1, lastBatch = 0, options = null, optionsLang = null;

  gameSel.innerHTML = Object.entries(GAMES).filter(([k]) => k !== 'other').map(([k, g]) => `<option value="${k}">${g.label}</option>`).join('');
  if (adv) {
    adv.lang.innerHTML = Object.entries(LANGUAGES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
    adv.rarity.innerHTML = '<option value="">Qualquer</option>';
  }
  const advOn = () => !!adv && supportsFilters(gameSel.value);

  /* ---------- Filtros ---------- */
  const norm = s => String(s ?? '').trim().toLowerCase();

  function currentFilters() {
    if (!advOn() || !options) return {};
    const typedSet = norm(adv.set.value);
    const set = typedSet && options.sets.find(s => norm(s.name) === typedSet || norm(s.id) === typedSet);
    const ill = adv.illus.value.trim();
    return {
      setId: set?.id ?? '',
      rarity: adv.rarity.value,
      illustrator: options.illustrators.includes(ill) ? ill : '',
    };
  }

  async function ensureOptions() {
    if (!advOn()) return;
    const lang = adv.lang.value;
    if (options && optionsLang === lang) return;
    try {
      options = await loadFilterOptions(gameSel.value, lang);
      optionsLang = lang;
      adv.dlSets.innerHTML = options.sets.map(s => `<option value="${esc(s.name)}">${esc(s.id)} · ${s.total} cartas</option>`).join('');
      adv.dlIllus.innerHTML = options.illustrators.map(n => `<option value="${esc(n)}"></option>`).join('');
      const keep = adv.rarity.value;
      adv.rarity.innerHTML = '<option value="">Qualquer</option>' + options.rarities.map(r => `<option>${esc(r)}</option>`).join('');
      adv.rarity.value = options.rarities.includes(keep) ? keep : '';
    } catch {
      status.textContent = 'Não foi possível carregar os filtros agora. A busca por nome continua funcionando.';
    }
  }

  /* ---------- Busca ---------- */
  function render() {
    list.innerHTML = results.map((c, i) => `<button type="button" class="res" data-i="${i}">
      ${c.image ? `<img src="${esc(c.image)}" alt="" loading="lazy">` : '<span class="noimg"></span>'}
      <span><b>${esc(c.name)}</b><small>${esc(c.set)} ${esc(c.number)}${c.language && c.language !== 'en' ? ` · ${esc(c.language.toUpperCase())}` : ''}${c.rarity ? ` · ${esc(c.rarity)}` : ''}</small></span></button>`).join('');
    if (adv?.more) adv.more.hidden = !(advOn() && lastBatch >= PAGE_SIZE);
  }

  async function run({ append = false } = {}) {
    ctl?.abort();
    const q = input.value.trim(), f = currentFilters();
    if (!append) { page = 1; results = []; lastBatch = 0; }
    if (q.length < 2 && !hasFilters(f)) { status.textContent = ''; render(); return; }
    ctl = new AbortController();
    status.textContent = 'Buscando…';
    try {
      const batch = await searchCards(gameSel.value, q, { signal: ctl.signal, filters: f, page, lang: adv?.lang.value || 'en' });
      lastBatch = batch.length;
      const seen = new Set(results.map(c => c.sourceId));
      results = append ? [...results, ...batch.filter(c => !seen.has(c.sourceId))] : batch;
      status.textContent = results.length ? `${results.length} resultado(s). Clique para preencher.` : 'Nada encontrado. Tente outras palavras ou preencha à mão.';
      render();
      renderLangHint();
    } catch (e) {
      if (e.name === 'AbortError') return;
      status.textContent = 'Não foi possível buscar agora. Preencha à mão ou tente de novo.';
    }
  }

  /** Depois de buscar, sugere procurar em outros idiomas: sets só japoneses, por exemplo, não existem em inglês. */
  const HINT_LANGS = ['ja', 'ko', 'zh-tw', 'pt', 'en', 'fr', 'de', 'es', 'it'];
  function renderLangHint() {
    if (!adv?.langHint) return;
    const cur = adv.lang.value;
    adv.langHint.hidden = !advOn();
    adv.langHint.innerHTML = `Não é a carta que procura? Tente em outro idioma: ${HINT_LANGS.filter(l => l !== cur).map(l => `<button type="button" data-lang="${l}">${LANGUAGES[l]}</button>`).join('')}`;
  }

  const later = debounce(run, 350);
  input.addEventListener('input', later);
  gameSel.addEventListener('change', async () => { syncAdv(); await ensureOptions(); run(); });
  list.addEventListener('click', e => {
    const b = e.target.closest('.res');
    if (b) onPick(results[+b.dataset.i]);
  });

  function syncAdv() {
    if (!adv) return;
    adv.box.hidden = !advOn();
    if (adv.langBox) adv.langBox.hidden = !advOn();
    if (adv.langHint) adv.langHint.hidden = true;
    if (adv.more) adv.more.hidden = true;
  }

  if (adv) {
    adv.box.addEventListener('toggle', () => { if (adv.box.open) ensureOptions(); });
    [adv.set, adv.illus].forEach(el => el.addEventListener('input', later));
    adv.rarity.addEventListener('change', () => run());
    adv.lang.addEventListener('change', async () => { adv.set.value = ''; adv.rarity.value = ''; await ensureOptions(); run(); });
    adv.clear.addEventListener('click', () => { adv.set.value = ''; adv.rarity.value = ''; adv.illus.value = ''; run(); });
    adv.more.addEventListener('click', () => { page += 1; run({ append: true }); });
    adv.langHint?.addEventListener('click', e => {
      const b = e.target.closest('button[data-lang]');
      if (!b) return;
      adv.lang.value = b.dataset.lang;
      adv.lang.dispatchEvent(new Event('change'));
    });
  }

  return {
    /** Prepara a busca ao abrir o modal. Esconde se o jogo do álbum não tem busca. */
    reset() {
      const game = getGame();
      box.hidden = !hasSearch(game);
      if (hasSearch(game)) gameSel.value = game;
      input.value = ''; list.innerHTML = ''; status.textContent = ''; results = []; page = 1; lastBatch = 0;
      if (adv) {
        adv.set.value = ''; adv.rarity.value = ''; adv.illus.value = ''; adv.box.open = false;
        syncAdv();
      }
      ctl?.abort();
    },
  };
}
