// Orquestra o app: carrega dados, desenha o livro e liga os botões.
import { db, meta, exportAll, importAll, validateExport } from './store.js';
import { createBook } from './book.js';
import { applyTheme, DEFAULT_COLOR, SWATCHES as SWATCH_CYCLE } from './color.js';
import { BINDER_PRESETS, presetLabel, sanitizeBinder, pagesToSheets, slotsInGrid, totalSlots, totalSheets, parseSlotKey } from './grid.js';
import { createColorPicker } from './wheel.js';
import { initCardForm } from './cardform.js';
import { initSearch } from './search.js';
import { repairImage } from './providers/images.js';
import { fetchFoil } from './providers/tcgdex.js';
import { renderLibrary, flyCover, fadeZoom, coverMetrics } from './library.js';
import { GAMES } from './providers/index.js';
import { buildShareLink, readShareLink, shareFromHash, SAFE_LINK_LENGTH } from './share.js';
import { renderCollection } from './collection.js';
import { renderWishlist, initWishlistDialog } from './wishlist.js';
import { firstEmptySlot } from './grid.js';
import { $, uid, toast, downloadJSON, slug } from './util.js';

const state = { albums: [], album: null, slots: new Map(), cards: new Map() };
let book;

/* ---------- Dados ---------- */
function newAlbum(over = {}) {
  return { id: uid(), name: 'Meu Álbum', game: 'pokemon', rows: 3, cols: 3, pages: 40, color: DEFAULT_COLOR, createdAt: Date.now(), ...over };
}

/** Carrega os álbuns e o álbum indicado (ou o último aberto, ou o primeiro). Cria um se não houver nenhum. */
async function loadAlbum(id) {
  let albums = await db.all('albums');
  if (!albums.length) { const a = newAlbum(); await db.put('albums', a); albums = [a]; }
  albums.sort((a, b) => a.createdAt - b.createdAt);
  state.albums = albums;
  const wanted = id ?? await meta.get('currentAlbum');
  state.album = albums.find(a => a.id === wanted) || albums[0];
  await meta.set('currentAlbum', state.album.id);
  const [slots, cards] = await Promise.all([db.byAlbum(state.album.id), db.all('cards')]);
  state.slots = new Map(slots.map(s => [s.key, s]));
  state.cards = new Map(cards.map(c => [c.id, c]));
}

async function switchAlbum(id) {
  await loadAlbum(id);
  draw({ reset: true });
}

async function createAlbum() {
  const n = state.albums.length + 1;
  const a = newAlbum({ name: `Álbum ${n}`, game: state.album.game, color: SWATCH_CYCLE[n % SWATCH_CYCLE.length] });
  await db.put('albums', a);
  await switchAlbum(a.id);
  await showView('album');
  $('#btnSettings').click();     // abre a configuração para ajustar o novo álbum
}

async function deleteAlbum() {
  const slots = await db.byAlbum(state.album.id);
  await db.delMany('cards', slots.map(s => s.cardId));
  await db.delMany('slots', slots.map(s => s.key));
  await db.del('albums', state.album.id);
  toast(`Álbum "${state.album.name}" excluído`);
  await switchAlbum();
  await showView('library');
}

function draw({ reset = false } = {}) {
  applyTheme($('#book'), state.album.color);
  book.render(state, { reset });
  $('#title').textContent = state.album.name;
  document.title = `${state.album.name} · Sleevebook`;
  updateStat();
}

/** Quantas cartas dos slots dados eu tenho e quantas ainda faltam (`owned === false`). */
function cardCounts(slotList) {
  let owned = 0, wanted = 0;
  for (const s of slotList) {
    const card = state.cards.get(s.cardId);
    if (!card) continue;
    if (card.owned === false) wanted++; else owned++;
  }
  return { owned, wanted };
}

function updateStat() {
  const a = state.album;
  const { owned, wanted } = cardCounts(slotsInGrid(a, [...state.slots.values()]));
  $('#stat').textContent = `${owned}/${totalSlots(a)} cartas${wanted ? ` · ${wanted} faltam` : ''} · ${a.rows}×${a.cols} · ${pagesToSheets(a.pages)} folhas`;
  renderPos();
}

