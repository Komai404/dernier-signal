/* Dernier Signal : permet d'installer le jeu et de l'ouvrir sans connexion (partie d'essai). */
const CACHE = 'dernier-signal-v3';
const SHELL = ["./", "index.html", "jouer.html", "manifest.webmanifest", "icon-192.png", "icon-512.png", "cards/chasseur.webp", "cards/constructeur.webp", "cards/discret.webp", "cards/dos.webp", "cards/empoisonneur.webp", "cards/gardien.webp", "cards/mordu.webp", "cards/reanimateur.webp", "cards/rodeur.webp", "cards/scientifique.webp", "cards/survivant.webp"];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || u.pathname.includes('/api/')) return;
  const isPage = e.request.mode === 'navigate' || u.pathname.endsWith('/') || u.pathname.endsWith('.html');
  if (isPage) {
    e.respondWith(fetch(e.request).then(r => { const cp = r.clone(); caches.open(CACHE).then(c => c.put(e.request, cp)); return r; })
      .catch(() => caches.match(e.request).then(r => r || caches.match('jouer.html'))));
    return;
  }
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(res => { const cp = res.clone(); caches.open(CACHE).then(c => c.put(e.request, cp)); return res; })));
});
