const CACHE_NAME = 'ncc-cache-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/home.html',
  '/home2.html',
  '/home3.html',
  '/login.html',
  '/register.html',
  '/style.css',
  '/icon-192.png',
  '/icon-512.png',
  // add any other important files
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => response || fetch(event.request))
  );
});

self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => 
      Promise.all(
        cacheNames.map((cacheName) => {
          if (!cacheWhitelist.includes(cacheName)) {
            return caches.delete(cacheName);
          }
        })
      )
    )
  );
});