/* ---------- Navegação ---------- */
let lastNav = null;
function onSpread(spread, visible, sheets, info) {
  lastNav = { spread, visible, sheets, info };
  renderPos();
}

/** Texto e botões da barra de páginas. Também mostra quantas cartas há nas páginas à vista. */
function renderPos() {
  if (!lastNav || !state.album) return;
  const { spread, visible: [left, right], sheets, info } = lastNav;
  let text, atStart, atEnd, shown;
  if (info?.single) {
    // Modo de uma página (telas estreitas): capa → páginas → contracapa
    text = info.pos === 0 ? 'Capa' : info.pos === info.pages + 1 ? 'Contracapa' : `Página ${info.pos} de ${info.pages}`;
    atStart = info.pos <= 0; atEnd = info.pos >= info.pages + 1;
    shown = info.pos >= 1 && info.pos <= info.pages ? [info.pos] : [];
  } else {
    text = spread === 0 ? 'Capa' : spread === sheets ? 'Contracapa' : `Páginas ${left ?? '—'} | ${right ?? '—'}`;
    atStart = spread === 0; atEnd = spread === sheets;
    shown = [left, right].filter(p => p !== null);
  }
  if (shown.length) {
    const { owned, wanted } = cardCounts([...state.slots.values()].filter(s => shown.includes(s.page)));
    text += ` · ${owned}/${shown.length * state.album.rows * state.album.cols} cartas${wanted ? ` · ${wanted} faltam` : ''}`;
  }
  $('#pos').textContent = text;
  $('#first').disabled = $('#prev').disabled = atStart;
  $('#last').disabled = $('#next').disabled = atEnd;
}

function wireAlbums() {
  $('#btnLibrary').onclick = () => backToLibrary();
  addEventListener('keydown', e => {
    if (e.key === 'Escape' && view === 'album' && !document.querySelector('dialog[open]') && !movingFrom) backToLibrary();
  });
  $('#sDelete').onclick = async () => {
    $('#delInfo').textContent = `"${state.album.name}" tem ${state.slots.size} carta(s).`;
    $('#dlgSet').close();
    $('#dlgDelete').showModal();
  };
  $('#delCancel').onclick = () => $('#dlgDelete').close();
  $('#delConfirm').onclick = async () => { $('#dlgDelete').close(); await deleteAlbum(); };
}

function wireNav() {
  $('#next').onclick = () => book.next();
  $('#prev').onclick = () => book.prev();
  $('#first').onclick = () => book.showPage(1);
  $('#last').onclick = () => book.showPage(state.album.pages);
  $('#jump').onchange = e => {
    const p = parseInt(e.target.value, 10);
    e.target.value = '';
    if (p >= 1 && p <= state.album.pages) book.showPage(p);
  };
  addEventListener('keydown', e => {
    if (document.querySelector('dialog[open]') || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)) return;
    if (e.key === 'ArrowRight') book.next();
    if (e.key === 'ArrowLeft') book.prev();
  });
}

/* ---------- Configurar álbum ---------- */
function updateSetInfo() {
  const draft = sanitizeBinder({ rows: $('#sRows').value, cols: $('#sCols').value, sheets: $('#sSheets').value });
  const all = [...state.slots.values()];
  const hidden = all.length - slotsInGrid({ ...state.album, ...draft }, all).length;
  const pockets = draft.rows * draft.cols;
  $('#sInfo').textContent = `${pockets} bolsos por página · ${pagesToSheets(draft.pages)} folhas, ${draft.pages} páginas (frente e verso) · cabem ${totalSlots(draft)} cartas.` +
    (hidden ? ` ${hidden} carta(s) ficarão fora da grade, mas continuam guardadas e voltam se você aumentar o álbum.` : '');
}

