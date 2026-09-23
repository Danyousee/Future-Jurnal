// Cache cleanup worker - clears stale browser caches to prevent conflicting React runtime chunks
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.map((key) => caches.delete(key)));
    }).then(() => self.clients.claim()).then(() => {
      return self.registration.unregister();
    })
  );
});

self.addEventListener('fetch', (event) => {
  // Always fetch fresh from network without intercepting
  event.respondWith(fetch(event.request));
});
