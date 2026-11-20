import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  buildSyncStatusIndicatorState,
  formatCountdownClock,
  formatNextSyncCountdown,
  formatRelativeLastSync,
  parseLastSyncTimestamp,
} from '../src/lib/syncRelativeTime';
import {
  areDashboardStatsEqual,
  computeScheduleStats,
  computeVisibleSchedules,
} from '../src/lib/scheduleVisibility';
import type { Programacao } from '../src/types';

const ROOT = process.cwd();

function makeSchedule(overrides: Partial<Programacao>): Programacao {
  return {
    id: overrides.id ?? '1',
    frota: overrides.frota ?? '4580',
    tipoEquipamento: overrides.tipoEquipamento ?? 'Caminhão Pipa',
    tipoLavagem: overrides.tipoLavagem ?? 'LAVAGEM',
    situacao: overrides.situacao ?? 'PROGRAMADO',
    dataProgramada: overrides.dataProgramada ?? '2026-11-19',
    horarioAgendado: overrides.horarioAgendado ?? '08:00',
    local: overrides.local ?? 'LAVADOR',
    observacoes: overrides.observacoes ?? '',
    createdAt: overrides.createdAt ?? '2026-11-19T10:00:00Z',
    updatedAt: overrides.updatedAt ?? '2026-11-19T10:00:00Z',
    ...overrides,
  };
}

test('parseLastSyncTimestamp handles ISO, Brazilian datetime, cache age, and invalid values', () => {
  const now = Date.UTC(2026, 10, 19, 20, 45, 0);

  const iso = parseLastSyncTimestamp('2026-11-19T20:40:00.000Z', now);
  assert.equal(iso, Date.UTC(2026, 10, 19, 20, 40, 0));

  const brFull = parseLastSyncTimestamp('19/11/2026, 17:40:12', now);
  assert.ok(brFull !== null && Number.isFinite(brFull));
  const brDate = new Date(brFull!);
  assert.equal(brDate.getFullYear(), 2026);
  assert.equal(brDate.getMonth(), 10);
  assert.equal(brDate.getDate(), 19);
  assert.equal(brDate.getHours(), 17);
  assert.equal(brDate.getMinutes(), 40);
  assert.equal(brDate.getSeconds(), 12);

  const brShort = parseLastSyncTimestamp('19/11/2026 17:40', now);
  assert.ok(brShort !== null && new Date(brShort).getSeconds() === 0);

  const cacheMins = parseLastSyncTimestamp('Cache local (há 3 min)', now);
  assert.equal(cacheMins, now - 3 * 60_000);

  const cacheLessThanOne = parseLastSyncTimestamp('Cache local (há menos de 1 min)', now);
  assert.equal(cacheLessThanOne, now - 30_000);

  assert.equal(parseLastSyncTimestamp(null, now), null);
  assert.equal(parseLastSyncTimestamp('   ', now), null);
  assert.equal(parseLastSyncTimestamp('texto inválido', now), null);
});

test('formatRelativeLastSync formats elapsed time via Intl.RelativeTimeFormat', () => {
  const now = 1_800_000_000_000;
  assert.equal(formatRelativeLastSync(null, now), 'Nunca sincronizado');
  assert.equal(formatRelativeLastSync(now - 2_000, now), 'agora mesmo');

  const secLabel = formatRelativeLastSync(now - 22_000, now, 'pt-BR');
  assert.match(secLabel, /22/);
  assert.match(secLabel, /h[aá]/i);

  const minLabel = formatRelativeLastSync(now - 5 * 60_000, now, 'pt-BR');
  assert.match(minLabel, /5/);
  assert.match(minLabel, /min/i);

  const hourLabel = formatRelativeLastSync(now - 2 * 3_600_000, now, 'pt-BR');
  assert.match(hourLabel, /2/);
});