function wireSettings() {
  $('#sGame').innerHTML = Object.entries(GAMES).map(([k, g]) => `<option value="${k}">${g.label}</option>`).join('');
  $('#presets').innerHTML = BINDER_PRESETS.map(p => `<button type="button" data-p="${p.rows},${p.cols},${p.sheets}" title="${p.note}">${presetLabel(p)}</button>`).join('');
  $('#presets').onclick = e => {
    const b = e.target.closest('button');
    if (!b) return;
    [$('#sRows').value, $('#sCols').value, $('#sSheets').value] = b.dataset.p.split(',');
    updateSetInfo();
  };
  ['#sRows', '#sCols', '#sSheets'].forEach(s => $(s).addEventListener('input', updateSetInfo));
  // A cor aparece no álbum enquanto você escolhe; se cancelar, volta à cor salva.
  let draftColor = state.album?.color || DEFAULT_COLOR, saved = false;
  const picker = createColorPicker($('#colorPicker'), {
    onChange: hex => { draftColor = hex; applyTheme($('#book'), hex); },
  });
  $('#btnSettings').onclick = () => {
    const a = state.album;
    $('#sName').value = a.name; $('#sGame').value = a.game || 'pokemon'; $('#sRows').value = a.rows; $('#sCols').value = a.cols; $('#sSheets').value = pagesToSheets(a.pages);
    draftColor = a.color; saved = false;
    $('#sFoil').checked = foilEnabled();
    picker.set(a.color);
    updateSetInfo();
    $('#dlgSet').showModal();
  };
  $('#dlgSet').addEventListener('close', () => { if (!saved) applyTheme($('#book'), state.album.color); });
  $('#sCancel').onclick = () => $('#dlgSet').close();
  $('#formSet').addEventListener('submit', async e => {
    if (e.submitter?.id !== 'sSave') return;
    saved = true;
    setFoilEnabled($('#sFoil').checked);
    const layout = sanitizeBinder({ rows: $('#sRows').value, cols: $('#sCols').value, sheets: $('#sSheets').value });
    state.album = { ...state.album, name: $('#sName').value.trim() || 'Meu Álbum', game: $('#sGame').value, color: draftColor, ...layout };
    await db.put('albums', state.album);
    state.albums = state.albums.map(a => (a.id === state.album.id ? state.album : a));
    draw();
    book.goTo(Math.min(book.spread, totalSheets(layout.pages)));
    toast('Álbum atualizado');
  });
}

/* ---------- Mover carta por toque ---------- */
// Alternativa ao arrastar (que não funciona em telas de toque): "Mover…" no cadastro e depois toque no slot de destino.
let movingFrom = null;

function startMove(key, card) {
  movingFrom = key;
  $('#moveText').textContent = `Mover "${card?.name ?? 'carta'}": toque no slot de destino`;
  $('#moveBar').hidden = false;
  document.body.classList.add('moving');
}

function endMove() {
  movingFrom = null;
  $('#moveBar').hidden = true;
  document.body.classList.remove('moving');
}

async function finishMove(slot) {
  const from = movingFrom;
  endMove();
  if (slot.key !== from) await moveCard(from, slot.key);
}

/* ---------- Cadastro de carta ---------- */
function wireCards() {
  const form = initCardForm({
    onSave: async (slot, card) => {
      card.id = card.id || uid();
      card.updatedAt = Date.now();
      const rec = { key: slot.key, albumId: state.album.id, page: slot.page, row: slot.row, col: slot.col, cardId: card.id };
      await db.put('cards', card);
      await db.put('slots', rec);
      state.cards.set(card.id, card);
      state.slots.set(slot.key, rec);
      book.updateSlot(slot.key);
      updateStat();
      toast(`${card.name} salva`);
    },
    onDelete: async (slot, card) => {
      if (!card) return;
      await db.del('cards', card.id);
      await db.del('slots', slot.key);
      state.cards.delete(card.id);
      state.slots.delete(slot.key);
      book.updateSlot(slot.key);
      updateStat();
      toast(`${card.name} removida`);
    },
    onMoveStart: (slot, card) => startMove(slot.key, card),
  });
  app.form = form;
  const search = initSearch({ onPick: data => form.fill(data), getGame: () => state.album.game });
  app.onSlot = slot => {
    if (movingFrom) { finishMove(slot); return; }
    const rec = state.slots.get(slot.key);
    form.open(slot, rec && state.cards.get(rec.cardId), { beforeOpen: search.reset });
  };
  $('#moveCancel').onclick = endMove;
  addEventListener('keydown', e => { if (e.key === 'Escape' && movingFrom) endMove(); });
}

