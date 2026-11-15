// Tela "Coleção": resumo, progresso por álbum e por set, e lista pesquisável de todas as cartas.
import { esc } from './util.js';
import { CONDITIONS } from './cardform.js';
import { buildRows, filterRows, sortRows, summarize, albumProgress, isOwned } from './stats.js';

const MAX_ROWS = 300;

const bar = pct => `<div class="bar2" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${pct}%"></i></div>`;

export function renderCollection(root, { albums, slots, cards, onGoto }) {
  const rows = buildRows(albums, slots, cards);
  const sum = summarize(rows, albums);
  const prog = albumProgress(albums, slots, cards);

  root.innerHTML = `<div class="wrap">
    <div class="tiles">
      <div class="tile"><b>${sum.owned}</b><span>cartas que tenho</span></div>
      <div class="tile"><b>${sum.wanted}</b><span>ainda faltam</span></div>
      <div class="tile"><b>${sum.copies}</b><span>cópias no total</span></div>
      <div class="tile"><b>${sum.albums}</b><span>${sum.albums === 1 ? 'álbum' : 'álbuns'}</span></div>
    </div>
    <div class="grid2">
      <section class="panel"><h3>Álbuns</h3>${prog.map(p => `<div class="prow"><span>${esc(p.album.name)}</span><span class="stat">${p.owned} de ${p.chosen} cartas · ${p.pct}%</span>${bar(p.pct)}</div>`).join('')}</section>
      <section class="panel"><h3>Progresso por set</h3>${sum.sets.length
        ? sum.sets.slice(0, 12).map(s => `<div class="prow"><span>${esc(s.set)}</span><span class="stat">${s.owned}/${s.total} · ${s.pct}%</span>${bar(s.pct)}</div>`).join('')
        : '<p class="hint">Aparece quando você cadastra cartas escolhidas pela busca, que informam o total do set, e marca que tem.</p>'}</section>
    </div>
    <section class="panel">
      <h3>Todas as cartas</h3>
      <div class="filters">
        <input type="search" id="fQ" placeholder="Buscar por nome, set ou número" aria-label="Buscar">
        <select id="fStatus" aria-label="Situação"><option value="">Tenho e faltam</option><option value="owned">Só as que tenho</option><option value="wanted">Só as que faltam</option></select>
        <select id="fAlbum" aria-label="Álbum"><option value="">Todos os álbuns</option>${albums.map(a => `<option value="${a.id}">${esc(a.name)}</option>`).join('')}</select>
        <select id="fSort" aria-label="Ordenar"><option value="location">Por posição</option><option value="name">Por nome</option><option value="recent">Mais recentes</option></select>
      </div>
      <p class="hint" id="fCount" aria-live="polite"></p>
      <div class="scroll-x"><table class="list"><thead><tr><th></th><th>Carta</th><th>Set</th><th>Situação</th><th>Cond.</th><th>Qtd.</th><th>Onde está</th></tr></thead><tbody id="fBody"></tbody></table></div>
    </section></div>`;

  const q = root.querySelector('#fQ'), fs = root.querySelector('#fStatus'), fa = root.querySelector('#fAlbum'), fo = root.querySelector('#fSort');
  const body = root.querySelector('#fBody'), count = root.querySelector('#fCount');

  function table() {
    const list = sortRows(filterRows(rows, { q: q.value, albumId: fa.value, status: fs.value }), fo.value);
    count.textContent = rows.length
      ? `${list.length} de ${rows.length} carta(s)${list.length > MAX_ROWS ? `. Mostrando as primeiras ${MAX_ROWS}; refine a busca.` : ''}`
      : 'Nenhuma carta cadastrada ainda. Abra um álbum e clique em um slot para cadastrar.';
    body.innerHTML = list.slice(0, MAX_ROWS).map(r => {
      const c = r.card, own = isOwned(c);
      return `<tr class="${own ? '' : 'missing-row'}">
        <td>${c.image ? `<img class="thumb ${own ? '' : 'gray'}" src="${esc(c.image)}" alt="" loading="lazy">` : '<span class="thumb"></span>'}</td>
        <td><b>${esc(c.name)}</b>${c.notes ? `<small>${esc(c.notes)}</small>` : ''}</td>
        <td>${esc(c.set)} ${esc(c.number)}${c.language && c.language !== 'en' ? ` <span class="lang">${esc(c.language.toUpperCase())}</span>` : ''}</td>
        <td><span class="pill ${own ? 'have' : 'muted'}">${own ? 'Tenho' : 'Falta'}</span></td>
        <td>${own ? esc((c.condition || '').split(' ')[0]) : '<span class="stat">—</span>'}</td>
        <td>${own ? (c.qty || 1) : '<span class="stat">—</span>'}</td>
        <td><button type="button" class="link" data-album="${r.album.id}" data-page="${r.slot.page}">${esc(r.location)}</button></td></tr>`;
    }).join('');
  }
  [q, fs, fa, fo].forEach(el => el.addEventListener('input', table));
  body.addEventListener('click', e => {
    const b = e.target.closest('button[data-album]');
    if (b) onGoto(b.dataset.album, +b.dataset.page);
  });
  table();
}
