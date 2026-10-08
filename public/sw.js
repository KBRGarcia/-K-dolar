const APP_CACHE = 'k-dolar-app-v2'
const API_CACHE = 'k-dolar-api-v2'
const APP_SHELL = [
  '/',
  '/logo.png',
  '/favicon-16x16.png',
  '/favicon-32x32.png',
  '/apple-touch-icon.png',
  '/manifest.webmanifest',
]
const API_ORIGIN = 'https://ve.dolarapi.com'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(APP_CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((cacheName) => ![APP_CACHE, API_CACHE].includes(cacheName))
            .map((cacheName) => caches.delete(cacheName)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  if (request.method !== 'GET') return

  if (url.pathname.endsWith('.apk')) {
    event.respondWith(fetch(request))
    return
  }

  if (url.origin === API_ORIGIN) {
    event.respondWith(networkFirst(request, API_CACHE))
    return
  }

  if (request.mode === 'navigate') {
    event.respondWith(navigationFirst(request))
    return
  }

  event.respondWith(cacheFirst(request, APP_CACHE))
})

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName)

  try {
    const response = await fetch(request)

    if (response.ok) {
      cache.put(request, response.clone())
    }

    return response
  } catch {
    const cachedResponse = await cache.match(request)

    if (cachedResponse) return cachedResponse
    throw new Error('No cached response available.')
  }
}

async function navigationFirst(request) {
  const cache = await caches.open(APP_CACHE)

  try {
    const response = await fetch(request)

    if (response.ok) {
      cache.put('/', response.clone())
    }

    return response
  } catch {
    const cachedResponse = await cache.match('/')

    return cachedResponse || Response.error()
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cachedResponse = await cache.match(request)

  if (cachedResponse) return cachedResponse

  try {
    const response = await fetch(request)

    if (response.ok) {
      cache.put(request, response.clone())
    }

    return response
  } catch {
    return Response.error()
  }
}