/* ---------- Seções: Álbum, Coleção, Wishlist ---------- */
const VIEWS = { library: '', album: '#album', collection: '#colecao', wishlist: '#wishlist' };
let view = 'library';

/** Mostra só a seção `name` (sem animação) e atualiza abas, barra do álbum e endereço. */
function applyView(name) {
  view = name;
  for (const v of Object.keys(VIEWS)) {
    const el = $(`#view${v[0].toUpperCase()}${v.slice(1)}`);
    el.hidden = v !== name;
    el.style.visibility = '';
    el.getAnimations?.().forEach(a => a.cancel());
  }
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.view === name || (name === 'album' && b.dataset.view === 'library')));
  $('#albumTools').hidden = name !== 'album';
  // O título mostra o nome do álbum só dentro dele; nas outras telas é o nome do app.
  $('#title').textContent = name === 'album' && state.album ? state.album.name : 'Sleevebook';
  document.title = name === 'album' && state.album ? `${state.album.name} · Sleevebook` : 'Sleevebook';
  history.replaceState(null, '', VIEWS[name] || location.pathname);
}

async function showView(name) {
  applyView(name);
  if (name === 'album') book.layout();
  if (name === 'library') await renderLibraryView();
  if (name === 'collection') await renderCollectionView();
  if (name === 'wishlist') await renderWishlistView();
}

/* ---------- Biblioteca de fichários ---------- */
const wait = ms => new Promise(r => setTimeout(r, ms));
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
let transitioning = false;

async function renderLibraryView() {
  const [albums, slots, cards] = await Promise.all([db.all('albums'), db.all('slots'), db.all('cards')]);
  albums.sort((a, b) => a.createdAt - b.createdAt);
  renderLibrary($('#viewLibrary'), { albums, slots, cards, onOpen: openAlbumFromLibrary, onNew: createAlbum });
}

/** Abre o álbum "aproximando": a capa da prateleira cresce até o tamanho e a posição que tem no livro. */
async function openAlbumFromLibrary(album, coverEl) {
  if (transitioning) return;
  transitioning = true;
  try {
    const from = coverEl.getBoundingClientRect();
    const uFrom = parseFloat(getComputedStyle(coverEl).getPropertyValue('--u'));
    await loadAlbum(album.id);
    draw({ reset: true });
    // Mostra o álbum, ainda invisível, só para medir onde a capa vai ficar.
    const albumView = $('#viewAlbum');
    albumView.hidden = false; albumView.style.visibility = 'hidden';
    $('#albumTools').hidden = false;
    book.layout();
    const target = $('#book .sheet.hard .face.cover-out').getBoundingClientRect();
    const fade = fadeZoom($('#viewLibrary'), { out: true });
    await flyCover(coverEl, from, target, uFrom);
    fade?.cancel();
    applyView('album');
    book.layout();
  } finally { transitioning = false; }
}

