// Modal de cadastro de carta: abre para um slot, devolve a carta salva ou a remoção.
import { $ } from './util.js';
import { describeSlot } from './grid.js';

export const CONDITIONS = ['M (Mint)', 'NM (Near Mint)', 'LP (Lightly Played)', 'MP (Moderately Played)', 'HP (Heavily Played)', 'DMG (Damaged)'];

/** Reduz uma imagem enviada para caber confortavelmente no IndexedDB (lado maior de 480px, JPEG). */
export function shrinkImage(file, max = 480) {
  return new Promise((resolve, reject) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const cv = document.createElement('canvas');
      cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
      URL.revokeObjectURL(url);
      resolve(cv.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Não foi possível ler a imagem.')); };
    img.src = url;
  });
}

/** Lê o formulário e devolve os campos da carta. */
export function readCardFields() {
  return {
    name: $('#cName').value.trim(),
    set: $('#cSet').value.trim(),
    number: $('#cNum').value.trim(),
    condition: $('#cCond').value,
    qty: Math.max(1, parseInt($('#cQty').value, 10) || 1),
    price: $('#cPrice').value === '' ? null : Math.max(0, parseFloat($('#cPrice').value) || 0),
    notes: $('#cNotes').value.trim(),
  };
}

export function initCardForm({ onSave, onDelete }) {
  let slot = null, existing = null, image = '';

  const preview = () => { $('#cPrev').style.backgroundImage = image ? `url("${image}")` : 'none'; };

  $('#cCond').innerHTML = CONDITIONS.map(c => `<option>${c}</option>`).join('');
  $('#cImg').addEventListener('input', e => { image = e.target.value.trim(); preview(); });
  $('#cFile').addEventListener('change', async e => {
    const f = e.target.files[0];
    if (!f) return;
    try { image = await shrinkImage(f); $('#cImg').value = ''; preview(); }
    catch (err) { alert(err.message); }
  });

  $('#formCard').addEventListener('submit', e => {
    if (e.submitter?.id !== 'cSave') return;
    onSave(slot, { ...(existing || {}), ...readCardFields(), image, source: existing?.source || 'manual', sourceId: existing?.sourceId || null,
      setTotal: existing?.setTotal ?? null });
  });
  $('#cDel').onclick = () => { $('#dlgCard').close(); onDelete(slot, existing); };
  $('#cCancel').onclick = () => $('#dlgCard').close();

  return {
    /** Preenche o formulário com a carta do slot (ou vazio) e abre. */
    open(s, card, extra = {}) {
      slot = s; existing = card || null; image = card?.image || '';
      $('#cardTitle').textContent = `${card ? 'Editar carta' : 'Nova carta'} · ${describeSlot(s)}`;
      $('#cName').value = card?.name || ''; $('#cSet').value = card?.set || ''; $('#cNum').value = card?.number || '';
      $('#cCond').value = card?.condition || CONDITIONS[1]; $('#cQty').value = card?.qty || 1;
      $('#cPrice').value = card?.price ?? ''; $('#cNotes').value = card?.notes || ''; $('#cFile').value = '';
      $('#cImg').value = image.startsWith('data:') ? '' : image;
      preview();
      $('#cDel').hidden = !card;
      extra.beforeOpen?.();
      $('#dlgCard').showModal();
      $('#cName').focus();
    },
    /** Usado pela busca (próximo PR) para preencher os campos a partir de um resultado. */
    fill(data) {
      if (data.name != null) $('#cName').value = data.name;
      if (data.set != null) $('#cSet').value = data.set;
      if (data.number != null) $('#cNum').value = data.number;
      if (data.price != null) $('#cPrice').value = data.price;
      if (data.image != null) { image = data.image; $('#cImg').value = image; preview(); }
      existing = { ...(existing || {}), source: data.source ?? existing?.source, sourceId: data.sourceId ?? existing?.sourceId, setTotal: data.setTotal ?? existing?.setTotal };
    },
  };
}
