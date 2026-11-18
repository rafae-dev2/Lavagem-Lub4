import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {
  LAVAGEM_TAB_SLOW_THRESHOLD_MS,
  evaluateTabRenderPerformance,
  getLavagemTabLabel,
  shouldWarnOnSlowTabRender,
} from '../src/lib/lavagemTabPerformance';
import { shouldRegisterServiceWorker } from '../src/lib/serviceWorkerRegistration';

const ROOT = path.resolve(import.meta.dirname, '..');

test('src/sw.js is valid JavaScript and caches /logo.png + static assets while skipping API and Vite dev modules', () => {
  const swSource = fs.readFileSync(path.join(ROOT, 'src/sw.js'), 'utf8');
  assert.match(swSource, /bp-static-assets-v1/);
  assert.match(swSource, /\/logo\.png/);
  assert.match(swSource, /skipWaiting/);
  assert.match(swSource, /clients\.claim/);
  assert.match(swSource, /supabase\\\.co/);
  assert.match(swSource, /@vite/);

  // Verify syntactic validity and install/activate/fetch handler registration in a lightweight sandbox
  const listeners: Record<string, Function[]> = {};
  const sandbox = {
    URL,
    Request: class MockRequest {
      url: string;
      constructor(url: string) {
        this.url = url;
      }
    },
    self: {
      location: { origin: 'https://app.example.com' },
      skipWaiting: async () => undefined,
      clients: { claim: async () => undefined },
      addEventListener(type: string, fn: Function) {
        listeners[type] = listeners[type] || [];
        listeners[type].push(fn);
      },
    },
    caches: {
      open: async () => ({
        add: async () => undefined,
        match: async () => undefined,
        put: async () => undefined,
      }),
      keys: async () => [],
      delete: async () => true,
    },
  };
  vm.runInNewContext(swSource, sandbox);
  assert.equal(listeners.install?.length, 1);
  assert.equal(listeners.activate?.length, 1);
  assert.equal(listeners.fetch?.length, 1);
});

test('src/sw.js injects optimized Cache-Control headers for hashed bundles, static assets, and app shell navigations', async () => {
  const swSource = fs.readFileSync(path.join(ROOT, 'src/sw.js'), 'utf8');
  assert.match(swSource, /CACHE_CONTROL_IMMUTABLE\s*=\s*'public, max-age=31536000, immutable'/);
  assert.match(swSource, /CACHE_CONTROL_STATIC_SWR\s*=\s*'public, max-age=604800, stale-while-revalidate=86400'/);
  assert.match(swSource, /CACHE_CONTROL_SHELL\s*=\s*'public, max-age=300, stale-while-revalidate=86400'/);

  const listeners: Record<string, Function[]> = {};
  const cacheStore = new Map<string, Response>();
  const sandbox = {
    URL,
    Headers,
    Response,
    Request,
    AbortController,
    setTimeout,
    clearTimeout,
    fetch: async (req: Request | string) => {
      const target = typeof req === 'string' ? req : req.url;
      return new Response(`body:${target}`, { status: 200, headers: { 'Content-Type': 'text/plain' } });
    },
    self: {
      location: { origin: 'https://app.example.com' },
      skipWaiting: async () => undefined,
      clients: { claim: async () => undefined },
      addEventListener(type: string, fn: Function) {
        listeners[type] = listeners[type] || [];
        listeners[type].push(fn);
      },
    },
    caches: {
      open: async () => ({
        add: async () => undefined,
        match: async (req: Request | string) => {
          const key = typeof req === 'string' ? req : req.url;
          return cacheStore.get(key);
        },
        put: async (req: Request | string, res: Response) => {
          const key = typeof req === 'string' ? req : req.url;
          cacheStore.set(key, res);
        },
      }),
      keys: async () => [],
      delete: async () => true,
    },
  };
  vm.runInNewContext(swSource, sandbox);
  const fetchHandler = listeners.fetch[0];

  const dispatchFetch = async (url: string, init: { mode?: RequestMode } = {}) => {
    let responsePromise: Promise<Response> | null = null;
    const waitPromises: Promise<unknown>[] = [];
    const req = { url, method: 'GET', mode: init.mode ?? 'cors' };
    fetchHandler({
      request: req,
      respondWith(p: Promise<Response>) {
        responsePromise = p;
      },
      waitUntil(p: Promise<unknown>) {
        waitPromises.push(p);
      },
    });
    const res = responsePromise ? await responsePromise : null;
    await Promise.allSettled(waitPromises);
    return res;
  };

  // 1. Hashed production bundle -> immutable 1-year Cache-Control
  const bundleRes = await dispatchFetch('https://app.example.com/assets/index-Ab12Cd34.js');
  assert.ok(bundleRes);
  assert.equal(bundleRes.headers.get('Cache-Control'), 'public, max-age=31536000, immutable');

  // 2. Unhashed static image/logo -> 7d + 1d stale-while-revalidate
  const logoRes = await dispatchFetch('https://app.example.com/logo.png');
  assert.ok(logoRes);
  assert.equal(logoRes.headers.get('Cache-Control'), 'public, max-age=604800, stale-while-revalidate=86400');

  // 3. HTML navigation -> 5m + 1d stale-while-revalidate app shell
  const navRes = await dispatchFetch('https://app.example.com/', { mode: 'navigate' });
  assert.ok(navRes);
  assert.equal(navRes.headers.get('Cache-Control'), 'public, max-age=300, stale-while-revalidate=86400');

  // 4. Service worker itself, Supabase API, and Vite dev paths are never intercepted
  assert.equal(await dispatchFetch('https://app.example.com/sw.js'), null);
  assert.equal(await dispatchFetch('https://xyz.supabase.co/rest/v1/orders'), null);
  assert.equal(await dispatchFetch('https://app.example.com/src/main.tsx'), null);
});

