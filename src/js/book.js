// Visual de livro: folhas com frente e verso que viram em 3D.
// Cada folha tem duas páginas (1/2, 3/4…). Virar = girar 180° em torno da lombada.
import { sheetCount, slotKey, visiblePages } from './grid.js';
import { esc } from './util.js';

const FLIP_MS = 800;
const STAGGER_MS = 60;

export function createBook(stage, handlers = {}) {
  const el = stage.querySelector('#book');
  let data = null;      // { album, slots: Map, cards: Map }
  let spread = 0;       // quantas folhas já foram viradas
  let timers = [];

  const sheets = () => [...el.querySelectorAll('.sheet')];
  const total = () => (data ? sheetCount(data.album.pages) : 0);

  /* ---------- HTML ---------- */
  function slotHTML(album, page, row, col) {
    const key = slotKey(album.id, page, row, col);
    const slot = data.slots.get(key);
    const card = slot && data.cards.get(slot.cardId);
    const idx = row * album.cols + col + 1;
    const attrs = `data-key="${esc(key)}" data-page="${page}" data-row="${row}" data-col="${col}" role="button" tabindex="0"`;
    if (!card) return `<div class="slot" ${attrs} aria-label="Slot ${idx} vazio"><span class="n">${idx}</span><span class="plus">+</span></div>`;
    const sub = [card.set, card.number].filter(Boolean).join(' ');
    return `<div class="slot filled ${card.image ? '' : 'noimg'}" ${attrs} aria-label="${esc(card.name)}">
      ${card.image ? `<img src="${esc(card.image)}" alt="" loading="lazy" draggable="false">` : ''}
      <div class="label"><b>${esc(card.name)}</b>${sub ? `<span>${esc(sub)}</span>` : ''}</div>
      ${card.qty > 1 ? `<span class="qty">×${card.qty}</span>` : ''}<div class="shine"></div></div>`;
  }

  function pageHTML(page) {
    const { album } = data;
    let slots = '';
    for (let r = 0; r < album.rows; r++) for (let c = 0; c < album.cols; c++) slots += slotHTML(album, page, r, c);
    return `<div class="ph"><span>${esc(album.name)}</span><span>Pág. ${page}</span></div>
      <div class="grid" style="grid-template-columns:repeat(${album.cols},calc(63*var(--u)))">${slots}</div>`;
  }

  /* ---------- Tamanho ---------- */
  function layout() {
    if (!data) return;
    const { rows, cols } = data.album;
    const W = 63 * cols + 8 * (cols - 1) + 28;          // largura da página em unidades
    const H = 88 * rows + 8 * (rows - 1) + 28 + 24;     // altura em unidades
    const u = Math.max(0.2, Math.min(stage.clientWidth / 2.15 / W, stage.clientHeight * 0.9 / H));
    el.style.setProperty('--u', u + 'px');
    el.style.setProperty('--pw', W * u + 'px');
    el.style.setProperty('--ph', H * u + 'px');
    place();
  }

  // Na primeira página só há página direita; na última só esquerda: centraliza o que aparece.
  function place() {
    const pw = parseFloat(el.style.getPropertyValue('--pw')) || 0;
    const last = spread === total();
    el.classList.toggle('is-first', spread === 0);
    el.classList.toggle('is-last', last && spread !== 0);
    el.style.transform = spread === 0 ? `translateX(${-pw / 2}px)` : last ? `translateX(${pw / 2}px)` : 'none';
  }

  function settleZ() {
    const n = total();
    sheets().forEach((sh, i) => { sh.style.zIndex = i < spread ? i : n - i; });
  }

  /* ---------- Render ---------- */
  function render(next) {
    data = next;
    spread = Math.min(spread, total());
    el.classList.add('no-anim');
    const n = total();
    let html = '<div class="cover"></div>';
    for (let i = 0; i < n; i++) {
      const f = 2 * i + 1, b = 2 * i + 2;
      html += `<div class="sheet${i < spread ? ' flipped' : ''}">
        <div class="face front">${pageHTML(f)}</div>
        <div class="face back${b > data.album.pages ? ' blank' : ''}">${b > data.album.pages ? 'fim' : pageHTML(b)}</div></div>`;
    }
    el.innerHTML = html;
    settleZ();
    layout();
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove('no-anim')));
    notify();
  }

  /** Redesenha só o slot indicado (sem refazer o livro inteiro). */
  function updateSlot(key) {
    if (!data) return;
    for (const s of el.querySelectorAll('.slot[data-key]')) {
      if (s.dataset.key === key) s.outerHTML = slotHTML(data.album, +s.dataset.page, +s.dataset.row, +s.dataset.col);
    }
  }

  function notify() { handlers.onSpread?.(spread, visiblePages(spread, data.album.pages), total()); }

  /* ---------- Virar páginas ---------- */
  function goTo(target) {
    if (!data) return;
    target = Math.max(0, Math.min(total(), target));
    if (target === spread) return;
    timers.forEach(clearTimeout); timers = [];
    const dir = target > spread ? 1 : -1, n = total(), all = sheets();
    const moving = [];
    for (let i = spread; i !== target; i += dir) moving.push(dir > 0 ? i : i - 1);
    // Estado final já vale para o resto do app; a animação só acompanha.
    spread = target;
    place(); notify();
    moving.forEach((idx, k) => {
      const sh = all[idx], delay = k * STAGGER_MS;
      const at = (ms, fn) => timers.push(setTimeout(fn, ms));
      at(delay, () => { sh.style.zIndex = 1000 + (dir > 0 ? n - idx : idx); sh.classList.toggle('flipped', dir > 0); });
      at(delay + FLIP_MS / 2, () => { sh.style.zIndex = 1000 + (dir > 0 ? idx : n - idx); });
    });
    at_end(moving.length * STAGGER_MS + FLIP_MS + 50);
    function at_end(ms) { timers.push(setTimeout(settleZ, ms)); }
  }

  /* ---------- Entrada do usuário ---------- */
  el.addEventListener('click', e => {
    const s = e.target.closest('.slot[data-page]');
    if (s) handlers.onSlot?.({ key: s.dataset.key, page: +s.dataset.page, row: +s.dataset.row, col: +s.dataset.col });
  });
  el.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const s = e.target.closest?.('.slot[data-page]');
    if (s) { e.preventDefault(); s.click(); }
  });
  el.addEventListener('pointermove', e => {
    const s = e.target.closest('.slot.filled');
    if (!s) return;
    const r = s.getBoundingClientRect();
    s.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100) + '%');
    s.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100) + '%');
  });

  let startX = null;
  stage.addEventListener('pointerdown', e => { startX = e.target.closest('.slot') ? null : e.clientX; });
  addEventListener('pointerup', e => {
    if (startX === null) return;
    const dx = e.clientX - startX; startX = null;
    if (Math.abs(dx) > 60) goTo(spread + (dx < 0 ? 1 : -1));
  });
  addEventListener('resize', layout);

  return {
    render,
    updateSlot,
    layout,
    goTo,
    next: () => goTo(spread + 1),
    prev: () => goTo(spread - 1),
    get spread() { return spread; },
    get sheets() { return total(); },
  };
}
