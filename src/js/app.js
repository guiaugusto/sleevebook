// Orquestra o app: carrega dados, desenha o livro e liga os botões.
import { db, meta, exportAll, importAll, validateExport } from './store.js';
import { createBook } from './book.js';
import { applyTheme, DEFAULT_COLOR } from './color.js';
import { PRESETS, sanitizeLayout, spreadForPage, slotsInGrid, totalSlots, sheetCount } from './grid.js';
import { createColorPicker } from './wheel.js';
import { initCardForm } from './cardform.js';
import { initSearch } from './search.js';
import { GAMES } from './providers/index.js';
import { $, uid, toast, downloadJSON, slug } from './util.js';

const state = { album: null, slots: new Map(), cards: new Map() };
let book;

/* ---------- Dados ---------- */
function newAlbum(over = {}) {
  return { id: uid(), name: 'Meu Álbum', game: 'pokemon', rows: 3, cols: 3, pages: 20, color: DEFAULT_COLOR, createdAt: Date.now(), ...over };
}

async function loadAlbum() {
  let albums = await db.all('albums');
  if (!albums.length) { const a = newAlbum(); await db.put('albums', a); albums = [a]; }
  const wanted = await meta.get('currentAlbum');
  state.album = albums.find(a => a.id === wanted) || albums[0];
  await meta.set('currentAlbum', state.album.id);
  const [slots, cards] = await Promise.all([db.byAlbum(state.album.id), db.all('cards')]);
  state.slots = new Map(slots.map(s => [s.key, s]));
  state.cards = new Map(cards.map(c => [c.id, c]));
}

function draw() {
  applyTheme($('#book'), state.album.color);
  book.render(state);
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
  book = createBook($('#stage'), { onSpread, onSlot: slot => app.onSlot?.(slot) });
  await loadAlbum();
  wireNav(); wireSettings(); wireCards(); wireBackup();
  draw();
}

// Pontos de extensão usados pelos próximos módulos (cadastro de carta etc.).
export const app = { state, draw, updateStat, reload: loadAlbum, get book() { return book; }, onSlot: null, form: null };
main();
