/**
 * sw.js — Service Worker for Kitsune AI Companion PWA.
 * Version: v0.1.0
 * Strategy: Network-first for code/HTML/JS (instant updates), cache-first for media assets.
 */

const CACHE_NAME = 'companion-stage1-v0.1.0';
const CODE_ASSETS = [
  './',
  './index.html',
  './moods.js',
  './reactions.js',
  './character.js',
  './species/fox.js',
  './sensors.js',
  './smiletest.js',
  './manifest.json',
];

const STATIC_ASSETS = [
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([...CODE_ASSETS, ...STATIC_ASSETS]);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // For code and navigation requests: Network-First with cache fallback
  if (event.request.mode === 'navigate' || url.pathname.endsWith('.js') || url.pathname.endsWith('.html') || url.pathname.endsWith('.json')) {
    event.respondWith(
      fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        return caches.match(event.request).then((cached) => {
          return cached || caches.match('./index.html');
        });
      })
    );
    return;
  }

  // For static icons and images: Cache-First with network fallback
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;
      return fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      });
    })
  );
});
