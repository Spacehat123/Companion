/**
 * sw.js — Service Worker for Offline PWA Support.
 * Version 2: Kitsune Fox Spirit Cub & Direct Touch Gestures.
 */

const CACHE_NAME = 'companion-stage1-v2';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './moods.js',
  './reactions.js',
  './character.js',
  './species/fox.js',
  './sensors.js',
  './smiletest.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
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
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      return cachedResponse || fetch(event.request);
    }).catch(() => {
      return caches.match('./index.html');
    })
  );
});