test('formatNextSyncCountdown computes clock, progress percentage, and future Intl.RelativeTimeFormat', () => {
  const base = 1_800_000_000_000;
  assert.equal(formatCountdownClock(90_000), '01:30');
  assert.equal(formatCountdownClock(3_665_000), '1:01:05');

  const cd90 = formatNextSyncCountdown(base, base + 30_000, 120_000, 'pt-BR');
  assert.ok(cd90);
  assert.equal(cd90.clockLabel, '01:30');
  assert.equal(cd90.progressPct, 75);
  assert.equal(cd90.isDue, false);
  assert.match(cd90.relativeLabel, /em\s+2/i);

  const cd35 = formatNextSyncCountdown(base, base + 85_000, 120_000, 'pt-BR');
  assert.ok(cd35);
  assert.equal(cd35.clockLabel, '00:35');
  assert.match(cd35.relativeLabel, /35/);

  const cdDue = formatNextSyncCountdown(base, base + 125_000, 120_000, 'pt-BR');
  assert.ok(cdDue);
  assert.equal(cdDue.isDue, true);
  assert.equal(cdDue.clockLabel, '00:00');
  assert.equal(cdDue.progressPct, 0);
});

test('buildSyncStatusIndicatorState transitions cleanly across fresh, cache, syncing, offline, and idle', () => {
  const base = 1_800_000_000_000;

  const fresh = buildSyncStatusIndicatorState({
    lastSync: '19/11/2026, 17:40:00',
    lastSyncMs: base,
    syncing: false,
    online: true,
    fromCache: false,
    refreshIntervalMs: 120_000,
    nowMs: base + 30_000,
  });
  assert.equal(fresh.tone, 'fresh');
  assert.match(fresh.headerSummary, /Atualizado/);
  assert.equal(fresh.headerCountdown, 'próx. 01:30');
  assert.match(fresh.tooltip, /Última atualização/);

  const syncingState = buildSyncStatusIndicatorState({
    lastSync: '19/11/2026, 17:40:00',
    lastSyncMs: base,
    syncing: true,
    online: true,
    refreshIntervalMs: 120_000,
    nowMs: base + 30_000,
  });
  assert.equal(syncingState.tone, 'syncing');
  assert.equal(syncingState.countdown, null);

  const offlineState = buildSyncStatusIndicatorState({
    lastSync: '19/11/2026, 17:40:00',
    lastSyncMs: base,
    syncing: false,
    online: false,
    refreshIntervalMs: 120_000,
    nowMs: base + 65_000,
  });
  assert.equal(offlineState.tone, 'offline');
  assert.equal(offlineState.countdown, null);
  assert.match(offlineState.headerSummary, /Cache/);

  const cacheState = buildSyncStatusIndicatorState({
    lastSync: 'Cache local (há 1 min)',
    lastSyncMs: null,
    syncing: false,
    online: true,
    fromCache: true,
    refreshIntervalMs: 120_000,
    nowMs: base,
  });
  assert.equal(cacheState.tone, 'cache');
  assert.ok(cacheState.countdown !== null);
});

test('computeVisibleSchedules preserves array identity when nothing is hidden and filters closed items before cutoff', () => {
  const now = new Date('2026-11-19T12:00:00-03:00');
  const openOnly = [
    makeSchedule({ id: '1', situacao: 'PROGRAMADO' }),
    makeSchedule({ id: '2', situacao: 'ATRASADO' }),
  ];

  // When hideEncerradas is false, returns the exact same reference
  assert.equal(computeVisibleSchedules(openOnly, false, now), openOnly);
  // When hideEncerradas is true but nothing qualifies to hide, also preserves reference
  assert.equal(computeVisibleSchedules(openOnly, true, now), openOnly);

  const mixed = [
    ...openOnly,
    makeSchedule({
      id: '3',
      situacao: 'ENCERRADO',
      dataRealizada: '2026-11-18',
      horarioAgendado: '18:00',
    }),
    makeSchedule({
      id: '4',
      situacao: 'ENCERRADO',
      dataRealizada: '2026-11-19',
      horarioAgendado: '09:30',
    }),
  ];
  const filtered = computeVisibleSchedules(mixed, true, now);
  assert.equal(filtered.length, 3);
  assert.deepEqual(filtered.map((s) => s.id), ['1', '2', '4']);
});

