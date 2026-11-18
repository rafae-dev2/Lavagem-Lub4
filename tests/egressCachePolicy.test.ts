import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildApoioWatermark,
  buildSchedulesWatermark,
  hasApoioSyncChanged,
  loadWithConditionalCache,
  resolveSchedulesAutoRefreshMs,
  SCHEDULES_ACTIVE_REFRESH_MS,
  SCHEDULES_BACKGROUND_REFRESH_MS,
  SharedSnapshotCache,
  shouldRunInitialMountSync,
} from '../src/lib/egressCachePolicy';

test('SharedSnapshotCache returns fresh entries within TTL and expires after TTL', () => {
  const cache = new SharedSnapshotCache<string>({ freshTtlMs: 90_000, maxVersionAgeMs: 300_000 });
  cache.store('snapshot-v1', 'ver-1', 10_000);

  assert.equal(cache.peekFresh(50_000), 'snapshot-v1');
  assert.equal(cache.peekFresh(100_000), null);
  assert.equal(cache.peekWithVersion('ver-1', 150_000), 'snapshot-v1');
  assert.equal(cache.peekWithVersion('ver-2', 150_000), null);
  assert.equal(cache.peekWithVersion('ver-1', 310_001), null);
});

test('loadWithConditionalCache skips full download on fresh TTL and matching server version', async () => {
  const cache = new SharedSnapshotCache<{ rows: number }>({
    freshTtlMs: 50,
    maxVersionAgeMs: 5_000,
  });

  let fullCalls = 0;
  let versionCalls = 0;
  let currentVersion = 'v1';

  const first = await loadWithConditionalCache({
    cache,
    now: 1_000,
    fetchVersion: async () => {
      versionCalls += 1;
      return currentVersion;
    },
    fetchFull: async () => {
      fullCalls += 1;
      return { value: { rows: fullCalls }, version: currentVersion };
    },
  });
  assert.deepEqual(first, { rows: 1 });
  assert.equal(fullCalls, 1);
  assert.equal(versionCalls, 0);

  // Immediately after, fresh cache serves without version or full call
  const fresh = await loadWithConditionalCache({
    cache,
    now: Date.now(),
    fetchVersion: async () => {
      versionCalls += 1;
      return currentVersion;
    },
    fetchFull: async () => {
      fullCalls += 1;
      return { value: { rows: fullCalls }, version: currentVersion };
    },
  });
  assert.deepEqual(fresh, { rows: 1 });
  assert.equal(fullCalls, 1);
  assert.equal(versionCalls, 0);

  // Wait beyond 50ms fresh TTL so conditional watermark check runs and avoids full reload
  await new Promise((resolve) => setTimeout(resolve, 65));
  const conditionalHit = await loadWithConditionalCache({
    cache,
    now: Date.now(),
    fetchVersion: async () => {
      versionCalls += 1;
      return currentVersion;
    },
    fetchFull: async () => {
      fullCalls += 1;
      return { value: { rows: fullCalls }, version: currentVersion };
    },
  });
  assert.deepEqual(conditionalHit, { rows: 1 });
  assert.equal(versionCalls, 1);
  assert.equal(fullCalls, 1);

  // Version mismatch triggers a full reload and updates cached snapshot
  currentVersion = 'v2';
  await new Promise((resolve) => setTimeout(resolve, 65));
  const conditionalMiss = await loadWithConditionalCache({
    cache,
    now: Date.now(),
    fetchVersion: async () => {
      versionCalls += 1;
      return currentVersion;
    },
    fetchFull: async () => {
      fullCalls += 1;
      return { value: { rows: 99 }, version: currentVersion };
    },
  });
  assert.deepEqual(conditionalMiss, { rows: 99 });
  assert.equal(versionCalls, 2);
  assert.equal(fullCalls, 2);

  // Force bypasses fresh TTL and always reloads
  const forced = await loadWithConditionalCache({
    cache,
    force: true,
    now: Date.now(),
    fetchVersion: async () => {
      versionCalls += 1;
      return currentVersion;
    },
    fetchFull: async () => {
      fullCalls += 1;
      return { value: { rows: 100 }, version: currentVersion };
    },
  });
  assert.deepEqual(forced, { rows: 100 });
  assert.equal(fullCalls, 3);
});

