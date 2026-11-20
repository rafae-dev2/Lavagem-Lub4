const STATIC_CACHE = 'bp-static-assets-v1';
const SHELL_CACHE = 'bp-app-shell-v1';
const CSS_CACHE_VERSION = 'liquid-glass-v18-9';
const CSS_CACHE = `bp-css-styles-${CSS_CACHE_VERSION}`;
const CACHE_PREFIXES = ['bp-static-assets-', 'bp-app-shell-', 'bp-css-styles-'];

// Politicas HTTP Cache-Control otimizadas para dispositivos de frota com conexao intermitente
const CACHE_CONTROL_IMMUTABLE = 'public, max-age=31536000, immutable';
const CACHE_CONTROL_STATIC_SWR = 'public, max-age=604800, stale-while-revalidate=86400';
const CACHE_CONTROL_SHELL = 'public, max-age=300, stale-while-revalidate=86400';
const CACHE_CONTROL_CSS_VERSIONED = 'public, max-age=0, must-revalidate';
const NETWORK_TIMEOUT_MS = 2500;

const PRECACHE_STATIC_URLS = [
  '/logo.png',
  '/manifest.webmanifest',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/pwa-maskable-192x192.png',
  '/pwa-maskable-512x512.png',
  '/apple-touch-icon.png',
  '/apoio-reference-header.svg',
  '/apoio-reference-ribbons.svg',
];

const PRECACHE_SHELL_URLS = ['/', '/index.html'];

const API_HOST_OR_PATH_PATTERN = /(\/rest\/v1\/|\/functions\/v1\/|\/auth\/v1\/|\/storage\/v1\/|supabase\.co)/i;
const DEV_MODULE_PATTERN = /(\/@vite|\/@react-refresh|\/@fs\/|\/@id\/|\/src\/|\/node_modules\/|[?&](?:t|v)=|\.(?:ts|tsx|jsx)(?:\?|$))/i;
const HASHED_ASSET_PATTERN = /\/assets\/[^/?#]+-[a-zA-Z0-9_-]{6,}\.(?:js|mjs|css|woff2?|png|svg|webp|jpg|jpeg)(?:\?|$)/i;
const STATIC_ASSET_PATTERN = /(\/logo\.png$|\/apoio-reference-.*\.svg$|\/pdf\.worker\.min\.mjs$|\/assets\/|\/equipamentos\/|\/equipment-types\/|\.(?:png|svg|webp|jpg|jpeg|ico|woff2?|ttf|css|mjs)(?:\?|$))/i;

function isCssRequest(request, url) {
  if (!request || !url) return false;
  if (request.destination === 'style') return true;
  return /\.css(?:\?|$)/i.test(url.pathname);
}

function withCacheControl(response, cacheControlValue, extraHeaders = null) {
  if (!response || response.type === 'opaque' || response.status !== 200) {
    return response;
  }
  if (typeof Headers === 'undefined' || typeof Response === 'undefined') {
    return response;
  }
  try {
    const headers = new Headers(response.headers);
    headers.set('Cache-Control', cacheControlValue);
    headers.set('X-SW-Cache-Control', cacheControlValue);
    if (extraHeaders) {
      for (const [key, value] of Object.entries(extraHeaders)) {
        if (value !== undefined && value !== null) {
          headers.set(key, String(value));
        }
      }
    }
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  } catch {
    return response;
  }
}

async function notifyClients(payload) {
  if (!self.clients || typeof self.clients.matchAll !== 'function') return;
  try {
    const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clientList) {
      if (client && typeof client.postMessage === 'function') {
        client.postMessage(payload);
      }
    }
  } catch {
    // Ignore client notification errors
  }
}

async function fetchAndCache(cacheName, request, cacheControlValue, extraHeaders = null) {
  const networkResponse = await fetch(request);
  if (
    networkResponse &&
    (networkResponse.status === 200 || networkResponse.type === 'opaque')
  ) {
    const responseWithHeaders = withCacheControl(networkResponse, cacheControlValue, extraHeaders);
    try {
      const cache = await caches.open(cacheName);
      await cache.put(request, responseWithHeaders.clone());
    } catch {
      // Cache write failure should not block serving the asset
    }
    return responseWithHeaders;
  }
  return networkResponse;
}

