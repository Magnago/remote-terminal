const CACHE = 'awesome-terminal-v1';
const SHELL_URLS = ['/', '/index.html', '/manifest.webmanifest', '/icon.svg', '/icon-maskable.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(SHELL_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  const url = new URL(request.url);

  // Never intercept: API calls, WebSocket upgrades, cross-origin requests
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/health') ||
    url.origin !== self.location.origin ||
    request.headers.get('upgrade') === 'websocket'
  ) {
    return;
  }

  e.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          if (response.ok && response.type === 'basic') {
            const clone = response.clone();
            caches.open(CACHE).then((c) => c.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match('/index.html'));
    })
  );
});