test('main.tsx invokes registerAppServiceWorker and vite.config.ts syncs src/sw.js', () => {
  const mainSrc = fs.readFileSync(path.join(ROOT, 'src/main.tsx'), 'utf8');
  const viteCfg = fs.readFileSync(path.join(ROOT, 'vite.config.ts'), 'utf8');
  assert.match(mainSrc, /registerAppServiceWorker\(\)/);
  assert.match(viteCfg, /syncServiceWorker/);
  assert.match(viteCfg, /src\/sw\.js/);
  assert.match(viteCfg, /\/sw\.js/);
});

test('shouldRegisterServiceWorker allows https and localhost only when serviceWorker exists', () => {
  assert.equal(
    shouldRegisterServiceWorker({ hasServiceWorker: true, protocol: 'https:', hostname: 'app.brancoperes.com' }),
    true
  );
  assert.equal(
    shouldRegisterServiceWorker({ hasServiceWorker: true, protocol: 'http:', hostname: 'localhost' }),
    true
  );
  assert.equal(
    shouldRegisterServiceWorker({ hasServiceWorker: true, protocol: 'http:', hostname: '127.0.0.1' }),
    true
  );
  assert.equal(
    shouldRegisterServiceWorker({ hasServiceWorker: true, protocol: 'http:', hostname: 'insecure.example.com' }),
    false
  );
  assert.equal(
    shouldRegisterServiceWorker({ hasServiceWorker: false, protocol: 'https:', hostname: 'app.brancoperes.com' }),
    false
  );
});

test('evaluateTabRenderPerformance flags >300ms transitions with friendly label and stays quiet <=300ms', () => {
  assert.equal(LAVAGEM_TAB_SLOW_THRESHOLD_MS, 300);
  assert.equal(getLavagemTabLabel('programacoes'), 'Programações');
  assert.equal(getLavagemTabLabel('dashboard'), 'Dashboard');
  assert.equal(getLavagemTabLabel('importar'), 'Importar');
  assert.equal(getLavagemTabLabel('exportar'), 'Exportar');

  const fast = evaluateTabRenderPerformance({ tab: 'dashboard', elapsedMs: 142 });
  assert.equal(fast.isSlow, false);
  assert.equal(fast.warningMessage, null);

  const boundary = evaluateTabRenderPerformance({ tab: 'importar', elapsedMs: 300 });
  assert.equal(boundary.isSlow, false);
  assert.equal(boundary.warningMessage, null);

  const slow = evaluateTabRenderPerformance({ tab: 'dashboard', elapsedMs: 342.4 });
  assert.equal(slow.isSlow, true);
  assert.equal(slow.elapsedMs, 342);
  assert.equal(slow.label, 'Dashboard');
  assert.match(slow.warningMessage ?? '', /Dashboard.*342 ms.*300 ms/);
});

