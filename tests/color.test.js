import { test, eq, ok } from './run.js';
import { normalizeHex, hexToHsl, hslToHex, contrast, deriveTheme, DEFAULT_COLOR, INK_LIGHT, INK_DARK } from '../src/js/color.js';

test('normalizeHex aceita formatos comuns', () => {
  eq(normalizeHex('#ABCDEF'), '#abcdef');
  eq(normalizeHex('abcdef'), '#abcdef');
  eq(normalizeHex('#fa0'), '#ffaa00');
});
test('normalizeHex rejeita lixo', () => {
  eq(normalizeHex('#12345'), null);
  eq(normalizeHex('azul'), null);
  eq(normalizeHex(''), null);
});
test('hex ↔ hsl faz ida e volta', () => {
  for (const c of ['#2c3e8f', '#8f2c3e', '#1f7a5a', '#ffffff', '#000000', '#c2570c']) {
    const [h, s, l] = hexToHsl(c);
    const back = hslToHex(h, s, l);
    const d = [1, 3, 5].map(i => Math.abs(parseInt(c.substr(i, 2), 16) - parseInt(back.substr(i, 2), 16)));
    ok(Math.max(...d) <= 1, `${c} → ${back}`);
  }
});
test('contraste de preto e branco é 21', () => {
  ok(Math.abs(contrast('#000000', '#ffffff') - 21) < 0.01);
});
test('texto da capa é branco em cor escura e escuro em cor clara', () => {
  eq(deriveTheme('#222831').ink, INK_LIGHT);
  eq(deriveTheme('#f5e663').ink, INK_DARK);
});
test('texto da capa tem contraste de pelo menos 4.5 em cores comuns', () => {
  for (const c of ['#2c3e8f', '#8f2c3e', '#1f7a5a', '#6b3fa0', '#c2570c', '#b8860b', '#0f7c8a', '#ff0000', '#00ff00', '#ffff00', '#808080'])
    ok(deriveTheme(c).contrast >= 4.5, `${c}: ${deriveTheme(c).contrast.toFixed(2)}`);
});
test('fichário: páginas e capa de dentro são da cor do álbum (mesma matiz), em tons próximos', () => {
  for (const c of ['#2c3e8f', '#8f2c3e', '#1f7a5a', '#c2570c']) {
    const t = deriveTheme(c), [h, s, l] = hexToHsl(c);
    for (const tone of [t.page, t.inside]) {
      const [h2, s2, l2] = hexToHsl(tone);
      ok(Math.abs(h2 - h) < 6 || Math.abs(h2 - h) > 354, `${c}: matiz ${h.toFixed(0)} → ${h2.toFixed(0)}`);
      ok(Math.abs(l2 - l) <= 12, `${c}: luminosidade ${l.toFixed(0)} → ${l2.toFixed(0)}`);
    }
    ok(t.page !== c && t.inside !== t.page, 'tons diferentes entre si');
  }
});
test('fichário: cores muito escuras e muito claras continuam com tons válidos', () => {
  for (const c of ['#000000', '#ffffff', '#101010', '#f0f0f0']) {
    const t = deriveTheme(c);
    ok(/^#[0-9a-f]{6}$/.test(t.page) && /^#[0-9a-f]{6}$/.test(t.inside), c);
  }
});
test('cor inválida cai na cor padrão', () => {
  eq(deriveTheme('xyz').base, DEFAULT_COLOR);
});
