// Orquestra o app: carrega dados, desenha o livro e liga os botões.
import { db, meta, exportAll, importAll, validateExport } from './store.js';
import { createBook } from './book.js';
import { applyTheme, DEFAULT_COLOR, SWATCHES as SWATCH_CYCLE } from './color.js';
import { PRESETS, sanitizeLayout, spreadForPage, slotsInGrid, totalSlots, sheetCount, parseSlotKey } from './grid.js';
import { createColorPicker } from './wheel.js';
import { initCardForm } from './cardform.js';
import { initSearch } from './search.js';
import { GAMES } from './providers/index.js';
import { renderCollection } from './collection.js';
import { renderWishlist, initWishlistDialog } from './wishlist.js';
import { firstEmptySlot } from './grid.js';
import { $, uid, toast, downloadJSON, slug } from './util.js';

const state = { albums: [], album: null, slots: new Map(), cards: new Map() };
let book;

/* ---------- Dados ---------- */
function newAlbum(over = {}) {
  return { id: uid(), name: 'Meu Álbum', game: 'pokemon', rows: 3, cols: 3, pages: 20, color: DEFAULT_COLOR, createdAt: Date.now(), ...over };
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

function renderAlbumSelect() {
  $('#albumSelect').innerHTML = state.albums.map(a => `<option value="${a.id}">${a.name.replace(/[<>&"]/g, '')}</option>`).join('');
  $('#albumSelect').value = state.album.id;
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
  $('#btnSettings').click();     // abre a configuração para ajustar o novo álbum
}

async function deleteAlbum() {
  const slots = await db.byAlbum(state.album.id);
  await db.delMany('cards', slots.map(s => s.cardId));
  await db.delMany('slots', slots.map(s => s.key));
  await db.del('albums', state.album.id);
  toast(`Álbum "${state.album.name}" excluído`);
  await switchAlbum();
}

function draw({ reset = false } = {}) {
  applyTheme($('#book'), state.album.color);
  book.render(state, { reset });
  renderAlbumSelect();
  $('#title').textContent = state.album.name;
  document.title = `${state.album.name} · Sleevebook`;
  updateStat();
}

function updateStat() {
  const a = state.album;
  const filled = slotsInGrid(a, [...state.slots.values()]).length;
  $('#stat').textContent = `${filled}/${totalSlots(a)} slots · ${a.rows}×${a.cols} · ${a.pages} págs.`;
}

/* ---------- Navegação ---------- */
function onSpread(spread, [left, right], sheets) {
  $('#pos').textContent = `Páginas ${left ?? '—'} | ${right ?? '—'}`;
  $('#first').disabled = $('#prev').disabled = spread === 0;
  $('#last').disabled = $('#next').disabled = spread === sheets;
}

function wireAlbums() {
  $('#albumSelect').onchange = e => switchAlbum(e.target.value);
  $('#btnNew').onclick = createAlbum;
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
  $('#first').onclick = () => book.goTo(0);
  $('#last').onclick = () => book.goTo(book.sheets);
  $('#jump').onchange = e => {
    const p = parseInt(e.target.value, 10);
    e.target.value = '';
    if (p >= 1 && p <= state.album.pages) book.goTo(spreadForPage(p));
  };
  addEventListener('keydown', e => {
    if (document.querySelector('dialog[open]') || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)) return;
    if (e.key === 'ArrowRight') book.next();
    if (e.key === 'ArrowLeft') book.prev();
  });
}

/* ---------- Configurar álbum ---------- */
function updateSetInfo() {
  const draft = sanitizeLayout({ rows: $('#sRows').value, cols: $('#sCols').value, pages: $('#sPages').value });
  const all = [...state.slots.values()];
  const hidden = all.length - slotsInGrid({ ...state.album, ...draft }, all).length;
  $('#sInfo').textContent = `${draft.rows}×${draft.cols} = ${draft.rows * draft.cols} slots por página · ${totalSlots(draft)} no total.` +
    (hidden ? ` ${hidden} carta(s) ficarão fora da grade, mas continuam guardadas e voltam se você aumentar o álbum.` : '');
}