/** Volta para a prateleira: fecha o fichário e a capa "se afasta" até o lugar dela. */
async function backToLibrary() {
  if (view !== 'album' || transitioning) return;
  transitioning = true;
  try {
    if (book.spread !== 0) { book.goTo(0); await wait(reduceMotion() ? 0 : 1000); }   // fecha o fichário antes
    await renderLibraryView();
    const lib = $('#viewLibrary');
    lib.hidden = false; lib.style.visibility = 'hidden';
    const coverEl = lib.querySelector(`.libcover[data-id="${CSS.escape(state.album.id)}"]`);
    coverEl?.scrollIntoView({ block: 'center' });
    const from = $('#book .sheet.hard .face.cover-out').getBoundingClientRect();
    const uFrom = parseFloat(getComputedStyle($('#book')).getPropertyValue('--u'));
    if (coverEl) {
      const to = coverEl.getBoundingClientRect();
      $('#viewAlbum').style.visibility = 'hidden';
      const fade = fadeZoom(lib, { out: false });
      lib.style.visibility = '';
      await flyCover(coverEl, from, to, uFrom);
      fade?.cancel();
    }
    applyView('library');
  } finally { transitioning = false; }
}

async function renderCollectionView() {
  const [albums, slots, cards] = await Promise.all([db.all('albums'), db.all('slots'), db.all('cards')]);
  renderCollection($('#viewCollection'), { albums, slots, cards, onGoto: gotoCard });
}

/** Abre o álbum e a página onde a carta está. */
async function gotoCard(albumId, page) {
  if (albumId !== state.album.id) await switchAlbum(albumId);
  await showView('album');
  book.showPage(page);
}

let wishDialog;
async function renderWishlistView() {
  const items = await db.all('wishlist');
  renderWishlist($('#viewWishlist'), {
    items,
    onAdd: () => wishDialog.open(null),
    onEdit: item => wishDialog.open(item),
    onMove: wishToAlbum,
  });
}

/** Coloca o item da wishlist no primeiro slot livre do álbum atual e tira da lista. */
async function wishToAlbum(item) {
  const free = firstEmptySlot(state.album, new Set(state.slots.keys()));
  if (!free) { toast(`O álbum "${state.album.name}" está cheio.`); return; }
  const card = {
    id: uid(), name: item.name, set: item.set, setTotal: item.setTotal ?? null, number: item.number, image: item.image || '',
    condition: 'NM (Near Mint)', qty: 1, owned: true, notes: item.notes || '',
    source: item.source || 'manual', sourceId: item.sourceId || null, updatedAt: Date.now(),
  };
  const rec = { key: free.key, albumId: state.album.id, page: free.page, row: free.row, col: free.col, cardId: card.id };
  await db.put('cards', card);
  await db.put('slots', rec);
  await db.del('wishlist', item.id);
  state.cards.set(card.id, card);
  state.slots.set(rec.key, rec);
  await showView('album');
  book.updateSlot(rec.key);
  updateStat();
  book.showPage(free.page);
  toast(`${card.name} entrou na pág. ${free.page} de "${state.album.name}"`);
}

function wireViews() {
  document.querySelectorAll('#tabs button').forEach(b => { b.onclick = () => showView(b.dataset.view); });
  wishDialog = initWishlistDialog({
    getGame: () => state.album.game,
    onSave: async item => { await db.put('wishlist', item); await renderWishlistView(); toast(`${item.name} na wishlist`); },
    onDelete: async item => { await db.del('wishlist', item.id); await renderWishlistView(); toast(`${item.name} removida da wishlist`); },
  });
}

/* ---------- Foil ---------- */
const FOIL_KEY = 'sleevebook-foil';
const foilEnabled = () => { try { return localStorage.getItem(FOIL_KEY) !== '0'; } catch { return true; } };
function setFoilEnabled(on) {
  try { localStorage.setItem(FOIL_KEY, on ? '1' : '0'); } catch { /* sem armazenamento: fica ligado */ }
  $('#stage').classList.toggle('foil-off', !on);
}

const foilTried = new Set();
/** Carta Pokémon salva antes de guardarmos o foil: descobre o tipo pelo TCGdex (uma vez por carta por sessão) e grava. */
async function detectFoil(key) {
  const rec = state.slots.get(key), card = rec && state.cards.get(rec.cardId);
  if (!card || card.foil !== undefined || foilTried.has(card.id)) return;
  foilTried.add(card.id);
  try {
    const foil = await fetchFoil(card.sourceId, card.language ?? 'en');
    const saved = { ...card, foil: foil ?? 'none' };
    await db.put('cards', saved);
    state.cards.set(saved.id, saved);
    book.updateSlot(key);
  } catch { foilTried.delete(card.id); }     // sem rede ou carta que o TCGdex não conhece: tenta de novo numa próxima vez
}