test('computeScheduleStats computes all counts in single pass and areDashboardStatsEqual checks value equality', () => {
  const list = [
    makeSchedule({ id: '1', situacao: 'PENDENTE' }),
    makeSchedule({ id: '2', situacao: 'ATRASADO' }),
    makeSchedule({ id: '3', situacao: 'ATRASADO' }),
    makeSchedule({ id: '4', situacao: 'PROGRAMADO' }),
    makeSchedule({ id: '5', situacao: 'ENCERRADO' }),
    makeSchedule({ id: '6', situacao: 'ANDAMENTO' }),
  ];
  const stats = computeScheduleStats(list);
  assert.deepEqual(stats, {
    total: 6,
    pendente: 1,
    atrasado: 2,
    programado: 1,
    encerrado: 1,
    andamento: 1,
  });

  assert.equal(areDashboardStatsEqual(stats, { ...stats }), true);
  assert.equal(areDashboardStatsEqual(stats, { ...stats, atrasado: 3 }), false);
  assert.equal(areDashboardStatsEqual(stats, null), false);
});

test('App.tsx and Layout.tsx wire granular React.memo, useCallback, and SyncFreshnessIndicator', () => {
  const appSrc = fs.readFileSync(path.join(ROOT, 'src/App.tsx'), 'utf8');
  const layoutSrc = fs.readFileSync(path.join(ROOT, 'src/components/Layout.tsx'), 'utf8');
  const indicatorSrc = fs.readFileSync(path.join(ROOT, 'src/components/SyncFreshnessIndicator.tsx'), 'utf8');

  assert.match(appSrc, /const AppInner = React\.memo/);
  assert.match(appSrc, /const MemoizedDashboardView = React\.memo/);
  assert.match(appSrc, /const MemoizedProgramacoesView = React\.memo/);
  assert.match(appSrc, /const selectVisibleSchedules = useCallback/);
  assert.match(appSrc, /const selectVisibleStats = useCallback/);
  assert.match(appSrc, /areDashboardStatsEqual/);
  assert.match(appSrc, /lastSyncAt=\{effectiveLastSyncAt\}/);
  assert.match(appSrc, /refreshIntervalMs=\{effectiveRefreshIntervalMs\}/);

  assert.match(layoutSrc, /import SyncFreshnessIndicator from "\.\/SyncFreshnessIndicator"/);
  assert.match(layoutSrc, /variant="header"/);
  assert.match(layoutSrc, /variant="sidebar"/);
  assert.match(layoutSrc, /React\.memo\(Layout\)/);

  assert.match(indicatorSrc, /React\.memo\(SyncFreshnessIndicatorInner\)/);
  assert.match(indicatorSrc, /buildSyncStatusIndicatorState/);
});

test('Lavagem OBSERVAÇÕES .lub-detail button no longer inherits green gradient box and has high-contrast Vitrea styles', () => {
  const lavagemCss = fs.readFileSync(path.join(ROOT, 'src/styles/lavagem-premium.css'), 'utf8');
  const vitreaCss = fs.readFileSync(path.join(ROOT, 'src/styles/vitrea.css'), 'utf8');

  // Ensure .lub-detail was removed from the primary dark-green gradient button block
  const greenButtonSection = lavagemCss.slice(
    lavagemCss.indexOf('/* Botões primários: verde profundo'),
    lavagemCss.indexOf('.lavagem-premium .lavagem-premium-body button:disabled'),
  );
  assert.doesNotMatch(greenButtonSection, /\.lub-detail\b/);

  // Ensure Vitrea explicitly styles .lub-detail, hover/expanded state, and .lub-narrative with readable light text
  assert.match(vitreaCss, /html\.theme-vitrea \.app-shell \.lavagem-premium \.lub-module \.lub-detail\s*\{/);
  assert.match(vitreaCss, /\.lub-detail\[aria-expanded="true"\]/);
  assert.match(vitreaCss, /html\.theme-vitrea \.app-shell \.lavagem-premium \.lub-module \.lub-narrative\s*\{/);
  assert.match(vitreaCss, /html\.theme-vitrea \.shell-sync-indicator\s*\{/);
});
