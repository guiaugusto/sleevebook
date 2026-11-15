import { test, eq, ok } from './run.js';
import { handle, LIMITS } from '../worker/worker.js';
import { createShortLink, readShortLink, deleteShortLink, shortFromHash, canDelete, ShortLinkError } from '../src/js/shortlink.js';

const ORIGIN = 'https://guiaugusto.github.io';

/** KV simulado: guarda valores e as opções de expiração, como o da Cloudflare. */
function fakeKV() {
  const data = new Map(), opts = new Map(), calls = { put: 0, get: 0, delete: 0 };
  return {
    data, opts, calls,
    async get(k, o) { calls.get++; const v = data.get(k); return v == null ? null : (o === 'json' || o?.type === 'json' ? JSON.parse(v) : v); },
    async put(k, v, o) { calls.put++; data.set(k, v); opts.set(k, o); },
    async delete(k) { calls.delete++; data.delete(k); },
  };
}
// Request de verdade não deixa o código definir "Origin" (o navegador é quem põe), então usamos um objeto equivalente.
const req = (method, path, { body, headers = {} } = {}) => ({ method, url: 'https://w.test' + path, headers: new Headers({ Origin: ORIGIN, ...headers }), text: async () => body ?? '' });
const body = (n = 100) => 'A'.repeat(n);
const worker = (env, limits) => (r, now = Date.parse('2026-11-15T12:00:00Z')) => handle(r, env, { limits: { ...LIMITS, ...limits }, now });

test('worker: cria, lê e apaga um link, com expiração configurada', async () => {
  const env = { LINKS: fakeKV() }, w = worker(env, { ttlSeconds: 1234 });
  const res = await w(req('POST', '/s', { body: body() }));
  eq(res.status, 201);
  const { id, token } = await res.json();
  ok(/^[\w-]{12}$/.test(id) && token.length >= 20);
  eq(env.LINKS.opts.get('s:' + id), { expirationTtl: 1234 });
  ok(!env.LINKS.data.get('s:' + id).includes(token), 'o código de apagar não é guardado em texto');
  const got = await w(req('GET', '/s/' + id));
  eq([got.status, await got.text()], [200, body()]);
  ok(got.headers.get('Cache-Control').includes('immutable'));
  eq((await w(req('DELETE', '/s/' + id, { headers: { 'X-Delete-Token': 'errado' } }))).status, 403);
  eq((await w(req('DELETE', '/s/' + id, { headers: { 'X-Delete-Token': token } }))).status, 204);
  eq((await w(req('GET', '/s/' + id))).status, 404);
});
test('worker: respeita o tamanho máximo e recusa conteúdo inválido', async () => {
  const w = worker({ LINKS: fakeKV() }, { maxBodyBytes: 50 });
  eq((await w(req('POST', '/s', { body: body(51) }))).status, 413);
  eq((await w(req('POST', '/s', { body: '<script>' }))).status, 400);
  eq((await w(req('POST', '/s', { body: '' }))).status, 400);
  eq((await w(req('POST', '/s', { body: body(50) }))).status, 201);
});
test('worker: o orçamento diário de gravações é respeitado e zera no dia seguinte', async () => {
  const env = { LINKS: fakeKV() }, w = worker(env, { dailyWriteBudget: 6, writesPerCreate: 2 });
  const day1 = Date.parse('2026-11-15T10:00:00Z'), day2 = Date.parse('2026-11-16T10:00:00Z');
  for (let i = 0; i < 3; i++) eq((await w(req('POST', '/s', { body: body() }), day1)).status, 201);
  const refused = await w(req('POST', '/s', { body: body() }), day1);
  eq([refused.status, (await refused.json()).error], [429, 'quota']);
  eq(env.LINKS.calls.put, 6, 'nenhuma gravação além do orçamento');
  eq((await w(req('POST', '/s', { body: body() }), day2)).status, 201);
});
test('worker: só sites autorizados e CORS', async () => {
  const w = worker({ LINKS: fakeKV() });
  eq((await w(req('POST', '/s', { body: body(), headers: { Origin: 'https://evil.test' } }))).status, 403);
  const ok1 = await w(req('GET', '/s/abcdefghijkl'));
  eq(ok1.headers.get('Access-Control-Allow-Origin'), ORIGIN);
  const pre = await w(req('OPTIONS', '/s/abcdefghijkl'));
  eq(pre.status, 204);
});
test('worker: /stats só com o código de administrador', async () => {
  const env = { LINKS: fakeKV(), ADMIN_TOKEN: 'segredo' }, w = worker(env, { dailyWriteBudget: 10 });
  await w(req('POST', '/s', { body: body() }));
  eq((await w(req('GET', '/stats'))).status, 403);
  const s = await (await w(req('GET', '/stats', { headers: { Authorization: 'Bearer segredo' } }))).json();
  eq([s.writesUsed, s.writeBudget, s.linksCreatedToday], [2, 10, 1]);
  eq((await worker({ LINKS: fakeKV() })(req('GET', '/stats'))).status, 404);
});