/** Uma imagem salva deixou de carregar: procura outra, grava na carta e redesenha o slot. Tenta uma vez por carta. */
const triedImages = new Set();
async function repairSlotImage(key) {
  const rec = state.slots.get(key), card = rec && state.cards.get(rec.cardId);
  if (!card || triedImages.has(card.id)) return;
  triedImages.add(card.id);
  const fixed = await repairImage(card);
  if (!fixed.image) return;
  const saved = { ...card, image: fixed.image, imageFallback: fixed.imageFallback, updatedAt: Date.now() };
  await db.put('cards', saved);
  state.cards.set(saved.id, saved);
  book.updateSlot(key);
}

/** Move a carta de `from` para `to`; se `to` já tem carta, as duas trocam de lugar. */
export async function moveCard(from, to) {
  const a = state.slots.get(from), b = state.slots.get(to);
  if (!a || from === to) return;
  const at = (key, cardId) => ({ key, albumId: state.album.id, ...parseSlotKey(key), cardId });
  const toRec = at(to, a.cardId);
  if (b) {
    const fromRec = at(from, b.cardId);
    await db.putMany('slots', [toRec, fromRec]);
    state.slots.set(from, fromRec);
  } else {
    await db.putMany('slots', [toRec]);
    await db.del('slots', from);
    state.slots.delete(from);
  }
  state.slots.set(to, toRec);
  book.updateSlot(from);
  book.updateSlot(to);
  updateStat();
  toast(b ? 'Cartas trocadas de lugar' : 'Carta movida');
}

/* ---------- Exportar / importar ---------- */
function wireBackup() {
  $('#btnExport').onclick = async () => {
    downloadJSON(await exportAll(), `sleevebook-${slug(state.album.name)}-${new Date().toISOString().slice(0, 10)}.json`);
    toast('Backup exportado');
  };
  let pending = null;
  $('#btnImport').onclick = () => $('#fileImport').click();
  $('#fileImport').onchange = async e => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      pending = JSON.parse(await file.text());
      validateExport(pending);
    } catch (err) { toast(err instanceof SyntaxError ? 'Arquivo inválido.' : err.message); return; }
    $('#impInfo').textContent = `${pending.albums.length} álbum(ns), ${pending.cards.length} carta(s).`;
    $('#dlgImport').showModal();
  };
  const finish = async mode => {
    $('#dlgImport').close();
    await importAll(pending, mode);
    pending = null;
    await loadAlbum();
    draw();
    toast('Backup importado');
  };
  $('#impMerge').onclick = () => finish('merge');
  $('#impReplace').onclick = () => finish('replace');
  $('#impCancel').onclick = () => { pending = null; $('#dlgImport').close(); };
}

