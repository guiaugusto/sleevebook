// Biblioteca: todos os fichários em pé, virados para a frente, numa prateleira. Clicar em um aproxima a capa
// (a capa "cresce" até o tamanho que ela tem no livro) e abre o álbum; voltar faz o caminho inverso.
import { esc } from './util.js';
import { applyTheme } from './color.js';
import { UNITS, pageUnits, pagesToSheets } from './grid.js';
import { isOwned } from './stats.js';

const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const libHeight = () => (innerWidth < 600 ? 190 : 250);

/** Tamanho da capa do fichário na prateleira, mantendo a proporção da capa dura real. */
export function coverMetrics(album, height = libHeight()) {
  const { W, H } = pageUnits(album.rows, album.cols);
  const u = height / (H + 2 * UNITS.HARD);
  return { u, width: (W + UNITS.HARD) * u, height };
}

/**
 * Desenha a prateleira. `onOpen(album, coverEl)` é chamado ao clicar num fichário; `onNew()` no cartão de criar.
 */
export function renderLibrary(root, { albums, slots, cards, onOpen, onNew }) {
  const cardById = new Map(cards.map(c => [c.id, c]));
  const stats = new Map(albums.map(a => [a.id, { owned: 0, wanted: 0 }]));
  for (const s of slots) {
    const st = stats.get(s.albumId), card = cardById.get(s.cardId);
    if (st && card) (isOwned(card) ? st.owned++ : st.wanted++);
  }

  const items = albums.map(a => {
    const m = coverMetrics(a), st = stats.get(a.id), sheets = pagesToSheets(a.pages);
    const cap = `${st.owned} ${st.owned === 1 ? 'carta' : 'cartas'}${st.wanted ? ` · ${st.wanted} faltam` : ''}`;
    return `<div class="shelfcell"><button type="button" class="libitem" data-id="${esc(a.id)}" aria-label="Abrir ${esc(a.name)}: ${esc(cap)}, ${sheets} folhas">
      <div class="libcover" data-id="${esc(a.id)}" style="--u:${m.u}px;--thick:${Math.min(14, Math.max(3, sheets * 0.35))}px;width:${m.width}px;height:${m.height}px">
        <div class="face front cover-out"><div class="cover-title">${esc(a.name)}</div></div>
      </div></button><span class="libcap">${esc(cap)} · ${sheets} folhas</span></div>`;
  }).join('');

  const newM = coverMetrics({ rows: 3, cols: 3 });
  root.innerHTML = `<div class="wrap shelfwrap">
    <div class="libhead"><h2>Biblioteca</h2><p class="stat">${albums.length} ${albums.length === 1 ? 'fichário' : 'fichários'}. Clique em um para abrir.</p></div>
    <div class="shelf">${items}
      <div class="shelfcell"><button type="button" class="libitem libnew" id="libNew" aria-label="Criar novo fichário">
        <div class="libcover newcover" style="width:${newM.width}px;height:${newM.height}px"><span>＋</span><b>Novo fichário</b></div></button>
        <span class="libcap">9 bolsos, 20 folhas</span></div>
    </div></div>`;

  // Cada capa recebe a cor do seu álbum (capa, texto, páginas e capa de dentro derivados de uma cor só).
  albums.forEach(a => applyTheme(root.querySelector(`.libcover[data-id="${CSS.escape(a.id)}"]`), a.color));

  root.querySelectorAll('.libitem[data-id]').forEach(btn => {
    btn.onclick = () => onOpen(albums.find(a => a.id === btn.dataset.id), btn.querySelector('.libcover'));
  });
  root.querySelector('#libNew').onclick = onNew;
}

/**
 * Faz uma cópia da capa voar de um retângulo da tela para outro (aproximar ou afastar). A cópia fica por cima de
 * tudo e é removida no fim. `uFrom` é o valor de `--u` da capa no tamanho de saída, para o texto escalar junto.
 */
export async function flyCover(sourceEl, fromRect, toRect, uFrom, { duration = 650 } = {}) {
  if (reduceMotion() || !sourceEl.animate) return;
  const el = sourceEl.cloneNode(true);
  Object.assign(el.style, {
    position: 'fixed', left: fromRect.left + 'px', top: fromRect.top + 'px', width: fromRect.width + 'px', height: fromRect.height + 'px',
    margin: '0', zIndex: '300', transformOrigin: '0 0', pointerEvents: 'none', transition: 'none',
  });
  el.style.setProperty('--u', uFrom + 'px');
  el.classList.add('flying');
  document.body.appendChild(el);
  const sx = toRect.width / fromRect.width, sy = toRect.height / fromRect.height;
  const anim = el.animate(
    [{ transform: 'translate(0,0) scale(1,1)' }, { transform: `translate(${toRect.left - fromRect.left}px,${toRect.top - fromRect.top}px) scale(${sx},${sy})` }],
    { duration, easing: 'cubic-bezier(.22,.8,.24,1)', fill: 'forwards' },
  );
  // Se a aba ficar em segundo plano, o navegador pausa a animação: não deixamos a tela presa esperando.
  try { await Promise.race([anim.finished, new Promise(r => setTimeout(r, duration + 600))]); } catch { /* animação cancelada */ }
  anim.cancel();
  el.remove();
}

/** Some/aparece o fundo (a biblioteca ou o álbum) durante o voo, para dar a sensação de aproximar ou afastar. */
export function fadeZoom(el, { out, duration = 520 }) {
  if (reduceMotion() || !el.animate) return null;
  const frames = out
    ? [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(1.14)' }]
    : [{ opacity: 0, transform: 'scale(1.14)' }, { opacity: 1, transform: 'scale(1)' }];
  return el.animate(frames, { duration, easing: 'ease-in-out', fill: 'forwards' });
}
