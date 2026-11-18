import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatOfflineLastSync,
  resolveOfflinePresentation,
  shouldRenderOfflineBanner,
} from '../src/lib/offlineStatus';

test('formatOfflineLastSync handles null, whitespace, and valid timestamps', () => {
  assert.equal(formatOfflineLastSync(null), 'Nunca sincronizado');
  assert.equal(formatOfflineLastSync('   '), 'Nunca sincronizado');
  assert.equal(formatOfflineLastSync(' 16/11/2026 14:20 '), '16/11/2026 14:20');
});

test('resolveOfflinePresentation returns detailed offline messaging and disables manual sync', () => {
  const result = resolveOfflinePresentation({
    online: false,
    wasOffline: true,
    syncing: false,
    fromCache: true,
    lastSync: '16/11/2026 14:10',
    offlineSince: '14:15',
  });

  assert.equal(result.phase, 'offline');
  assert.equal(result.isOffline, true);
  assert.equal(result.sidebarStatusLabel, 'Modo Offline');
  assert.equal(result.sidebarStatusTone, 'offline');
  assert.equal(result.headerBadgeLabel, 'Offline');
  assert.equal(result.syncButtonDisabled, true);
  assert.match(result.bannerTitle, /offline/i);
  assert.match(
    result.bannerDescription,
    /sincronizados automaticamente assim que a conexão retornar/i,
  );
  assert.match(result.bannerConnectionLabel, /14:15/);
  assert.match(result.bannerCacheLabel, /Cache local ativo/);
  assert.match(result.bannerCacheLabel, /16\/11\/2026 14:10/);
});

test('resolveOfflinePresentation transitions through reconnecting state when connection returns', () => {
  const whileSyncing = resolveOfflinePresentation({
    online: true,
    wasOffline: true,
    syncing: true,
    fromCache: true,
    lastSync: '16/11/2026 14:10',
  });

  assert.equal(whileSyncing.phase, 'reconnecting');
  assert.equal(whileSyncing.isOffline, false);
  assert.equal(whileSyncing.sidebarStatusLabel, 'Reconectando...');
  assert.equal(whileSyncing.sidebarStatusTone, 'reconnecting');
  assert.equal(whileSyncing.headerBadgeLabel, 'Sincronizando...');
  assert.equal(whileSyncing.syncButtonDisabled, true);
  assert.match(whileSyncing.bannerTitle, /Conexão restabelecida/i);

  const afterSync = resolveOfflinePresentation({
    online: true,
    wasOffline: true,
    syncing: false,
    fromCache: false,
    lastSync: '16/11/2026 14:25',
  });

  assert.equal(afterSync.phase, 'reconnecting');
  assert.equal(afterSync.sidebarStatusLabel, 'Conexão ativa');
  assert.equal(afterSync.headerBadgeLabel, 'Reconectado');
  assert.equal(afterSync.syncButtonDisabled, false);
  assert.match(afterSync.bannerSyncLabel, /concluída/i);
});

test('resolveOfflinePresentation preserves standard online labels when online', () => {
  const normal = resolveOfflinePresentation({
    online: true,
    wasOffline: false,
    syncing: false,
    fromCache: false,
    lastSync: '16/11/2026 14:25',
  });
  assert.equal(normal.phase, 'online');
  assert.equal(normal.sidebarStatusLabel, 'Supabase');
  assert.equal(normal.sidebarStatusTone, 'online');
  assert.equal(normal.headerBadgeLabel, null);
  assert.equal(normal.syncButtonDisabled, false);

  const cached = resolveOfflinePresentation({
    online: true,
    wasOffline: false,
    syncing: false,
    fromCache: true,
    lastSync: 'Cache local (há 2 min)',
  });
  assert.equal(cached.sidebarStatusLabel, 'Cache local');
  assert.equal(cached.sidebarStatusTone, 'cache');

  const syncing = resolveOfflinePresentation({
    online: true,
    wasOffline: false,
    syncing: true,
    fromCache: false,
    lastSync: null,
  });
  assert.equal(syncing.sidebarStatusLabel, 'Sincronizando...');
  assert.equal(syncing.sidebarStatusTone, 'syncing');
  assert.equal(syncing.syncButtonDisabled, true);
});

test('shouldRenderOfflineBanner controls visibility for offline, collapsed, reconnecting, and online', () => {
  assert.equal(shouldRenderOfflineBanner({ phase: 'online', bannerCollapsed: false }), false);
  assert.equal(shouldRenderOfflineBanner({ phase: 'offline', bannerCollapsed: false }), true);
  assert.equal(shouldRenderOfflineBanner({ phase: 'offline', bannerCollapsed: true }), false);
  assert.equal(shouldRenderOfflineBanner({ phase: 'reconnecting', bannerCollapsed: true }), true);
});