test('shouldWarnOnSlowTabRender suppresses duplicate warnings for the same tab within cooldown', () => {
  assert.equal(
    shouldWarnOnSlowTabRender({
      isSlow: false,
      tab: 'dashboard',
      lastWarnedTab: null,
      lastWarnedAt: 0,
      now: 1000,
    }),
    false
  );

  assert.equal(
    shouldWarnOnSlowTabRender({
      isSlow: true,
      tab: 'dashboard',
      lastWarnedTab: 'dashboard',
      lastWarnedAt: 1000,
      now: 2500,
      cooldownMs: 4000,
    }),
    false
  );

  assert.equal(
    shouldWarnOnSlowTabRender({
      isSlow: true,
      tab: 'importar',
      lastWarnedTab: 'dashboard',
      lastWarnedAt: 1000,
      now: 2500,
      cooldownMs: 4000,
    }),
    true
  );

  assert.equal(
    shouldWarnOnSlowTabRender({
      isSlow: true,
      tab: 'dashboard',
      lastWarnedTab: 'dashboard',
      lastWarnedAt: 1000,
      now: 5500,
      cooldownMs: 4000,
    }),
    true
  );
});

test('LavagemPremiumLayout wires useLavagemTabPerformance and Layout preserves mount across Lavagem tabs', () => {
  const layoutSrc = fs.readFileSync(path.join(ROOT, 'src/components/LavagemPremiumLayout.tsx'), 'utf8');
  const shellLayoutSrc = fs.readFileSync(path.join(ROOT, 'src/components/Layout.tsx'), 'utf8');
  const lavagemCss = fs.readFileSync(path.join(ROOT, 'src/styles/lavagem-premium.css'), 'utf8');
  assert.match(layoutSrc, /useLavagemTabPerformance/);
  assert.match(layoutSrc, /lavagem-perf-soft-warning/);
  assert.match(layoutSrc, /role="status"/);
  assert.match(layoutSrc, /data-tab-render-ms/);
  assert.match(shellLayoutSrc, /lavagem-premium-module/);
  assert.match(lavagemCss, /animation:\s*lavagemTabEnter/);
  assert.doesNotMatch(
    lavagemCss.match(/\.lavagem-premium\s+\.lavagem-premium-tab-panel\s*\{[^}]*\}/)?.[0] ?? '',
    /\bcontain\s*:/
  );
});