/* ---------- Compartilhar por link ---------- */
function wireShare() {
  let link = '';
  const refresh = async () => {
    const slots = [...state.slots.values()];
    link = await buildShareLink(location.origin + location.pathname, state.album, slots, [...state.cards.values()], { includeNotes: $('#shNotes').checked });
    $('#shLink').value = link;
    const kb = (link.length / 1000).toFixed(1).replace('.', ',');
    $('#shHint').textContent = link.length > SAFE_LINK_LENGTH
      ? `Link grande (${kb} mil caracteres): apps de mensagem podem cortá-lo. Se o destinatário não conseguir abrir, envie o arquivo de backup (botão Exportar).`
      : `Link de ${kb} mil caracteres. Quem tiver o link vê o álbum inteiro; ele não pode ser cancelado depois de enviado.`;
  };
  $('#btnShare').onclick = async () => {
    const n = slotsInGrid(state.album, [...state.slots.values()]).length;
    $('#shInfo').textContent = `"${state.album.name}": ${n} ${n === 1 ? 'carta' : 'cartas'}. Fotos que você enviou não vão no link; as imagens das cartas buscadas vão pelo endereço delas.`;
    $('#shNotes').checked = false;
    $('#shNative').hidden = !navigator.share;
    await refresh();
    $('#dlgShare').showModal();
  };
  $('#shNotes').onchange = refresh;
  $('#shClose').onclick = () => $('#dlgShare').close();
  $('#shCopy').onclick = async () => {
    try { await navigator.clipboard.writeText(link); toast('Link copiado'); }
    catch { $('#shLink').select(); toast('Selecione o link e copie (Ctrl+C)'); }
  };
  $('#shNative').onclick = () => navigator.share({ title: state.album.name, text: `Álbum "${state.album.name}" no Sleevebook`, url: link }).catch(() => {});
  $('#shLink').onfocus = e => e.target.select();

  // Receber: o link abre o app com o álbum no fragmento. Mostra o que chegou e só importa se a pessoa aceitar.
  let incoming = null;
  const close = () => { incoming = null; $('#dlgReceive').close(); };
  $('#rcCancel').onclick = close;
  $('#rcImport').onclick = async () => {
    const got = incoming;
    close();
    await db.put('albums', got.album);
    await db.putMany('cards', got.cards);
    await db.putMany('slots', got.slots);
    await switchAlbum(got.album.id);
    await showView('album');
    toast(`"${got.album.name}" adicionado à biblioteca`);
  };
  return async hash => {
    if (!shareFromHash(hash)) return;
    history.replaceState(null, '', location.pathname);       // o link não fica no histórico nem é reaberto ao recarregar
    try { incoming = await readShareLink(hash); } catch (err) { toast(err.message); return; }
    const { album, cards } = incoming, sheets = pagesToSheets(album.pages);
    $('#rcInfo').textContent = `"${album.name}": ${cards.length} ${cards.length === 1 ? 'carta' : 'cartas'}, fichário de ${album.cols}×${album.rows} bolsos com ${sheets} folhas.`;
    $('#dlgReceive').showModal();
  };
}

/* ---------- Início ---------- */
async function main() {
  const arrivedWith = location.hash;                  // um link compartilhado chega no fragmento; lemos antes de a navegação limpá-lo
  book = createBook($('#stage'), { onSpread, onSlot: slot => app.onSlot?.(slot), onMove: moveCard, onBrokenImage: repairSlotImage, onFoilNeeded: detectFoil });
  setFoilEnabled(foilEnabled());
  await loadAlbum();
  wireNav(); wireAlbums(); wireSettings(); wireCards(); wireBackup(); wireViews();
  const receive = wireShare();
  draw();
  const start = Object.entries(VIEWS).find(([, h]) => h && h === location.hash)?.[0] ?? 'library';
  await showView(start);
  receive(arrivedWith);
  addEventListener('hashchange', () => receive(location.hash));   // colar um link com o app já aberto na mesma aba
}

// Uso offline: registra o service worker (só em http/https).
// Quem deixa a aba aberta continua com o código antigo na memória mesmo depois de uma atualização. Por isso, quando
// uma versão nova assume o controle, aparece um aviso com o botão "Recarregar"; e o navegador procura versão nova
// ao voltar para a aba e de tempos em tempos.
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  const hadController = !!navigator.serviceWorker.controller;     // false na primeira instalação: sem aviso
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController) $('#updateBar').hidden = false; });
  addEventListener('load', async () => {
    const reg = await navigator.serviceWorker.register('sw.js').catch(() => null);
    if (!reg) return;
    const check = () => reg.update().catch(() => {});
    document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
    setInterval(check, 30 * 60 * 1000);
  });
  $('#updateReload').onclick = () => location.reload();
  $('#updateLater').onclick = () => { $('#updateBar').hidden = true; };
}

// Pontos de extensão usados pelos próximos módulos (cadastro de carta etc.).
export const app = { state, draw, updateStat, reload: loadAlbum, get book() { return book; }, onSlot: null, form: null };
main();
