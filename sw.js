/**
 * Service Worker — cache-first strategy for app shell assets (REQ-046).
 * Card type data (card-types/) is served network-first to stay fresh.
 */

const CACHE = 'card-maker-v2';

const APP_SHELL = [
  '/',
  '/index.html',
  '/css/app.css',
  '/css/edit-view.css',
  '/css/table-view.css',
  '/css/print.css',
  '/js/app.js',
  '/js/ui.js',
  '/js/file-io.js',
  '/js/sidebar.js',
  '/js/state.js',
  '/js/toast.js',
  '/js/focus-trap.js',
  '/js/undo-stack.js',
  '/js/storage.js',
  '/js/template-renderer.js',
  '/js/csv-parser.js',
  '/js/qr-code.js',
  '/js/card-type-registry.js',
  '/js/table-view.js',
  '/js/table/pill-picker.js',
  '/js/edit-view.js',
  '/js/print-layout.js',
  '/js/icon-loader.js',
  '/js/starter-files.js',
  '/lib/papaparse.min.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Network-first for card type files (stays fresh)
  if (url.pathname.startsWith('/card-types/')) {
    e.respondWith(
      fetch(e.request).catch(() => caches.match(e.request))
    );
    return;
  }

  // Cache-first for everything else
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
