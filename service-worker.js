// ─── PesceSicuro Service Worker v2 ────────────────────────────────────────────
// Strategia: Cache First con Network Fallback + offline completo

var CACHE_NAME = 'pesce-fao-v2';

// File da mettere in cache all'installazione (pre-cache)
var PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './data-specie.json',
  './data-zone.json'
];

// ─── INSTALL: precache di tutti i file essenziali ─────────────────────────────
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(PRECACHE_URLS);
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

// ─── ACTIVATE: elimina vecchie cache ─────────────────────────────────────────
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames
          .filter(function(name) { return name !== CACHE_NAME; })
          .map(function(name) { return caches.delete(name); })
      );
    }).then(function() {
      return clients.claim();
    })
  );
});

// ─── FETCH: Cache First, poi Network, poi fallback offline ───────────────────
self.addEventListener('fetch', function(event) {
  // Ignora richieste non-GET e cross-origin
  if (event.request.method !== 'GET') return;
  var url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then(function(cached) {
      if (cached) {
        // Serve dalla cache, aggiorna in background (stale-while-revalidate)
        var fetchPromise = fetch(event.request).then(function(networkResp) {
          if (networkResp && networkResp.status === 200) {
            var clone = networkResp.clone();
            caches.open(CACHE_NAME).then(function(cache) {
              cache.put(event.request, clone);
            });
          }
          return networkResp;
        }).catch(function() { /* offline: già servito dalla cache */ });
        return cached;
      }

      // Non in cache: tenta il network
      return fetch(event.request).then(function(networkResp) {
        if (!networkResp || networkResp.status !== 200 || networkResp.type === 'opaque') {
          return networkResp;
        }
        var clone = networkResp.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(event.request, clone);
        });
        return networkResp;
      }).catch(function() {
        // Offline e non in cache: restituisci la pagina principale
        return caches.match('./index.html');
      });
    })
  );
});
