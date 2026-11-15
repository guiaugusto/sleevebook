import { test, eq, ok } from './run.js';
import { buildPayload, parsePayload, encodePayload, decodePayload, buildShareLink, readShareLink, shareFromHash, safeImage, SHARE_VERSION } from '../src/js/share.js';

const album = { id: 'a1', name: 'Meu Fichário', game: 'pokemon', rows: 3, cols: 3, pages: 40, color: '#2c3e8f' };
const card = (id, extra = {}) => ({ id, name: 'Turtwig', set: 'MEP Black Star Promos', number: '040', setTotal: null, source: 'pokemon', sourceId: 'mep-040', language: 'en',
  condition: 'NM (Near Mint)', qty: 1, owned: true, image: 'https://assets.tcgdex.net/en/me/mep/040/high.webp', ...extra });
const slot = (cardId, page, row, col) => ({ key: `a1:${page}:${row}:${col}`, albumId: 'a1', page, row, col, cardId });
let n = 0;
const ids = () => `id${++n}`;

test('compartilhar: ida e volta preserva álbum, cartas e posições', async () => {
  const cards = [card('c1'), card('c2', { name: 'Pikachu', owned: false, qty: 3, condition: 'M (Mint)', foil: 'holo', imageFallback: 'en', language: 'pt' })];
  const slots = [slot('c1', 1, 0, 0), slot('c2', 7, 2, 1)];
  const link = await buildShareLink('https://x.test/', album, slots, cards);
  const got = await readShareLink(link.slice(link.indexOf('#')), { newId: ids });
  eq(got.album.name, 'Meu Fichário'); eq([got.album.rows, got.album.cols, got.album.pages, got.album.color], [3, 3, 40, '#2c3e8f']);
  eq(got.cards.length, 2); eq(got.slots.map(s => [s.page, s.row, s.col]), [[1, 0, 0], [7, 2, 1]]);
  const [a, b] = got.cards;
  eq([a.name, a.set, a.number, a.sourceId, a.owned, a.condition, a.qty], ['Turtwig', 'MEP Black Star Promos', '040', 'mep-040', true, 'NM (Near Mint)', 1]);
  eq([b.owned, b.qty, b.condition, b.foil, b.imageFallback, b.language], [false, 3, 'M (Mint)', 'holo', 'en', 'pt']);
  ok(got.album.id !== 'a1' && got.cards.every(c => c.id.startsWith('id')), 'ids novos');
  eq(got.slots.every(s => s.key.startsWith(got.album.id + ':') && got.cards.some(c => c.id === s.cardId)), true);
});
test('compartilhar: endereço de imagem do TCGdex vai abreviado e volta idêntico', () => {
  const cards = [card('c1'), card('c2', { language: 'pt', sourceId: 'sv05-010', image: 'https://assets.tcgdex.net/pt/sv/sv05/010/high.webp' }),
    card('c3', { language: 'pt', imageFallback: 'en', sourceId: 'sv05-011', image: 'https://assets.tcgdex.net/en/sv/sv05/011/high.webp' }),
    card('c4', { sourceId: 'x-1', image: 'https://images.scrydex.com/pokemon/sv5-10/small' }),
    card('c5', { sourceId: 'sv05-012', image: 'https://assets.tcgdex.net/en/sv/sv99/012/high.webp' })];
  const slots = cards.map((c, i) => slot(c.id, 1, Math.floor(i / 3), i % 3));
  const p = buildPayload(album, slots, cards);
  eq(p.s.map(r => r[15]), ['~me', '~sv', '~sv', 'https://images.scrydex.com/pokemon/sv5-10/small', 'https://assets.tcgdex.net/en/sv/sv99/012/high.webp']);
  eq(parsePayload(p, { newId: ids }).cards.map(c => c.image), cards.map(c => c.image));
});
test('compartilhar: forma abreviada sem sourceId não vira endereço', () => {
  const p = { v: 1, a: { n: 'x', r: 3, c: 3, p: 4 }, s: [[1, 0, 0, 'A', '', '', '', 'pokemon', '', 'en', 1, '', '', '', '', '~sv']] };
  eq(parsePayload(p, { newId: ids }).cards[0].image, '');
});
test('compartilhar: notas só vão se pedido e fotos enviadas ficam de fora', async () => {
  const cards = [card('c1', { notes: 'comprada na feira', image: 'data:image/jpeg;base64,AAAA' })];
  const slots = [slot('c1', 1, 0, 0)];
  const without = parsePayload(buildPayload(album, slots, cards), { newId: ids });
  const withNotes = parsePayload(buildPayload(album, slots, cards, { includeNotes: true }), { newId: ids });
  eq([without.cards[0].notes, without.cards[0].image], ['', '']);
  eq(withNotes.cards[0].notes, 'comprada na feira');
});
test('compartilhar: cartas fora da grade não entram', () => {
  const p = buildPayload({ ...album, rows: 2, cols: 2 }, [slot('c1', 1, 2, 2), slot('c1', 1, 0, 0)], [card('c1')]);
  eq(p.s.length, 1);
});
test('compartilhar: o link é bem menor que o JSON de backup', async () => {
  const cards = [], slots = [];
  for (let i = 0; i < 360; i++) {
    cards.push(card('c' + i, { name: 'Carta ' + i, number: String(i), sourceId: 'sv05-' + String(i).padStart(3, '0'), image: `https://assets.tcgdex.net/en/sv/sv05/${String(i).padStart(3, '0')}/high.webp` }));
    slots.push(slot('c' + i, 1 + Math.floor(i / 9), Math.floor((i % 9) / 3), i % 3));
  }
  const code = await encodePayload(buildPayload({ ...album, pages: 40 }, slots, cards));
  ok(code.length < JSON.stringify({ album, cards, slots }).length / 4, `link com ${code.length} caracteres`);
  ok(code.length < 20000, `link com ${code.length} caracteres`);
});
test('compartilhar: links inválidos dão erro amigável', async () => {
  for (const bad of ['', 'abc', '!!!', 'AAAAAAAA', 'x'.repeat(50)]) {
    let msg = '';
    try { await decodePayload(bad); } catch (e) { msg = e.message; }
    ok(msg.startsWith('Não foi possível ler este link'), `"${bad}" → ${msg}`);
  }
  let msg = '';
  try { await readShareLink('#colecao'); } catch (e) { msg = e.message; }
  ok(msg.includes('não é um link'));
});
test('compartilhar: JSON que não é álbum, ou de versão futura, é recusado', async () => {
  for (const p of [null, {}, { v: 1 }, { v: 1, a: {}, s: 'x' }, { a: {}, s: [] }, { v: SHARE_VERSION + 1, a: {}, s: [] }]) {
    let err = null;
    try { parsePayload(p); } catch (e) { err = e; }
    ok(err, JSON.stringify(p));
  }
});
test('compartilhar: dados maliciosos são limpos ou descartados', () => {
  const p = { v: 1, a: { n: '<img src=x onerror=alert(1)>'.repeat(10), g: 'hack', r: 99, c: -3, p: 99999, k: 'red;background:url(x)' }, s: [
    [1, 0, 0, 'Ok', 'Set', '1', 'abc', 'evil', '../../x', 'e n', 1, -5, 99, 'foil!', 'n', 'javascript:alert(1)'],
    [1, 0, 0, 'Duplicada na mesma posição'],
    [9999, 0, 0, 'Página fora'],
    [1, 'a', 0, 'Posição inválida'],
    [1, 2, 0, ''],
    'não é lista',
    [1, 1, 0, 'x'.repeat(500), '', '', '', '', '', '', 1, 1e9, '', '', 'y'.repeat(900), 'https://evil.test/p.png'],
  ] };
  const { album: a, cards, slots } = parsePayload(p, { newId: ids });
  eq([a.game, a.rows, a.cols, a.pages], ['pokemon', 6, 1, 500]);
  ok(a.name.length <= 60 && /^#[0-9a-f]{6}$/.test(a.color), 'nome e cor limitados');
  eq(cards.length, 2); eq(slots.length, 2);
  const [c1, c2] = cards;
  eq([c1.source, c1.sourceId, c1.setTotal, c1.qty, c1.condition, c1.foil, c1.image, c1.language], ['manual', null, null, 1, 'NM (Near Mint)', undefined, '', undefined]);
  eq([c2.name.length, c2.qty, c2.notes.length, c2.image], [100, 9999, 500, '']);
});
test('compartilhar: só aceita imagens https dos provedores conhecidos', () => {
  eq(safeImage('https://assets.tcgdex.net/en/me/mep/040/high.webp'), 'https://assets.tcgdex.net/en/me/mep/040/high.webp');
  for (const bad of ['http://assets.tcgdex.net/a.png', 'https://evil.test/a.png', 'data:image/png;base64,AAA', 'javascript:alert(1)', 'https://assets.tcgdex.net.evil.test/a.png', '', null, 'https://assets.tcgdex.net/' + 'a'.repeat(400)])
    eq(safeImage(bad), '', String(bad));
});
test('compartilhar: reconhece só o hash de compartilhamento', () => {
  eq(shareFromHash('#compartilhar=abc'), 'abc'); eq(shareFromHash('#album'), null); eq(shareFromHash(''), null);
});
test('compartilhar: link comprimido grande demais é recusado sem travar', async () => {
  const big = await encodePayload({ v: 1, a: {}, s: [], lixo: 'a'.repeat(3_000_000) });   // descomprime para mais de 2 MB
  let msg = '';
  try { await decodePayload(big); } catch (e) { msg = e.message; }
  ok(msg.startsWith('Não foi possível'), msg);
});