test('src/sw.js versions CSS cache (bp-css-styles-*), invalidates stale CSS caches on activate, and notifies clients on CSS updates', async () => {
  const swSource = fs.readFileSync(path.join(ROOT, 'src/sw.js'), 'utf8');
  assert.match(swSource, /const CSS_CACHE_VERSION\s*=\s*'liquid-glass-v18-\d+'/);
  assert.match(swSource, /const CSS_CACHE\s*=\s*`bp-css-styles-\$\{CSS_CACHE_VERSION\}`/);
  assert.match(swSource, /CACHE_CONTROL_CSS_VERSIONED\s*=\s*'public, max-age=0, must-revalidate'/);

  const listeners: Record<string, Function[]> = {};
  const cacheStores = new Map<string, Map<string, Response>>();
  const deletedCaches: string[] = [];
  const postedMessages: unknown[] = [];

  const getStore = (name: string) => {
    let store = cacheStores.get(name);
    if (!store) {
      store = new Map<string, Response>();
      cacheStores.set(name, store);
    }
    return store;
  };
  getStore('bp-css-styles-liquid-glass-v18-old');

  let cssFetchCount = 0;
  const sandbox = {
    URL,
    Headers,
    Response,
    Request,
    AbortController,
    setTimeout,
    clearTimeout,
    fetch: async (req: Request | string) => {
      const target = typeof req === 'string' ? req : req.url;
      if (target.endsWith('/theme.css')) {
        cssFetchCount += 1;
        return new Response(`body { --pass: ${cssFetchCount}; }`, {
          status: 200,
          headers: {
            'Content-Type': 'text/css',
            ETag: `"etag-v${cssFetchCount}"`,
          },
        });
      }
      return new Response('body { color: #fff; }', {
        status: 200,
        headers: { 'Content-Type': 'text/css' },
      });
    },
    self: {
      location: { origin: 'https://app.example.com' },
      skipWaiting: async () => undefined,
      clients: {
        claim: async () => undefined,
        matchAll: async () => [
          {
            postMessage(payload: unknown) {
              postedMessages.push(payload);
            },
          },
        ],
      },
      addEventListener(type: string, fn: Function) {
        listeners[type] = listeners[type] || [];
        listeners[type].push(fn);
      },
    },
    caches: {
      open: async (name: string) => {
        const store = getStore(name);
        return {
          add: async () => undefined,
          match: async (req: Request | string) => {
            const key = typeof req === 'string' ? req : req.url;
            return store.get(key);
          },
          put: async (req: Request | string, res: Response) => {
            const key = typeof req === 'string' ? req : req.url;
            store.set(key, res);
          },
        };
      },
      keys: async () => Array.from(cacheStores.keys()),
      delete: async (name: string) => {
        deletedCaches.push(name);
        return cacheStores.delete(name);
      },
    },
  };

  vm.runInNewContext(swSource, sandbox);

  // Activate cleans stale bp-css-styles-* caches and notifies clients
  const activateWaits: Promise<unknown>[] = [];
  listeners.activate[0]({ waitUntil: (p: Promise<unknown>) => activateWaits.push(p) });
  await Promise.all(activateWaits);
  assert.ok(deletedCaches.includes('bp-css-styles-liquid-glass-v18-old'));
  assert.ok(
    postedMessages.some(
      (m: any) => m?.type === 'SW_CSS_VERSION_ACTIVATED' && typeof m?.cssVersion === 'string'
    )
  );

  const dispatchCssFetch = async (url: string) => {
    let responsePromise: Promise<Response> | null = null;
    const waitPromises: Promise<unknown>[] = [];
    listeners.fetch[0]({
      request: { url, method: 'GET', mode: 'no-cors', destination: 'style' },
      respondWith: (p: Promise<Response>) => {
        responsePromise = p;
      },
      waitUntil: (p: Promise<unknown>) => waitPromises.push(p),
    });
    const res = responsePromise ? await responsePromise : null;
    await Promise.allSettled(waitPromises);
    return res;
  };

  // Hashed CSS bundle gets immutable cache + X-SW-CSS-Version
  const hashedCssRes = await dispatchCssFetch('https://app.example.com/assets/index-Ab12Cd34.css');
  assert.ok(hashedCssRes);
  assert.equal(hashedCssRes.headers.get('Cache-Control'), 'public, max-age=31536000, immutable');
  assert.match(hashedCssRes.headers.get('X-SW-CSS-Version') || '', /^liquid-glass-v18-/);

  // Unhashed CSS gets Network-First + must-revalidate + notifies clients when ETag changes
  const firstThemeCss = await dispatchCssFetch('https://app.example.com/theme.css');
  assert.ok(firstThemeCss);
  assert.equal(firstThemeCss.headers.get('Cache-Control'), 'public, max-age=0, must-revalidate');
  assert.match(firstThemeCss.headers.get('X-SW-CSS-Version') || '', /^liquid-glass-v18-/);

  const secondThemeCss = await dispatchCssFetch('https://app.example.com/theme.css');
  assert.ok(secondThemeCss);
  assert.ok(
    postedMessages.some(
      (m: any) =>
        m?.type === 'CSS_CACHE_UPDATED' && m?.url === 'https://app.example.com/theme.css'
    )
  );
});

test('serviceWorkerRegistration helpers extract shell CSS hrefs and refresh active stylesheets without page reload', async () => {
  const {
    buildVersionedStylesheetHref,
    extractStylesheetHrefsFromHtml,
    refreshPageStylesheets,
  } = await import('../src/lib/serviceWorkerRegistration');

  assert.equal(
    buildVersionedStylesheetHref('/theme.css', 'liquid-glass-v18-2', 'https://app.example.com'),
    '/theme.css?sw-css-v=liquid-glass-v18-2'
  );
  assert.equal(
    buildVersionedStylesheetHref('https://cdn.other.com/theme.css', 'v2', 'https://app.example.com'),
    null
  );

  const html = `
    <html><head>
      <link rel="stylesheet" href="/assets/index-NewHash99.css" />
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter" />
    </head></html>
  `;
  assert.deepEqual(extractStylesheetHrefsFromHtml(html, 'https://app.example.com'), [
    '/assets/index-NewHash99.css',
  ]);

  const attrs = new Map<string, string>([['href', '/theme.css']]);
  const mockLink = {
    href: 'https://app.example.com/theme.css',
    getAttribute: (name: string) => attrs.get(name) ?? null,
    setAttribute: (name: string, value: string) => attrs.set(name, value),
  };
  const mockDoc = {
    querySelectorAll: () => [mockLink],
  } as unknown as Document;

  const updated = refreshPageStylesheets(
    mockDoc,
    'liquid-glass-v18-2',
    'https://app.example.com/theme.css',
    'https://app.example.com'
  );
  assert.equal(updated, 1);
  assert.equal(attrs.get('href'), '/theme.css?sw-css-v=liquid-glass-v18-2');
});

