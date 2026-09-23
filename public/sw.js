const CACHE = 'wolfsocial-static-v1'
const STATIC_DESTINATIONS = ['style', 'script', 'font', 'image']

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request)
          const cache = await caches.open(CACHE)
          cache.put(request, fresh.clone())
          return fresh
        } catch {
          const cached = await caches.match(request)
          return cached || caches.match('./index.html')
        }
      })(),
    )
    return
  }

  if (STATIC_DESTINATIONS.includes(request.destination)) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request)
        const network = fetch(request)
          .then(async (response) => {
            if (response.ok) {
              const cache = await caches.open(CACHE)
              cache.put(request, response.clone())
            }
            return response
          })
          .catch(() => cached)
        return cached || network
      })(),
    )
  }
})
