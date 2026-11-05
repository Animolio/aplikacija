// Jednostavna predmemorija ljuske aplikacije; podaci uvijek idu na mrežu.
const VERZIJA = 'animolio-v11';
const LJUSKA = ['./', 'index.html', 'style.css', 'app.js', 'agent.js', 'teren.js', 'novo.js', 'urednica.js', 'mozon.js', 'partner.js', 'tema.js', 'motiv-sven.jpg', 'motiv-marcy.jpg', 'motiv-fluffy.jpg', 'config.js', 'manifest.webmanifest', 'ikona-192.png', 'ikona-512.png'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(VERZIJA).then((c) => c.addAll(LJUSKA))); self.skipWaiting(); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((x) => x !== VERZIJA).map((x) => caches.delete(x))))); self.clients.claim(); });
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then((r) => { const kopija = r.clone(); caches.open(VERZIJA).then((c) => c.put(e.request, kopija)); return r; }).catch(() => caches.match(e.request)));
});
