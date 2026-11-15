import { test, eq, ok } from './run.js';
import { db, useDatabase, exportAll, importAll, validateExport, meta } from '../src/js/store.js';

const fresh = () => useDatabase('sleevebook-test-' + Math.random().toString(36).slice(2));

test('put, get e delete', async () => {
  fresh();
  await db.put('albums', { id: 'a1', name: 'Teste' });
  eq((await db.get('albums', 'a1')).name, 'Teste');
  await db.del('albums', 'a1');
  eq(await db.get('albums', 'a1'), undefined);
});
test('slots são filtrados por álbum', async () => {
  fresh();
  await db.putMany('slots', [{ key: 'a:1:0:0', albumId: 'a' }, { key: 'a:1:0:1', albumId: 'a' }, { key: 'b:1:0:0', albumId: 'b' }]);
  eq((await db.byAlbum('a')).length, 2);
  eq((await db.byAlbum('b')).length, 1);
});
test('exportar e importar preserva os dados', async () => {
  fresh();
  await db.put('albums', { id: 'a1', name: 'Meu', rows: 3, cols: 3, pages: 20, color: '#2c3e8f' });
  await db.put('cards', { id: 'c1', name: 'Charizard' });
  await db.put('slots', { key: 'a1:1:0:0', albumId: 'a1', page: 1, row: 0, col: 0, cardId: 'c1' });
  const data = await exportAll();
  fresh();
  await importAll(JSON.parse(JSON.stringify(data)));
  eq((await db.all('albums')).length, 1);
  eq((await db.get('cards', 'c1')).name, 'Charizard');
  eq((await db.byAlbum('a1'))[0].cardId, 'c1');
});
test('importar em modo replace apaga o que existia', async () => {
  fresh();
  await db.put('albums', { id: 'antigo' });
  await importAll({ app: 'sleevebook', version: 1, albums: [{ id: 'novo' }], cards: [], slots: [] });
  eq((await db.all('albums')).map(a => a.id), ['novo']);
});
test('importar em modo merge mantém o que existia', async () => {
  fresh();
  await db.put('albums', { id: 'antigo' });
  await importAll({ app: 'sleevebook', version: 1, albums: [{ id: 'novo' }], cards: [], slots: [] }, 'merge');
  eq((await db.all('albums')).length, 2);
});
test('validateExport recusa arquivos inválidos', () => {
  for (const bad of [null, {}, { app: 'outro' }, { app: 'sleevebook', version: 99, albums: [], cards: [], slots: [] }, { app: 'sleevebook', version: 1, albums: [] }]) {
    let threw = false;
    try { validateExport(bad); } catch { threw = true; }
    ok(threw, JSON.stringify(bad));
  }
});
test('meta guarda preferências', async () => {
  fresh();
  await meta.set('currentAlbum', 'a1');
  eq(await meta.get('currentAlbum'), 'a1');
  eq(await meta.get('inexistente'), undefined);
});
