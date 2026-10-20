const CACHE_NAME = 'nexo-shell-v1';
const APP_BASE = new URL('./', self.location).pathname;
const APP_SHELL = [APP_BASE, 'index.html', 'manifest.webmanifest', 'nexo-mark.svg', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png'].map((path) => new URL(path, self.location).pathname);

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then((response) => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(new URL('index.html', self.location), copy));
      return response;
    }).catch(() => caches.match(new URL('index.html', self.location))));
    return;
  }

  event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => {
    if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
    return response;
  })));
});
