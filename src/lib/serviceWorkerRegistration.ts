export interface ServiceWorkerEnvLike {
  hasServiceWorker: boolean;
  protocol: string;
  hostname: string;
}

export interface ServiceWorkerCssMessage {
  type?: string;
  cssVersion?: string;
  url?: string;
}

const SW_UPDATE_CHECK_THROTTLE_MS = 3 * 60 * 1000;

export function shouldRegisterServiceWorker(env: ServiceWorkerEnvLike): boolean {
  if (!env.hasServiceWorker) return false;
  if (env.protocol === 'https:') return true;
  return (
    env.protocol === 'http:' &&
    (env.hostname === 'localhost' || env.hostname === '127.0.0.1' || env.hostname === '[::1]')
  );
}

export function buildVersionedStylesheetHref(
  href: string,
  version: string,
  origin: string = typeof window !== 'undefined' ? window.location.origin : 'https://app.example.com'
): string | null {
  if (!href || !version) return null;
  try {
    const parsed = new URL(href, origin);
    if (parsed.origin !== origin) return null;
    if (!/\.css$/i.test(parsed.pathname)) return null;
    parsed.searchParams.set('sw-css-v', version);
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return null;
  }
}

export function extractStylesheetHrefsFromHtml(
  html: string,
  origin: string = typeof window !== 'undefined' ? window.location.origin : 'https://app.example.com'
): string[] {
  if (!html) return [];
  const results: string[] = [];
  const seen = new Set<string>();
  const linkPattern = /<link\b[^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = linkPattern.exec(html)) !== null) {
    const tag = match[0];
    if (!/rel\s*=\s*["']?stylesheet["']?/i.test(tag)) continue;
    const hrefMatch = tag.match(/href\s*=\s*["']([^"']+)["']/i);
    const rawHref = hrefMatch?.[1]?.trim();
    if (!rawHref) continue;
    try {
      const resolved = new URL(rawHref, origin);
      if (resolved.origin !== origin) continue;
      const relative = `${resolved.pathname}${resolved.search}`;
      if (!seen.has(relative)) {
        seen.add(relative);
        results.push(relative);
      }
    } catch {
      // Ignore malformed hrefs
    }
  }
  return results;
}

export function refreshPageStylesheets(
  doc: Document,
  version: string,
  targetUrl?: string,
  origin: string = typeof window !== 'undefined' ? window.location.origin : 'https://app.example.com'
): number {
  const links = Array.from(doc.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'));
  let updatedCount = 0;

  for (const link of links) {
    const rawHref = link.getAttribute('href') || link.href;
    if (!rawHref) continue;
    if (targetUrl) {
      try {
        const targetParsed = new URL(targetUrl, origin);
        const linkParsed = new URL(rawHref, origin);
        if (targetParsed.pathname !== linkParsed.pathname) continue;
      } catch {
        continue;
      }
    }
    const nextHref = buildVersionedStylesheetHref(rawHref, version, origin);
    if (nextHref && nextHref !== rawHref) {
      link.setAttribute('href', nextHref);
      updatedCount += 1;
    }
  }

  return updatedCount;
}

async function syncProductionStylesheetsFromShell(version: string): Promise<void> {
  if (typeof document === 'undefined' || typeof fetch === 'undefined') return;
  try {
    const res = await fetch('/index.html', { cache: 'no-store' });
    if (!res.ok) return;
    const html = await res.text();
    const origin = window.location.origin;
    const nextHrefs = extractStylesheetHrefsFromHtml(html, origin);
    if (!nextHrefs.length) return;

    const currentLinks = Array.from(
      document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')
    );
    const currentPaths = new Set(
      currentLinks
        .map((link) => {
          try {
            return new URL(link.href, origin).pathname;
          } catch {
            return '';
          }
        })
        .filter(Boolean)
    );

    const newHrefs = nextHrefs.filter((href) => {
      try {
        const path = new URL(href, origin).pathname;
        return !currentPaths.has(path);
      } catch {
        return false;
      }
    });

    if (!newHrefs.length) {
      refreshPageStylesheets(document, version, undefined, origin);
      return;
    }

    for (const href of newHrefs) {
      const replacement = document.createElement('link');
      replacement.rel = 'stylesheet';
      replacement.href = href;
      replacement.dataset.swCssVersion = version;
      document.head.appendChild(replacement);
    }
  } catch {
    // Offline or transient failure: fallback to versioned query refresh
    refreshPageStylesheets(document, version);
  }
}

export function registerAppServiceWorker(): void {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return;

  const allowed = shouldRegisterServiceWorker({
    hasServiceWorker: 'serviceWorker' in navigator,
    protocol: window.location.protocol,
    hostname: window.location.hostname,
  });

  if (!allowed) return;

  let lastAppliedCssVersion = '';
  let lastUpdateCheckAt = 0;

  const handleSwMessage = (event: MessageEvent<ServiceWorkerCssMessage>) => {
    const data = event.data;
    if (!data || typeof data !== 'object') return;

    if (data.type === 'CSS_CACHE_UPDATED' && data.cssVersion) {
      const stamp = `${data.cssVersion}-${Date.now()}`;
      refreshPageStylesheets(document, stamp, data.url);
      return;
    }

    if (data.type === 'SW_CSS_VERSION_ACTIVATED' && data.cssVersion) {
      if (lastAppliedCssVersion === data.cssVersion) return;
      lastAppliedCssVersion = data.cssVersion;
      void syncProductionStylesheetsFromShell(data.cssVersion);
    }
  };

  const startRegistration = () => {
    navigator.serviceWorker.addEventListener('message', handleSwMessage);

    navigator.serviceWorker
      .register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .then((registration) => {
        const checkForUpdates = () => {
          if (document.visibilityState !== 'visible') return;
          if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
          const now = Date.now();
          if (now - lastUpdateCheckAt < SW_UPDATE_CHECK_THROTTLE_MS) return;
          lastUpdateCheckAt = now;
          void registration.update().catch(() => undefined);
        };

        document.addEventListener('visibilitychange', checkForUpdates);
        window.addEventListener('online', () => {
          lastUpdateCheckAt = 0;
          checkForUpdates();
        });
      })
      .catch((error) => {
        console.warn('[sw] Registro do cache offline indisponível neste ambiente:', error);
      });
  };

  if (document.readyState === 'complete') {
    startRegistration();
    return;
  }

  window.addEventListener('load', startRegistration, { once: true });
}
