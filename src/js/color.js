// Cores do álbum: a partir de UMA cor base derivamos capa, texto, papel e bolsos (ADR 0003).

export const HEX_RE = /^#[0-9a-f]{6}$/i;

/** Normaliza "abc", "#abc" ou "AABBCC" para "#aabbcc". Retorna null se inválido. */
export function normalizeHex(input) {
  let v = String(input ?? '').trim().toLowerCase();
  if (v[0] !== '#') v = '#' + v;
  if (/^#[0-9a-f]{3}$/.test(v)) v = '#' + [...v.slice(1)].map(c => c + c).join('');
  return HEX_RE.test(v) ? v : null;
}

/** h: 0-360, s e l: 0-100 → [r, g, b] 0-255 */
export function hslToRgb(h, s, l) {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = n => {
    const k = (n + h / 30) % 12;
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return [f(0), f(8), f(4)];
}

export function hslToHex(h, s, l) {
  return '#' + hslToRgb(h, s, l).map(v => v.toString(16).padStart(2, '0')).join('');
}

/** "#rrggbb" → [h 0-360, s 0-100, l 0-100] */
export function hexToHsl(hex) {
  const r = parseInt(hex.substr(1, 2), 16) / 255;
  const g = parseInt(hex.substr(3, 2), 16) / 255;
  const b = parseInt(hex.substr(5, 2), 16) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, l = (mx + mn) / 2;
  let h = 0, s = 0;
  if (d) {
    s = d / (1 - Math.abs(2 * l - 1));
    h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, s * 100, l * 100];
}

/** Luminância relativa (WCAG) */
export function luminance(hex) {
  const c = [1, 3, 5].map(i => {
    const v = parseInt(hex.substr(i, 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

/** Razão de contraste (WCAG) entre duas cores, de 1 a 21 */
export function contrast(a, b) {
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

export const INK_LIGHT = '#ffffff';
export const INK_DARK = '#14161f';
export const DEFAULT_COLOR = '#2c3e8f';
export const SWATCHES = ['#2c3e8f', '#8f2c3e', '#1f7a5a', '#6b3fa0', '#c2570c', '#222831', '#b8860b', '#0f7c8a'];

/** Muda a luminosidade de uma cor, mantendo matiz e saturação. */
function withLightness(hex, l) {
  const [h, s] = hexToHsl(hex);
  return hslToHex(h, s, Math.min(94, Math.max(5, l)));
}

/**
 * Tema completo do álbum a partir da cor base (um fichário: tudo é da cor dele).
 * - base: capa de fora.
 * - page: fundo das páginas, quase igual à capa (um tom que se afasta do extremo mais próximo).
 * - inside: capa de dentro, um pouco mais fechada que as páginas.
 * - ink: texto da capa, branco ou escuro conforme o contraste.
 */
export function deriveTheme(input) {
  const base = normalizeHex(input) ?? DEFAULT_COLOR;
  const l = hexToHsl(base)[2];
  const dark = l < 50;
  const ink = contrast(base, INK_LIGHT) >= contrast(base, INK_DARK) ? INK_LIGHT : INK_DARK;
  return {
    base,
    ink,
    contrast: contrast(base, ink),
    page: withLightness(base, dark ? l + 5 : l - 5),
    inside: withLightness(base, dark ? l - 4 : l - 10),
  };
}

/** Aplica o tema como variáveis CSS no elemento. */
export function applyTheme(el, input) {
  const t = deriveTheme(input);
  el.style.setProperty('--alb', t.base);
  el.style.setProperty('--alb-ink', t.ink);
  el.style.setProperty('--page', t.page);
  el.style.setProperty('--inside', t.inside);
  return t;
}
