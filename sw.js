// Service worker: deixa o app abrir sem internet.
// Arquivos do próprio site: tenta a rede primeiro (para você sempre ver a versão mais nova) e cai no cache se estiver offline.
// Requisições para outros sites (busca de cartas, imagens das cartas) passam direto; offline, a busca avisa que não deu.
// Ao criar um módulo novo em src/, inclua o arquivo em SHELL para ele funcionar offline.
const CACHE = 'sleevebook-v1';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'icon.svg',
  'src/css/app.css',
  'src/js/app.js', 'src/js/book.js', 'src/js/cardform.js', 'src/js/collection.js', 'src/js/color.js', 'src/js/grid.js',
  'src/js/search.js', 'src/js/stats.js', 'src/js/store.js', 'src/js/util.js', 'src/js/wheel.js', 'src/js/wishlist.js',
  'src/js/providers/index.js', 'src/js/providers/pokemon.js', 'src/js/providers/scryfall.js', 'src/js/providers/yugioh.js',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', e => {
  const { request } = e;
  if (request.method !== 'GET' || new URL(request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(request)
      .then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(request, copy)); }
        return res;
      })
      .catch(async () => (await caches.match(request)) || (request.mode === 'navigate' ? caches.match('index.html') : Response.error())),
  );
});