function wireSettings() {
  $('#sGame').innerHTML = Object.entries(GAMES).map(([k, g]) => `<option value="${k}">${g.label}</option>`).join('');
  $('#presets').innerHTML = PRESETS.map(p => `<button type="button" data-p="${p.rows},${p.cols},${p.pages}">${p.rows}×${p.cols} · ${p.pages} págs.</button>`).join('');
  $('#presets').onclick = e => {
    const b = e.target.closest('button');
    if (!b) return;
    [$('#sRows').value, $('#sCols').value, $('#sPages').value] = b.dataset.p.split(',');
    updateSetInfo();
  };
  ['#sRows', '#sCols', '#sPages'].forEach(s => $(s).addEventListener('input', updateSetInfo));
  // A cor aparece no álbum enquanto você escolhe; se cancelar, volta à cor salva.
  let draftColor = state.album?.color || DEFAULT_COLOR, saved = false;
  const picker = createColorPicker($('#colorPicker'), {
    onChange: hex => { draftColor = hex; applyTheme($('#book'), hex); },
  });
  $('#btnSettings').onclick = () => {
    const a = state.album;
    $('#sName').value = a.name; $('#sGame').value = a.game || 'pokemon'; $('#sRows').value = a.rows; $('#sCols').value = a.cols; $('#sPages').value = a.pages;
    draftColor = a.color; saved = false;
    picker.set(a.color);
    updateSetInfo();
    $('#dlgSet').showModal();
  };
  $('#dlgSet').addEventListener('close', () => { if (!saved) applyTheme($('#book'), state.album.color); });
  $('#sCancel').onclick = () => $('#dlgSet').close();
  $('#formSet').addEventListener('submit', async e => {
    if (e.submitter?.id !== 'sSave') return;
    saved = true;
    const layout = sanitizeLayout({ rows: $('#sRows').value, cols: $('#sCols').value, pages: $('#sPages').value });
    state.album = { ...state.album, name: $('#sName').value.trim() || 'Meu Álbum', game: $('#sGame').value, color: draftColor, ...layout };
    await db.put('albums', state.album);
    state.albums = state.albums.map(a => (a.id === state.album.id ? state.album : a));
    draw();
    book.goTo(Math.min(book.spread, sheetCount(layout.pages)));
    toast('Álbum atualizado');
  });
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
  });
  app.form = form;
  const search = initSearch({ onPick: data => form.fill(data), getGame: () => state.album.game });
  app.onSlot = slot => {
    const rec = state.slots.get(slot.key);
    form.open(slot, rec && state.cards.get(rec.cardId), { beforeOpen: search.reset });
  };
}

/* ---------- Seções: Álbum, Coleção, Wishlist ---------- */
const VIEWS = { album: '', collection: '#colecao', wishlist: '#wishlist' };
let view = 'album';

async function showView(name) {
  view = name;
  for (const v of Object.keys(VIEWS)) $(`#view${v[0].toUpperCase()}${v.slice(1)}`).hidden = v !== name;
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.view === name));
  $('#albumTools').hidden = name !== 'album';
  history.replaceState(null, '', VIEWS[name] || location.pathname);
  if (name === 'album') book.layout();
  if (name === 'collection') await renderCollectionView();
  if (name === 'wishlist') await renderWishlistView();
}

async function renderCollectionView() {
  const [albums, slots, cards] = await Promise.all([db.all('albums'), db.all('slots'), db.all('cards')]);
  renderCollection($('#viewCollection'), { albums, slots, cards, onGoto: gotoCard });
}

/** Abre o álbum e a página onde a carta está. */
async function gotoCard(albumId, page) {
  if (albumId !== state.album.id) await switchAlbum(albumId);
  await showView('album');
  book.goTo(spreadForPage(page));
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
    condition: 'NM (Near Mint)', qty: 1, price: item.price ?? null, notes: item.notes || '',
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
  book.goTo(spreadForPage(free.page));
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

/* ---------- Início ---------- */
async function main() {
  book = createBook($('#stage'), { onSpread, onSlot: slot => app.onSlot?.(slot), onMove: moveCard });
  await loadAlbum();
  wireNav(); wireAlbums(); wireSettings(); wireCards(); wireBackup(); wireViews();
  draw();
  const start = Object.entries(VIEWS).find(([, h]) => h && h === location.hash)?.[0];
  if (start) await showView(start);
}

// Uso offline: registra o service worker (só em http/https).
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

// Pontos de extensão usados pelos próximos módulos (cadastro de carta etc.).
export const app = { state, draw, updateStat, reload: loadAlbum, get book() { return book; }, onSlot: null, form: null };
main();
