// Camada de armazenamento em IndexedDB (ADR 0002).
// Coleções: albums, cards, slots, wishlist, meta.

const VERSION = 1;
const STORES = {
  albums: { keyPath: 'id' },
  cards: { keyPath: 'id' },
  slots: { keyPath: 'key', indexes: ['albumId'] },
  wishlist: { keyPath: 'id' },
  meta: { keyPath: 'key' },
};

let dbName = 'sleevebook';
let dbPromise = null;

/** Troca o nome do banco (usado nos testes). Fecha a conexão atual. */
export function useDatabase(name) {
  if (dbPromise) dbPromise.then(d => d.close());
  dbName = name;
  dbPromise = null;
}

function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(dbName, VERSION);
    req.onupgradeneeded = () => {
      const d = req.result;
      for (const [name, def] of Object.entries(STORES)) {
        if (d.objectStoreNames.contains(name)) continue;
        const os = d.createObjectStore(name, { keyPath: def.keyPath });
        (def.indexes || []).forEach(ix => os.createIndex(ix, ix));
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

const wrap = req => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });

async function run(store, mode, fn) {
  const d = await open();
  const tx = d.transaction(store, mode);
  const done = new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error); });
  const result = await fn(tx.objectStore(store));
  await done;
  return result;
}

export const db = {
  all: store => run(store, 'readonly', os => wrap(os.getAll())),
  get: (store, id) => run(store, 'readonly', os => wrap(os.get(id))),
  put: (store, obj) => run(store, 'readwrite', os => wrap(os.put(obj))),
  del: (store, id) => run(store, 'readwrite', os => wrap(os.delete(id))),
  clear: store => run(store, 'readwrite', os => wrap(os.clear())),
  putMany: (store, list) => run(store, 'readwrite', async os => { for (const o of list) os.put(o); }),
  delMany: (store, ids) => run(store, 'readwrite', async os => { for (const id of ids) os.delete(id); }),
  byAlbum: albumId => run('slots', 'readonly', os => wrap(os.index('albumId').getAll(albumId))),
};

/* ---------- Exportar / importar ---------- */

export const FORMAT = 'sleevebook';
export const FORMAT_VERSION = 1;
const DATA_STORES = ['albums', 'cards', 'slots', 'wishlist'];

export async function exportAll() {
  const [albums, cards, slots, wishlist] = await Promise.all(DATA_STORES.map(s => db.all(s)));
  return { app: FORMAT, version: FORMAT_VERSION, exportedAt: new Date().toISOString(), albums, cards, slots, wishlist };
}

/** Valida o arquivo antes de importar. Lança Error com mensagem em português. */
export function validateExport(data) {
  if (!data || data.app !== FORMAT) throw new Error('Este arquivo não é um backup do Sleevebook.');
  if (data.version > FORMAT_VERSION) throw new Error('Este backup é de uma versão mais nova do Sleevebook.');
  for (const k of ['albums', 'cards', 'slots']) if (!Array.isArray(data[k])) throw new Error(`Backup inválido: falta "${k}".`);
  return true;
}

/** mode "replace" apaga tudo antes; "merge" mantém o que existe e sobrescreve ids iguais. */
export async function importAll(data, mode = 'replace') {
  validateExport(data);
  if (mode === 'replace') for (const s of DATA_STORES) await db.clear(s);
  await db.putMany('albums', data.albums);
  await db.putMany('cards', data.cards);
  await db.putMany('slots', data.slots);
  await db.putMany('wishlist', data.wishlist || []);
}

/* ---------- Preferências simples ---------- */
export const meta = {
  get: async key => (await db.get('meta', key))?.value,
  set: (key, value) => db.put('meta', { key, value }),
};