test('loadWithConditionalCache coalesces concurrent requests into one full fetch', async () => {
  const cache = new SharedSnapshotCache<string>();
  let fullCalls = 0;

  const [a, b, c] = await Promise.all([
    loadWithConditionalCache({
      cache,
      force: true,
      fetchFull: async () => {
        fullCalls += 1;
        await new Promise((resolve) => setTimeout(resolve, 15));
        return { value: 'shared', version: 'v1' };
      },
    }),
    loadWithConditionalCache({
      cache,
      force: true,
      fetchFull: async () => {
        fullCalls += 1;
        return { value: 'shared-2', version: 'v2' };
      },
    }),
    loadWithConditionalCache({
      cache,
      force: true,
      fetchFull: async () => {
        fullCalls += 1;
        return { value: 'shared-3', version: 'v3' };
      },
    }),
  ]);

  assert.equal(fullCalls, 1);
  assert.equal(a, 'shared');
  assert.equal(b, 'shared');
  assert.equal(c, 'shared');
});

test('hasApoioSyncChanged ignores heartbeat-only timestamps and detects material changes', () => {
  const base = {
    fonte_atualizada: '2026-11-15T12:00:00Z',
    total: 1240,
    erro: null,
  };
  // Identical material fields (regardless of consultado_em / sincronizado_em elsewhere)
  assert.equal(
    hasApoioSyncChanged(base, {
      fonte_atualizada: '2026-11-15T12:00:00Z',
      total: 1240,
      erro: null,
    }),
    false,
  );
  // Material changes in fonte_atualizada, total, or erro
  assert.equal(
    hasApoioSyncChanged(base, { ...base, fonte_atualizada: '2026-11-15T12:05:00Z' }),
    true,
  );
  assert.equal(hasApoioSyncChanged(base, { ...base, total: 1241 }), true);
  assert.equal(hasApoioSyncChanged(base, { ...base, erro: 'Falha HTTP 500' }), true);
  assert.equal(hasApoioSyncChanged(null, base), true);
  assert.equal(hasApoioSyncChanged(base, null), true);
});

test('buildApoioWatermark and buildSchedulesWatermark serialize versions deterministically', () => {
  assert.equal(
    buildApoioWatermark({ fonte_atualizada: '2026-11-15T12:00:00Z', total: 500, erro: null }, 12, 84),
    '2026-11-15T12:00:00Z|500||12|84',
  );
  assert.equal(buildApoioWatermark(null), null);
  assert.equal(buildSchedulesWatermark(320, 4451, '2026-11-15T12:10:00Z'), '320:4451:2026-11-15T12:10:00Z');
});

test('mount reuse and adaptive lavagem polling follow economic cadence', () => {
  assert.equal(
    shouldRunInitialMountSync({ hasCache: true, cacheTimestamp: 100_000, now: 150_000 }),
    false,
  );
  assert.equal(
    shouldRunInitialMountSync({ hasCache: true, cacheTimestamp: 100_000, now: 200_000 }),
    true,
  );
  assert.equal(
    shouldRunInitialMountSync({ hasCache: false, cacheTimestamp: null, now: 200_000 }),
    true,
  );
  assert.equal(resolveSchedulesAutoRefreshMs(true), SCHEDULES_ACTIVE_REFRESH_MS);
  assert.equal(resolveSchedulesAutoRefreshMs(false), SCHEDULES_BACKGROUND_REFRESH_MS);
  assert.ok(SCHEDULES_ACTIVE_REFRESH_MS >= 120_000);
  assert.ok(SCHEDULES_BACKGROUND_REFRESH_MS > SCHEDULES_ACTIVE_REFRESH_MS);
});