async function fetchWithTimeout(request, timeoutMs) {
  if (typeof AbortController === 'undefined') {
    return fetch(request);
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(request, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all([
      caches.open(STATIC_CACHE).then((cache) =>
        Promise.allSettled(
          PRECACHE_STATIC_URLS.map(async (url) => {
            try {
              const req = new Request(url, { cache: 'reload' });
              const res = await fetch(req);
              if (res && res.status === 200) {
                await cache.put(url, withCacheControl(res, CACHE_CONTROL_STATIC_SWR));
              }
            } catch {
              // Ignore optional precache failures
            }
          })
        )
      ),
      caches.open(SHELL_CACHE).then((cache) =>
        Promise.allSettled(
          PRECACHE_SHELL_URLS.map(async (url) => {
            try {
              const req = new Request(url, { cache: 'reload' });
              const res = await fetch(req);
              if (res && res.status === 200) {
                await cache.put(url, withCacheControl(res, CACHE_CONTROL_SHELL));
              }
            } catch {
              // Ignore optional precache failures
            }
          })
        )
      ),
      caches.open(CSS_CACHE).catch(() => undefined),
    ]).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  const activeCaches = new Set([STATIC_CACHE, SHELL_CACHE, CSS_CACHE]);
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) =>
                CACHE_PREFIXES.some((prefix) => key.startsWith(prefix)) &&
                !activeCaches.has(key)
            )
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
      .then(() =>
        notifyClients({
          type: 'SW_CSS_VERSION_ACTIVATED',
          cssVersion: CSS_CACHE_VERSION,
        })
      )
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (!request || request.method !== 'GET') return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  const fullUrl = url.href;
  const pathWithSearch = `${url.pathname}${url.search}`;

  // Nunca interceptar o proprio service worker, Supabase, APIs dinamicas ou modulos de desenvolvimento Vite.
  if (
    url.pathname === '/sw.js' ||
    API_HOST_OR_PATH_PATTERN.test(fullUrl) ||
    DEV_MODULE_PATTERN.test(pathWithSearch)
  ) {
    return;
  }

  const isSameOrigin = url.origin === self.location.origin;

  // Navegacao HTML (App Shell): rede com timeout curto para nao travar em 3G/4G instavel + Cache-Control SWR.
  if (isSameOrigin && request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        const cache = await caches.open(SHELL_CACHE);
        try {
          const networkResponse = await fetchWithTimeout(request, NETWORK_TIMEOUT_MS);
          if (networkResponse && networkResponse.status === 200) {
            const shellResponse = withCacheControl(networkResponse, CACHE_CONTROL_SHELL);
            cache.put(request, shellResponse.clone()).catch(() => undefined);
            cache.put('/', shellResponse.clone()).catch(() => undefined);
            return shellResponse;
          }
          const fallback = (await cache.match(request)) || (await cache.match('/')) || (await cache.match('/index.html'));
          return fallback || networkResponse;
        } catch {
          const cachedShell =
            (await cache.match(request)) ||
            (await cache.match('/')) ||
            (await cache.match('/index.html'));
          if (cachedShell) {
            return withCacheControl(cachedShell, CACHE_CONTROL_SHELL);
          }
          return fetch(request);
        }
      })()
    );
    return;
  }

  const isGoogleFont =
    url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  const isHashedBundle = isSameOrigin && HASHED_ASSET_PATTERN.test(url.pathname);

  // Estrategia dedicada e versionada para arquivos CSS (Liquid Glass & demais estilos)
  if ((isSameOrigin || isGoogleFont) && isCssRequest(request, url)) {
    const cssCacheControl = isHashedBundle ? CACHE_CONTROL_IMMUTABLE : CACHE_CONTROL_CSS_VERSIONED;
    const cssHeaders = { 'X-SW-CSS-Version': CSS_CACHE_VERSION };

    event.respondWith(
      caches.open(CSS_CACHE).then(async (cache) => {
        if (isHashedBundle) {
          const cached = await cache.match(request);
          if (cached) {
            return withCacheControl(cached, cssCacheControl, cssHeaders);
          }
          return fetchAndCache(CSS_CACHE, request, cssCacheControl, cssHeaders);
        }

        // CSS nao-hash (ou fontes externas): Network-First com timeout curto para entregar atualizacoes de tema sem reload manual
        const cached = await cache.match(request);
        try {
          const networkResponse = await fetchWithTimeout(request, NETWORK_TIMEOUT_MS);
          if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
            const stamped = withCacheControl(networkResponse, cssCacheControl, cssHeaders);
            const prevEtag = cached && cached.headers ? cached.headers.get('ETag') : null;
            const nextEtag = networkResponse.headers ? networkResponse.headers.get('ETag') : null;
            const prevMod = cached && cached.headers ? cached.headers.get('Last-Modified') : null;
            const nextMod = networkResponse.headers ? networkResponse.headers.get('Last-Modified') : null;
            const changed = Boolean(
              cached &&
              ((prevEtag && nextEtag && prevEtag !== nextEtag) ||
                (prevMod && nextMod && prevMod !== nextMod))
            );
            cache.put(request, stamped.clone()).catch(() => undefined);
            if (changed && isSameOrigin) {
              event.waitUntil(
                notifyClients({
                  type: 'CSS_CACHE_UPDATED',
                  cssVersion: CSS_CACHE_VERSION,
                  url: request.url,
                })
              );
            }
            return stamped;
          }
          if (cached) {
            return withCacheControl(cached, cssCacheControl, cssHeaders);
          }
          return networkResponse;
        } catch {
          if (cached) {
            if (isSameOrigin) {
              event.waitUntil(
                fetchAndCache(CSS_CACHE, request, cssCacheControl, cssHeaders)
                  .then((fresh) => {
                    if (fresh && fresh.status === 200) {
                      return notifyClients({
                        type: 'CSS_CACHE_UPDATED',
                        cssVersion: CSS_CACHE_VERSION,
                        url: request.url,
                      });
                    }
                  })
                  .catch(() => undefined)
              );
            }
            return withCacheControl(cached, cssCacheControl, cssHeaders);
          }
          return fetchAndCache(CSS_CACHE, request, cssCacheControl, cssHeaders);
        }
      })
    );
    return;
  }

  const isStaticAsset =
    isHashedBundle ||
    (isSameOrigin && STATIC_ASSET_PATTERN.test(url.pathname)) ||
    isGoogleFont;

  if (!isStaticAsset) return;

  const cacheControlHeader = isHashedBundle
    ? CACHE_CONTROL_IMMUTABLE
    : CACHE_CONTROL_STATIC_SWR;

  // Cache-First com headers Cache-Control otimizados e revalidacao silenciosa para ativos nao-imutaveis.
  event.respondWith(
    caches.open(STATIC_CACHE).then(async (cache) => {
      const cached = await cache.match(request);
      if (cached) {
        if (!isHashedBundle && isSameOrigin) {
          event.waitUntil(
            fetchAndCache(STATIC_CACHE, request, cacheControlHeader).catch(() => undefined)
          );
        }
        return withCacheControl(cached, cacheControlHeader);
      }

      return fetchAndCache(STATIC_CACHE, request, cacheControlHeader);
    })
  );
});
