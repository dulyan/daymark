const CACHE = 'daymark-shell-v1'
const SHELL = [
  './', './index.html', './app.js', './planner.js', './icons.js', './styles.css', './manifest.json',
  './assets/icon-32.png', './assets/icon-180.png', './assets/icon-192.png', './assets/icon-512.png',
  './assets/barlow-condensed-700.woff2', './assets/dm-sans.woff2'
]

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(key => key.startsWith('daymark-shell-') && key !== CACHE).map(key => caches.delete(key))
  )).then(() => self.clients.claim()))
})

self.addEventListener('fetch', event => {
  const { request } = event
  if (request.method !== 'GET' || !request.url.startsWith(self.registration.scope)) return
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('./index.html')))
    return
  }
  event.respondWith(caches.open(CACHE).then(async cache => {
    const cached = await cache.match(request)
    if (cached) return cached
    const response = await fetch(request)
    if (response.ok && SHELL.some(path => new URL(path, self.registration.scope).href === request.url)) {
      await cache.put(request, response.clone())
    }
    return response
  }))
})
