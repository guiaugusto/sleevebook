// Seletor de cor: roda (matiz × saturação), luminosidade, hexadecimal e cores prontas.
import { hslToRgb, hslToHex, hexToHsl, normalizeHex, deriveTheme, SWATCHES, DEFAULT_COLOR, INK_LIGHT } from './color.js';
import { esc } from './util.js';

const SIZE = 320, RADIUS = SIZE / 2 - 4;

export function createColorPicker(root, { color = DEFAULT_COLOR, onChange } = {}) {
  root.classList.add('colorpicker');
  root.innerHTML = `
    <canvas class="wheel" width="${SIZE}" height="${SIZE}" aria-label="Roda de cores: clique ou arraste para escolher"></canvas>
    <div class="cside">
      <label>Luminosidade</label><input type="range" class="cL" min="15" max="85">
      <label>Hexadecimal</label><input type="text" class="cHex" maxlength="7" spellcheck="false" autocomplete="off">
      <div class="sw" aria-label="Cores prontas">${SWATCHES.map(c => `<button type="button" style="background:${c}" data-c="${c}" aria-label="Cor ${c}"></button>`).join('')}</div>
    </div>
    <p class="cnote hint"></p>`;
  const canvas = root.querySelector('.wheel'), ctx = canvas.getContext('2d');
  const range = root.querySelector('.cL'), input = root.querySelector('.cHex'), note = root.querySelector('.cnote');
  let H = 0, S = 0, L = 0;

  const clampL = () => Math.min(85, Math.max(15, L));

  function drawWheel() {
    const img = ctx.createImageData(SIZE, SIZE), l = clampL();
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
      const dx = x - SIZE / 2, dy = y - SIZE / 2, r = Math.hypot(dx, dy);
      if (r > RADIUS + 1) continue;
      let h = Math.atan2(dy, dx) * 180 / Math.PI;
      if (h < 0) h += 360;
      const [R, G, B] = hslToRgb(h, Math.min(100, r / RADIUS * 100), l), i = (y * SIZE + x) * 4;
      img.data[i] = R; img.data[i + 1] = G; img.data[i + 2] = B; img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    const a = H * Math.PI / 180, mx = SIZE / 2 + Math.cos(a) * S / 100 * RADIUS, my = SIZE / 2 + Math.sin(a) * S / 100 * RADIUS;
    ctx.lineWidth = 4; ctx.strokeStyle = '#fff'; ctx.beginPath(); ctx.arc(mx, my, 11, 0, 7); ctx.stroke();
    ctx.lineWidth = 2; ctx.strokeStyle = '#000'; ctx.beginPath(); ctx.arc(mx, my, 13, 0, 7); ctx.stroke();
  }

  function update(fromInput = false, silent = false) {
    const hex = hslToHex(H, S, L), t = deriveTheme(hex);
    if (!fromInput) input.value = hex;
    input.classList.remove('bad');
    range.value = Math.round(clampL());
    note.textContent = `Capa ${t.base} · texto ${t.ink === INK_LIGHT ? 'branco' : 'escuro'} (contraste ${t.contrast.toFixed(1)}:1). Papel e bolsos recebem só um leve tom da cor, para as cartas continuarem em destaque.`;
    drawWheel();
    if (!silent) onChange?.(hex);
  }

  function setHex(hex, silent) {
    [H, S, L] = hexToHsl(hex);
    update(false, silent);
  }

  function pick(e) {
    const r = canvas.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width * SIZE - SIZE / 2, y = (e.clientY - r.top) / r.height * SIZE - SIZE / 2;
    H = Math.atan2(y, x) * 180 / Math.PI; if (H < 0) H += 360;
    S = Math.min(100, Math.hypot(x, y) / RADIUS * 100);
    update();
  }
  canvas.addEventListener('pointerdown', e => { canvas.setPointerCapture(e.pointerId); pick(e); });
  canvas.addEventListener('pointermove', e => { if (e.buttons) pick(e); });
  range.addEventListener('input', () => { L = +range.value; update(); });
  input.addEventListener('input', () => {
    const hex = normalizeHex(input.value);
    input.classList.toggle('bad', !hex);
    if (hex) { [H, S, L] = hexToHsl(hex); update(true); }
  });
  root.querySelector('.sw').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (b) setHex(b.dataset.c);
  });

  setHex(normalizeHex(color) ?? DEFAULT_COLOR, true);
  return { set: hex => setHex(normalizeHex(hex) ?? DEFAULT_COLOR, true), get value() { return hslToHex(H, S, L); } };
}
