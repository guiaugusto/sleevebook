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
test('papel e bolsos ficam claros mesmo com cor saturada', () => {
  const t = deriveTheme('#ff0000');
  ok(hexToHsl(t.paper)[2] > 88 && hexToHsl(t.pocket)[2] > 78);
  ok(hexToHsl(t.paper)[1] <= 25, 'saturação do papel limitada');
});
test('cor inválida cai na cor padrão', () => {
  eq(deriveTheme('xyz').base, DEFAULT_COLOR);
});
