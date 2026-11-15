import { test, eq, ok } from './run.js';
import { sanitizeBackup, backupImage, BACKUP_LIMITS } from '../src/js/backup.js';

const album = (o = {}) => ({ id: 'a1', name: 'Meu', game: 'pokemon', rows: 3, cols: 3, pages: 40, color: '#2c3e8f', createdAt: 1, ...o });
const card = (id, o = {}) => ({ id, name: 'Turtwig', set: 'MEP', number: '040', setTotal: 100, image: 'https://assets.tcgdex.net/en/me/mep/040/high.webp', source: 'pokemon', sourceId: 'mep-040',
  language: 'en', foil: 'holo', imageFallback: 'en', condition: 'M (Mint)', qty: 3, notes: 'nota', owned: false, updatedAt: 5, price: 2.5, ...o });
const slot = (albumId, page, row, col, cardId) => ({ key: `${albumId}:${page}:${row}:${col}`, albumId, page, row, col, cardId });
const file = (o = {}) => ({ app: 'sleevebook', version: 1, exportedAt: '2026-11-15T00:00:00Z', albums: [album()], cards: [card('c1')], slots: [slot('a1', 1, 0, 0, 'c1')], wishlist: [{ id: 'w1', name: 'Pikachu', set: 'Base', number: '58', priority: 1, notes: 'n', setTotal: 102, source: 'pokemon', sourceId: 'base1-58', image: '' }], ...o });
const clean = (o, opts) => sanitizeBackup(file(o), opts);

test('backup: um backup normal passa sem perder nada', () => {
  const raw = file();
  const { data, report, ignored } = sanitizeBackup(raw);
  eq(ignored, 0); eq(report, { albums: 0, cards: 0, slots: 0, wishlist: 0 });
  const canon = v => (Array.isArray(v) ? v.map(canon) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, canon(v[k])])) : v);   // ordem das chaves não importa
  eq(canon(data.albums), canon(raw.albums)); eq(canon(data.cards), canon(raw.cards)); eq(canon(data.slots), canon(raw.slots)); eq(canon(data.wishlist), canon(raw.wishlist));
  eq([data.app, data.version], ['sleevebook', 1]);
});
test('backup: ids com HTML são ignorados, junto com o que depende deles', () => {
  const evil = '"><img src=x onerror=alert(1)>';
  const { data, report } = clean({
    albums: [album(), album({ id: evil })], cards: [card('c1'), card(evil)],
    slots: [slot('a1', 1, 0, 0, 'c1'), slot(evil, 1, 0, 0, 'c1'), slot('a1', 1, 0, 1, evil)], wishlist: [{ id: evil, name: 'x' }],
  });
  eq([data.albums.length, data.cards.length, data.slots.length, data.wishlist.length], [1, 1, 1, 0]);
  eq(report, { albums: 1, cards: 1, slots: 2, wishlist: 1 });
});
test('backup: números e textos fora do esperado são normalizados', () => {
  const { data } = clean({ cards: [card('c1', { qty: '<img>', setTotal: '<img>', name: 'x'.repeat(500), notes: 'y'.repeat(900), condition: 'INVENTADA', owned: 'sim', foil: 'x', imageFallback: 'pt', language: 'e n', source: 'evil', sourceId: '../x', price: 'caro' })] });
  const c = data.cards[0];
  eq([c.qty, c.setTotal, c.name.length, c.notes.length, c.condition, c.owned, c.source, c.sourceId], [1, null, 100, 500, 'NM (Near Mint)', true, 'manual', null]);
  ok(!('foil' in c) && !('imageFallback' in c) && !('language' in c) && !('price' in c), 'campos inválidos somem');
});
test('backup: álbum com grade, cor e jogo inválidos é corrigido', () => {
  const { data } = clean({ albums: [album({ rows: 99, cols: -2, pages: 'x', color: 'red;background:url(x)', game: 'hack', name: '<b>' + 'n'.repeat(200) })], slots: [] });
  const a = data.albums[0];
  eq([a.rows, a.cols, a.game], [6, 1, 'pokemon']); ok(a.pages >= 1 && a.pages <= 500); ok(/^#[0-9a-f]{6}$/.test(a.color)); ok(a.name.length <= 60);
});
test('backup: slots fora da grade possível, repetidos ou sem carta/álbum são ignorados; a chave é refeita', () => {
  const { data, report } = clean({ slots: [
    { key: 'qualquer', albumId: 'a1', page: 2, row: 1, col: 1, cardId: 'c1' },       // chave errada: é refeita
    slot('a1', 2, 1, 1, 'c1'),                                                         // repetido depois de refeita
    slot('a1', 9999, 0, 0, 'c1'), slot('a1', 0, 0, 0, 'c1'), slot('a1', 1, 7, 0, 'c1'), slot('a1', 1, 0, -1, 'c1'),
    slot('a1', 1, 0, 0, 'nao-existe'), slot('outro', 1, 0, 0, 'c1'),
    { albumId: 'a1', page: 1.5, row: 'a', col: 0, cardId: 'c1' }, null, 'x',
  ] });
  eq(data.slots, [slot('a1', 2, 1, 1, 'c1')]); eq(report.slots, 10);
});
test('backup: só imagens http(s) ou fotos enviadas são aceitas', () => {
  for (const ok1 of ['https://exemplo.com/a.png', 'http://exemplo.com/a.png', 'data:image/jpeg;base64,/9j/4AAQ=']) eq(backupImage(ok1) !== '', true, ok1);
  for (const bad of ['javascript:alert(1)', 'data:text/html;base64,PHNjcmlwdD4=', 'data:image/svg+xml;base64,AAAA', 'file:///etc/passwd', 'ftp://x/a.png', '', null, 5, 'https://x.com/' + 'a'.repeat(2100), 'data:image/jpeg;base64,' + 'A'.repeat(2_000_001)])
    eq(backupImage(bad), '', String(bad).slice(0, 40));
});
test('backup: listas acima do limite são cortadas e contadas', () => {
  const many = Array.from({ length: BACKUP_LIMITS.albums + 3 }, (_, i) => album({ id: 'a' + i }));
  const { data, report } = clean({ albums: many, cards: [], slots: [], wishlist: [] });
  eq([data.albums.length, report.albums], [BACKUP_LIMITS.albums, 3]);
});
test('backup: listas ausentes ou de tipo errado viram listas vazias', () => {
  const { data } = sanitizeBackup({ app: 'sleevebook', version: 1, albums: 'x', cards: null, slots: {}, wishlist: undefined });
  eq([data.albums, data.cards, data.slots, data.wishlist], [[], [], [], []]);
});
