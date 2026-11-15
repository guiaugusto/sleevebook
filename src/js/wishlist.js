// Wishlist: lista de cartas que você quer, com prioridade, e atalho para colocar no álbum.
import { $, esc, uid } from './util.js';
import { initSearch } from './search.js';

export const PRIORITIES = { 1: 'Alta', 2: 'Média', 3: 'Baixa' };
const PILL = { 1: 'bad', 2: 'warn', 3: 'muted' };

export const sortWishlist = items => [...items].sort((a, b) => (a.priority ?? 2) - (b.priority ?? 2) || a.name.localeCompare(b.name, 'pt'));

export function renderWishlist(root, { items, onAdd, onEdit, onMove }) {
  const list = sortWishlist(items);
  root.innerHTML = `<div class="wrap">
    <div class="wl-head"><div><h2>Wishlist</h2><p class="stat">${list.length ? `${list.length} carta(s) que você quer` : 'Cartas que você quer ter. Quando conseguir, coloque no álbum com um clique.'}</p></div>
      <button type="button" class="primary" id="wlAdd">＋ Adicionar</button></div>
    <div class="wl">${list.map(i => `<article class="wcard">
      ${i.image ? `<img src="${esc(i.image)}" alt="" loading="lazy">` : '<span class="noimg"></span>'}
      <div class="winfo"><b>${esc(i.name)}</b><span class="stat">${esc(i.set)} ${esc(i.number)}</span>
        <span class="pill ${PILL[i.priority] || 'warn'}">Prioridade ${PRIORITIES[i.priority] || 'Média'}</span>
        ${i.notes ? `<small>${esc(i.notes)}</small>` : ''}</div>
      <div class="wact"><button type="button" class="primary" data-move="${i.id}">Colocar no álbum</button><button type="button" data-edit="${i.id}">Editar</button></div>
    </article>`).join('')}</div></div>`;
  $('#wlAdd', root).onclick = onAdd;
  root.onclick = e => {   // atribuição (e não addEventListener) para não acumular ouvintes a cada render
    const m = e.target.closest('[data-move]'), ed = e.target.closest('[data-edit]');
    if (m) onMove(items.find(i => i.id === m.dataset.move));
    if (ed) onEdit(items.find(i => i.id === ed.dataset.edit));
  };
}

/** Diálogo de adicionar/editar item da wishlist. */
export function initWishlistDialog({ onSave, onDelete, getGame }) {
  let item = null, extra = {};
  const search = initSearch({
    getGame,
    ids: { box: '#wSearchBox', input: '#wqSearch', list: '#wqResults', status: '#wqStatus', game: '#wqGame' },
    onPick: data => {
      $('#wName').value = data.name; $('#wSet').value = data.set; $('#wNum').value = data.number;
      extra = { image: data.image, source: data.source, sourceId: data.sourceId, setTotal: data.setTotal, price: data.price };
    },
  });
  $('#formWish').addEventListener('submit', e => {
    if (e.submitter?.id !== 'wSave') return;
    onSave({
      ...(item || {}), ...extra, id: item?.id || uid(),
      name: $('#wName').value.trim(), set: $('#wSet').value.trim(), number: $('#wNum').value.trim(),
      priority: +$('#wPrio').value, notes: $('#wNotes').value.trim(),
    });
  });
  $('#wDel').onclick = () => { $('#dlgWish').close(); onDelete(item); };
  $('#wCancel').onclick = () => $('#dlgWish').close();
  return {
    open(existing) {
      item = existing || null; extra = {};
      $('#wTitle').textContent = item ? 'Editar item' : 'Quero esta carta';
      $('#wName').value = item?.name || ''; $('#wSet').value = item?.set || ''; $('#wNum').value = item?.number || '';
      $('#wPrio').value = String(item?.priority || 2); $('#wNotes').value = item?.notes || '';
      $('#wDel').hidden = !item;
      search.reset();
      $('#dlgWish').showModal();
      $('#wName').focus();
    },
  };
}
