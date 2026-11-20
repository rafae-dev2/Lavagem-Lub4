import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { detectIOSDevice, resolvePWAInstallMode } from '../src/hooks/usePWAInstall';

const ROOT = process.cwd();

function readPngDimensions(filePath: string): { width: number; height: number } {
  const buf = fs.readFileSync(filePath);
  // PNG signature: 89 50 4E 47 0D 0A 1A 0A
  assert.equal(buf[0], 0x89, `${filePath} must have PNG signature`);
  assert.equal(buf.toString('ascii', 1, 4), 'PNG', `${filePath} must be PNG`);
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  return { width, height };
}

test('resolvePWAInstallMode resolves installed, native, ios-guide, and manual-guide states', () => {
  assert.equal(
    resolvePWAInstallMode({ isStandalone: true, isIOS: true, hasDeferredPrompt: true }),
    'installed',
  );
  assert.equal(
    resolvePWAInstallMode({ isStandalone: false, isIOS: false, hasDeferredPrompt: true }),
    'native',
  );
  assert.equal(
    resolvePWAInstallMode({ isStandalone: false, isIOS: true, hasDeferredPrompt: false }),
    'ios-guide',
  );
  assert.equal(
    resolvePWAInstallMode({ isStandalone: false, isIOS: false, hasDeferredPrompt: false }),
    'manual-guide',
  );
});

test('detectIOSDevice identifies iPhone/iPad/iPod user agents accurately', () => {
  assert.equal(
    detectIOSDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X)'),
    true,
  );
  assert.equal(
    detectIOSDevice('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)'),
    true,
  );
  assert.equal(
    detectIOSDevice('Mozilla/5.0 (Linux; Android 14; Pixel 8)'),
    false,
  );
  assert.equal(detectIOSDevice(''), false);
});

test('PWA manifest is complete and all referenced 512x512, 192x192 and apple-touch PNG icons exist with exact dimensions', () => {
  const manifestPath = path.join(ROOT, 'public', 'manifest.webmanifest');
  assert.ok(fs.existsSync(manifestPath), 'public/manifest.webmanifest must exist');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  assert.equal(manifest.id, '/');
  assert.equal(manifest.start_url, '/');
  assert.equal(manifest.scope, '/');
  assert.equal(manifest.display, 'standalone');
  assert.ok(typeof manifest.name === 'string' && manifest.name.length > 5);
  assert.ok(
    typeof manifest.short_name === 'string' && manifest.short_name.length <= 12,
    'short_name must be <= 12 characters',
  );
  assert.ok(Array.isArray(manifest.icons) && manifest.icons.length >= 4);

  const requiredSpecs = [
    { src: '/pwa-192x192.png', sizes: '192x192', purpose: 'any', width: 192, height: 192 },
    { src: '/pwa-512x512.png', sizes: '512x512', purpose: 'any', width: 512, height: 512 },
    { src: '/pwa-maskable-192x192.png', sizes: '192x192', purpose: 'maskable', width: 192, height: 192 },
    { src: '/pwa-maskable-512x512.png', sizes: '512x512', purpose: 'maskable', width: 512, height: 512 },
  ];

  for (const spec of requiredSpecs) {
    const entry = manifest.icons.find(
      (i: { src: string; sizes: string; purpose?: string }) =>
        i.src === spec.src && i.sizes === spec.sizes && i.purpose === spec.purpose,
    );
    assert.ok(entry, `manifest must declare ${spec.src} (${spec.sizes}, purpose: ${spec.purpose})`);
    assert.equal(entry.type, 'image/png');
    const diskPath = path.join(ROOT, 'public', spec.src.replace(/^\//, ''));
    assert.ok(fs.existsSync(diskPath), `${diskPath} must exist on disk`);
    const dims = readPngDimensions(diskPath);
    assert.deepEqual(dims, { width: spec.width, height: spec.height });
  }

  // Verify iOS apple-touch-icon (180x180)
  const appleIconPath = path.join(ROOT, 'public', 'apple-touch-icon.png');
  assert.ok(fs.existsSync(appleIconPath), 'public/apple-touch-icon.png must exist');
  assert.deepEqual(readPngDimensions(appleIconPath), { width: 180, height: 180 });
});

test('index.html, sw.js, Configuracoes, and Layout wire PWA manifest, icons, and install button', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  assert.match(html, /rel="manifest"\s+href="\/manifest\.webmanifest"/);
  assert.match(html, /rel="apple-touch-icon"\s+sizes="180x180"\s+href="\/apple-touch-icon\.png"/);
  assert.match(html, /href="\/pwa-192x192\.png"/);
  assert.match(html, /href="\/pwa-512x512\.png"/);
  assert.match(html, /name="apple-mobile-web-app-capable"\s+content="yes"/);

  const sw = fs.readFileSync(path.join(ROOT, 'src', 'sw.js'), 'utf8');
  assert.match(sw, /'\/manifest\.webmanifest'/);
  assert.match(sw, /'\/pwa-512x512\.png'/);
  assert.match(sw, /'\/pwa-maskable-512x512\.png'/);

  const configTsx = fs.readFileSync(path.join(ROOT, 'src', 'pages', 'Configuracoes.tsx'), 'utf8');
  assert.match(configTsx, /PWAInstallButton/);
  assert.match(configTsx, /variant="card"/);

  const layoutTsx = fs.readFileSync(path.join(ROOT, 'src', 'components', 'Layout.tsx'), 'utf8');
  assert.match(layoutTsx, /PWAInstallButton/);
});

test('Calda App Glass CSS and React charts cover Lavagem/Lubrificação and all app modules', () => {
  const caldaCss = fs.readFileSync(path.join(ROOT, 'src', 'styles', 'calda.css'), 'utf8');
  const requiredSelectors = [
    'html.dark.theme-calda .app-shell.app-shell--lub > div > main',
    'html.theme-calda .app-shell .lavagem-premium',
    'html.theme-calda .app-shell .lavagem-premium .lub-module',
    'html.theme-calda .app-shell .lavagem-premium .lub-module .lub-detail',
    'html.theme-calda .app-shell .lavagem-premium .lub-module .lub-table',
    'html.theme-calda .app-shell .lavagem-premium .lub-module .lub-kpi',
    'html.theme-calda .app-shell .lavagem-premium .lavagem-perf-soft-warning',
    'html.theme-calda .app-shell .verdan-widget-card',
    'html.theme-calda .app-shell .apoio-reference',
    'html.theme-calda .app-shell .maintenance-tracking',
    'html.theme-calda .app-shell .equipment-image-manager',
    'html.theme-calda .tv-monitor',
    'html.theme-calda .historico-frota-modal',
  ];
  for (const sel of requiredSelectors) {
    assert.ok(caldaCss.includes(sel), `calda.css must style ${sel}`);
  }

  const dashboardTsx = fs.readFileSync(path.join(ROOT, 'src', 'pages', 'Dashboard.tsx'), 'utf8');
  assert.match(dashboardTsx, /const isCalda = theme === 'calda'/);

  const programacoesTsx = fs.readFileSync(path.join(ROOT, 'src', 'pages', 'Programacoes.tsx'), 'utf8');
  assert.match(programacoesTsx, /const isCalda = theme === 'calda'/);
});