/* ---------- Cliente ---------- */
const album = { id: 'a1', name: 'Fichário', game: 'pokemon', rows: 3, cols: 3, pages: 40, color: '#2c3e8f' };
const cards = [{ id: 'c1', name: 'Turtwig', set: 'MEP', number: '040', source: 'pokemon', sourceId: 'mep-040', language: 'en', condition: 'NM (Near Mint)', qty: 1, owned: true, image: 'https://assets.tcgdex.net/en/me/mep/040/high.webp' }];
const slots = [{ key: 'a1:1:0:0', albumId: 'a1', page: 1, row: 0, col: 0, cardId: 'c1' }];
const viaWorker = (env, limits) => { const w = worker(env, limits); return (url, init = {}) => w(new Request(url, { ...init, headers: { Origin: ORIGIN, ...(init.headers || {}) } })); };

test('link curto: ida e volta cifrada, e o Worker só vê texto cifrado', async () => {
  const env = { LINKS: fakeKV() }, fetchFn = viaWorker(env);
  const { link, id } = await createShortLink('https://w.test', 'https://x.test/', album, slots, cards, { fetchFn });
  ok(/^https:\/\/x\.test\/#c=[\w-]{12}\.[\w-]{22}$/.test(link), link);
  ok(link.length < 60, `link com ${link.length} caracteres`);
  const stored = JSON.parse(env.LINKS.data.get('s:' + id)).b;
  ok(!stored.includes('Turtwig') && !stored.includes('mep'), 'conteúdo não aparece');
  const got = await readShortLink('https://w.test', link.slice(link.indexOf('#')), { fetchFn });
  eq([got.album.name, got.cards[0].name, got.cards[0].image], ['Fichário', 'Turtwig', 'https://assets.tcgdex.net/en/me/mep/040/high.webp']);
});
test('link curto: chave errada, link cortado e link apagado dão erro amigável', async () => {
  const env = { LINKS: fakeKV() }, fetchFn = viaWorker(env);
  const { link, id } = await createShortLink('https://w.test', 'https://x.test/', album, slots, cards, { fetchFn });
  const hash = link.slice(link.indexOf('#'));
  const code = async h => { try { await readShortLink('https://w.test', h, { fetchFn }); } catch (e) { ok(e instanceof ShortLinkError); return e.code; } return 'ok'; };
  eq(await code(hash.replace(/\.[\w-]{22}$/, '.' + 'A'.repeat(22))), 'bad_link');
  eq(await code(hash.slice(0, -3)), 'bad_link');
  eq(await code('#c=abcdefghijkl.' + 'A'.repeat(22)), 'not_found');
  eq(shortFromHash('#compartilhar=x'), null);
  ok(canDelete(id));
  await deleteShortLink('https://w.test', id, { fetchFn });
  ok(!canDelete(id));
  eq(await code(hash), 'not_found');
});
test('link curto: cota esgotada e rede fora do ar viram erros que mandam usar o link longo', async () => {
  const quota = viaWorker({ LINKS: fakeKV() }, { dailyWriteBudget: 0 });
  let e1; try { await createShortLink('https://w.test', 'https://x.test/', album, slots, cards, { fetchFn: quota }); } catch (e) { e1 = e; }
  eq(e1?.code, 'quota'); ok(e1.message.includes('link longo'));
  let e2; try { await createShortLink('https://w.test', 'https://x.test/', album, slots, cards, { fetchFn: () => Promise.reject(new TypeError('offline')) }); } catch (e) { e2 = e; }
  eq(e2?.code, 'network');
});
