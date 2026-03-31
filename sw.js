/**
 * PosThaiban - Service Worker (Fast update + cache cleanup)
 */

const CACHE_VERSION = 'v11-3-6';
const CACHE_NAME = `posthaiban-shell-${CACHE_VERSION}`;
const SHELL_CACHE_PREFIX = 'posthaiban-shell-';
const APP_SHELL = [
  './',
  './index.html',
  '/',
  './manifest.json',
  './icon.png',
  './icon-192.png',
  './icon-512.png',
  './machine-id.js',
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/html5-qrcode',
  'https://unpkg.com/dexie/dist/dexie.js',
  'https://fonts.googleapis.com/css2?family=Kanit:wght@300;400;500;600;800;900&display=swap'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await Promise.allSettled(
        APP_SHELL.map((asset) => {
          const req = asset.startsWith('http')
            ? new Request(asset, { mode: 'no-cors' })
            : new Request(asset);
          return fetch(req)
            .then((response) => {
              if (response) return cache.put(req, response.clone());
              return cache.add(req);
            })
            .catch(() => {});
        })
      );
    }).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys
        .filter((key) => key.startsWith(SHELL_CACHE_PREFIX) && key !== CACHE_NAME)
        .map((key) => caches.delete(key))
    )).then(async () => {
      await self.clients.claim();
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      clients.forEach((client) => client.postMessage({ type: 'SW_ACTIVATED', version: CACHE_VERSION }));
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const normalizedPath = url.pathname.replace(/^\//, '');
  const matchesAppShell = APP_SHELL.some((asset) => {
    const normalizedAsset = String(asset).replace(/^\.\//, '');
    return normalizedAsset === normalizedPath || normalizedAsset === url.href;
  });

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const cachedPage =
        (await caches.match(request, { ignoreSearch: true })) ||
        (await caches.match('./index.html')) ||
        (await caches.match('./'));

      if (cachedPage) {
        fetch(request, { cache: 'no-store' })
          .then((response) => {
            if (response && response.ok) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, response.clone()).catch(() => {});
                cache.put('./index.html', response.clone()).catch(() => {});
              });
            }
          })
          .catch(() => {});
        return cachedPage;
      }

      try {
        const networkResponse = await fetch(request, { cache: 'no-store' });
        if (networkResponse && networkResponse.ok) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, clone).catch(() => {});
          });
        }
        return networkResponse;
      } catch (_) {
        return new Response(
          '<!doctype html><meta charset="utf-8"><title>Offline</title><body style="font-family:sans-serif;padding:16px">ไม่สามารถเชื่อมต่อได้ กรุณาเปิดอินเทอร์เน็ตแล้วลองอีกครั้ง</body>',
          { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        );
      }
    })());
    return;
  }

  const isStaticAsset =
    matchesAppShell ||
    APP_SHELL.includes(url.href) ||
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'font' ||
    request.destination === 'image';

  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const networkFetch = fetch(request)
          .then((response) => {
            if (response && response.status === 200) {
              caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
            }
            return response;
          })
          .catch(() => cached);
        return cached || networkFetch;
      })
    );
    return;
  }

  event.respondWith(
    fetch(request).catch(async () => (await caches.match(request, { ignoreSearch: true })) || Response.error())
  );
});
