// Fichário: começa fechado (capa de fora). Ao abrir, a capa de dentro fica à esquerda e a página 1 à direita.
// Cada folha tem frente e verso e vira em 3D em torno da lombada. A capa e a contracapa são folhas "duras",
// um pouco maiores que as páginas. As páginas têm bolsos de plástico sobre o fundo da cor do álbum.
import { totalSheets, sheetCount, slotKey, visiblePages, spreadForPage, clamp, UNITS } from './grid.js';
import { esc } from './util.js';

const FLIP_MS = 800;
const STAGGER_MS = 60;

// Medidas em "unidades" (a carta tem 63×88). O CSS usa as mesmas.
const { GAP, PAD, HARD, CARD_W, CARD_H } = UNITS;

/** Abaixo desta largura o livro mostra uma página por vez. */
export const SINGLE_PAGE_MAX_WIDTH = 700;

export function createBook(stage, handlers = {}) {
  const el = stage.querySelector('#book');
  let data = null;      // { album, slots: Map, cards: Map }
  let spread = 0;       // quantas folhas já foram viradas (0 = fechado)
  let side = 'right';   // no modo de uma página: qual lado do livro está em foco
  let timers = [];
  let wasSingle = null;

  const isSingle = () => stage.clientWidth < SINGLE_PAGE_MAX_WIDTH;
  const pages = () => data.album.pages;
  const total = () => (data ? totalSheets(pages()) : 0);
  const sheets = () => [...el.querySelectorAll('.sheet')];

  /** Posição em foco no modo de uma página: 0 = capa, 1..N = páginas, N+1 = contracapa. */
  function curPos() {
    if (spread === 0) return 0;
    if (spread === total()) return pages() + 1;
    const [l, r] = visiblePages(spread, pages());
    return (side === 'left' ? (l ?? r) : (r ?? l)) ?? 1;
  }

  /* ---------- HTML ---------- */
  function slotHTML(album, page, row, col) {
    const key = slotKey(album.id, page, row, col);
    const slot = data.slots.get(key);
    const card = slot && data.cards.get(slot.cardId);
    const idx = row * album.cols + col + 1;
    const attrs = `data-key="${esc(key)}" data-page="${page}" data-row="${row}" data-col="${col}" role="button" tabindex="0"`;
    if (!card) return `<div class="slot" ${attrs} aria-label="Slot ${idx} vazio"><span class="plus">+</span></div>`;
    // Sem texto em cima da carta: os detalhes aparecem ao clicar no slot. Só cartas sem imagem mostram o nome.
    const missing = card.owned === false;   // "ainda não tenho": aparece em cinza
    // Tipo de foil: 'holo', 'reverse' ou 'none'. 'unknown' = carta Pokémon salva antes de guardarmos o foil; o app descobre ao passar o mouse.
    const foil = card.foil ?? (card.source === 'pokemon' && card.sourceId ? 'unknown' : 'none');
    return `<div class="slot filled ${card.image ? '' : 'noimg'}${missing ? ' missing' : ''}" ${attrs} data-foil="${foil}" draggable="true" aria-label="${esc(card.name)}${missing ? ' (ainda não tenho)' : ''}">
      <div class="card3d">
        ${card.image ? `<img src="${esc(card.image)}" alt="" loading="lazy" draggable="false">` : `<div class="label">${esc(card.name)}</div>`}
        <i class="foil"></i><div class="shine"></div>
      </div></div>`;
  }

  function pageHTML(page) {
    const { album } = data;
    let slots = '';
    for (let r = 0; r < album.rows; r++) for (let c = 0; c < album.cols; c++) slots += slotHTML(album, page, r, c);
    return `<div class="grid" style="grid-template-columns:repeat(${album.cols},calc(${CARD_W}*var(--u)))">${slots}</div>`;
  }

  function sheetHTML(i, n) {
    const P = pages(), flipped = i < spread ? ' flipped' : '';
    if (i === 0) {
      return `<div class="sheet hard${flipped}"><div class="face front cover-out"><div class="cover-title">${esc(data.album.name)}</div></div>
        <div class="face back cover-in"></div></div>`;
    }
    if (i === n - 1) {
      return `<div class="sheet hard${flipped}"><div class="face front cover-in"></div><div class="face back cover-out"></div></div>`;
    }
    const f = 2 * i - 1, b = 2 * i;
    return `<div class="sheet${flipped}"><div class="face front">${pageHTML(f)}</div>
      <div class="face back${b > P ? ' page-blank' : ''}">${b > P ? '' : pageHTML(b)}</div></div>`;
  }

  /* ---------- Tamanho ---------- */
  function layout() {
    if (!data) return;
    const { rows, cols } = data.album;
    const W = CARD_W * cols + GAP * (cols - 1) + 2 * PAD;    // largura da página em unidades
    const H = CARD_H * rows + GAP * (rows - 1) + 2 * PAD;    // altura da página
    const single = isSingle();
    const fitW = single ? (W + 2 * HARD) / 0.9 : (2 * W + 2 * HARD) / 0.94;
    const u = Math.max(0.2, Math.min(stage.clientWidth / fitW, stage.clientHeight * 0.9 / (H + 2 * HARD)));
    el.style.setProperty('--u', u + 'px');
    el.style.setProperty('--pw', W * u + 'px');
    el.style.setProperty('--ph', H * u + 'px');
    place();
    if (wasSingle !== single) { wasSingle = single; notify(); }
  }

  // Centraliza o que está à vista: fechado mostra só a capa (direita) ou a contracapa (esquerda); no modo de
  // uma página, centraliza a página em foco.
  function place() {
    const pw = parseFloat(el.style.getPropertyValue('--pw')) || 0;
    const closedFront = spread === 0, closedBack = spread === total();
    const single = isSingle();
    stage.classList.toggle('single', single);
    let left;
    if (closedFront) left = false;
    else if (closedBack) left = true;
    else if (single) {
      const [l, r] = visiblePages(spread, pages());
      left = side === 'left' ? l !== null : r === null;
    } else { el.style.transform = 'none'; return; }
    el.style.transform = `translateX(${left ? pw / 2 : -pw / 2}px)`;
  }

  function settleZ() {
    const n = total();
    sheets().forEach((sh, i) => { sh.style.zIndex = i < spread ? i : n - i; });
  }

  /* ---------- Render ---------- */
  function render(next, { reset = false } = {}) {
    data = next;
    if (reset) spread = 0;
    spread = Math.min(spread, total());
    el.classList.add('no-anim');
    const n = total();
    let html = '';
    for (let i = 0; i < n; i++) html += sheetHTML(i, n);
    el.innerHTML = html;
    settleZ();
    layout();
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove('no-anim')));
    notify();
  }

  /** Redesenha só o slot indicado, sem refazer o livro inteiro. */
  function updateSlot(key) {
    if (!data) return;
    for (const s of el.querySelectorAll('.slot[data-key]')) {
      if (s.dataset.key === key) s.outerHTML = slotHTML(data.album, +s.dataset.page, +s.dataset.row, +s.dataset.col);
    }
  }

  function notify() {
    handlers.onSpread?.(spread, visiblePages(spread, pages()), total(), { single: isSingle(), pos: curPos(), pages: pages() });
  }

  /* ---------- Virar páginas ---------- */
  function goTo(target, nextSide = null) {
    if (!data) return;
    target = clamp(target, 0, total());
    if (nextSide) side = nextSide;
    if (target === spread) { place(); notify(); return; }   // mesma folha: só desliza para o outro lado
    timers.forEach(clearTimeout); timers = [];
    const dir = target > spread ? 1 : -1, n = total(), all = sheets();
    const moving = [];
    for (let i = spread; i !== target; i += dir) moving.push(dir > 0 ? i : i - 1);
    // O estado final já vale para o resto do app; a animação só acompanha.
    spread = target;
    place(); notify();
    moving.forEach((idx, k) => {
      const sh = all[idx], delay = k * STAGGER_MS;
      timers.push(setTimeout(() => { sh.style.zIndex = 1000 + (dir > 0 ? n - idx : idx); sh.classList.toggle('flipped', dir > 0); }, delay));
      timers.push(setTimeout(() => { sh.style.zIndex = 1000 + (dir > 0 ? idx : n - idx); }, delay + FLIP_MS / 2));
    });
    timers.push(setTimeout(settleZ, moving.length * STAGGER_MS + FLIP_MS + 50));
  }

  /** Mostra a página `p` (abre o livro se estiver fechado). */
  function showPage(p) {
    if (!data) return;
    p = clamp(p, 1, pages());
    goTo(spreadForPage(p), p % 2 ? 'right' : 'left');
  }

  /** Fecha o livro mostrando a capa. */
  function showCover() { goTo(0, 'right'); }

  /** Avança ou volta: uma página no modo de uma página, uma folha (duas páginas) no modo livro. */
  function step(dir) {
    if (!data) return;
    if (!isSingle()) { goTo(spread + dir); return; }
    const v = clamp(curPos() + dir, 0, pages() + 1);
    if (v === 0) goTo(0, 'right');
    else if (v === pages() + 1) goTo(total(), 'left');
    else showPage(v);
  }

  /* ---------- Entrada do usuário ---------- */
  el.addEventListener('click', e => {
    const s = e.target.closest('.slot[data-page]');
    if (s) { handlers.onSlot?.({ key: s.dataset.key, page: +s.dataset.page, row: +s.dataset.row, col: +s.dataset.col }); return; }
    // Clicar na capa fechada abre o fichário.
    if (spread === 0 && e.target.closest('.cover-out')) step(1);
  });
  // Imagem salva que deixou de carregar: mostra o nome da carta no lugar do ícone quebrado e avisa o app, que tenta consertar.
  el.addEventListener('error', e => {
    const img = e.target, slot = img.tagName === 'IMG' && img.closest('.slot.filled');
    if (!slot) return;
    const name = slot.getAttribute('aria-label') || '';
    slot.classList.add('noimg');
    img.replaceWith(Object.assign(document.createElement('div'), { className: 'label', textContent: name.replace(/ (ainda não tenho)$/, '') }));
    handlers.onBrokenImage?.(slot.dataset.key);
  }, true);
  el.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const s = e.target.closest?.('.slot[data-page]');
    if (s) { e.preventDefault(); s.click(); }
  });
  /* ---------- Foil: brilho e inclinação enquanto o mouse (ou o dedo) está sobre a carta ---------- */
  const FOIL_TILT = 14;                          // graus de inclinação nas bordas
  let foilSlot = null;
  const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  function endFoil() {
    if (!foilSlot) return;
    foilSlot.classList.remove('foiling');
    for (const v of ['--mx', '--my', '--bx', '--by', '--rx', '--ry']) foilSlot.style.removeProperty(v);
    foilSlot = null;
  }

  function moveFoil(slot, e) {
    const r = slot.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    slot.style.setProperty('--mx', x * 100 + '%');
    slot.style.setProperty('--my', y * 100 + '%');
    if (!['holo', 'reverse'].includes(slot.dataset.foil) || reduceMotion()) return;
    slot.style.setProperty('--bx', x * 100 + '%');
    slot.style.setProperty('--by', y * 100 + '%');
    slot.style.setProperty('--ry', (x - 0.5) * 2 * FOIL_TILT + 'deg');
    slot.style.setProperty('--rx', (0.5 - y) * 2 * FOIL_TILT + 'deg');
  }

  function startFoil(slot) {
    foilSlot = slot;
    if (slot.classList.contains('missing')) return;     // carta que ainda não tenho: sem foil
    if (slot.dataset.foil === 'unknown') handlers.onFoilNeeded?.(slot.dataset.key);
    slot.classList.add('foiling');
  }

  el.addEventListener('pointermove', e => {
    const s = e.target.closest('.slot.filled');
    if (s !== foilSlot) { endFoil(); if (s) startFoil(s); }
    if (s) moveFoil(s, e);
  });
  el.addEventListener('pointerleave', endFoil);
  el.addEventListener('pointercancel', endFoil);
  el.addEventListener('pointerup', e => { if (e.pointerType === 'touch') endFoil(); });

  /* ---------- Arrastar e soltar cartas ---------- */
  let dragKey = null, edgeTimer = null, edgeDir = 0;
  const stopEdge = () => { clearInterval(edgeTimer); edgeTimer = null; edgeDir = 0; };
  const clearOver = () => el.querySelectorAll('.over,.dragging').forEach(n => n.classList.remove('over', 'dragging'));

  el.addEventListener('dragstart', e => {
    const s = e.target.closest?.('.slot.filled');
    if (!s) return;
    dragKey = s.dataset.key;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', dragKey);
    s.classList.add('dragging');
  });
  el.addEventListener('dragover', e => {
    const s = e.target.closest?.('.slot[data-key]');
    if (!dragKey || !s) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    el.querySelectorAll('.over').forEach(n => n !== s && n.classList.remove('over'));
    s.classList.add('over');
  });
  el.addEventListener('drop', e => {
    const s = e.target.closest?.('.slot[data-key]');
    if (!dragKey || !s) return;
    e.preventDefault();
    const from = dragKey;
    dragKey = null; stopEdge(); clearOver();
    if (from !== s.dataset.key) handlers.onMove?.(from, s.dataset.key);
  });
  addEventListener('dragend', () => { dragKey = null; stopEdge(); clearOver(); });

  // Arrastando perto da borda do palco, as folhas viram sozinhas para levar a carta a outra página.
  stage.addEventListener('dragover', e => {
    if (!dragKey) return;
    const r = stage.getBoundingClientRect(), edge = Math.min(90, r.width * 0.12);
    const dir = e.clientX < r.left + edge ? -1 : e.clientX > r.right - edge ? 1 : 0;
    if (dir === edgeDir) return;
    stopEdge();
    if (!dir) return;
    edgeDir = dir;
    edgeTimer = setInterval(() => step(dir), 900);
  });

  let startX = null;
  stage.addEventListener('pointerdown', e => { startX = e.target.closest('.slot') ? null : e.clientX; });
  addEventListener('pointerup', e => {
    if (startX === null) return;
    const dx = e.clientX - startX; startX = null;
    if (Math.abs(dx) > 60) step(dx < 0 ? 1 : -1);
  });
  addEventListener('resize', layout);

  return {
    render,
    updateSlot,
    layout,
    goTo,
    showPage,
    showCover,
    next: () => step(1),
    prev: () => step(-1),
    get spread() { return spread; },
    get sheets() { return total(); },
    get pageSheets() { return sheetCount(data ? pages() : 0); },
  };
}
