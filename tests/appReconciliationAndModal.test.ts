import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  areMaintenanceShellStatesEqual,
  resolveEffectiveShellSync,
  stabilizeScheduleListReference,
} from '../src/lib/appReconciliation';
import type { Programacao } from '../src/types';

const ROOT = process.cwd();

function makeItem(id: string): Programacao {
  return {
    id,
    frota: '4588',
    descricaoPonto: 'LAVADOR',
    tipoPreventiva: 'Lavagem / Lubrificação',
    dataProgramada: '2026-11-19',
    dataRealizada: '',
    horarioAgendado: '07:00',
    situacao: 'PROGRAMADO',
    observacao: '',
  };
}

test('areMaintenanceShellStatesEqual compares syncing, lastSync, and fromCache cleanly', () => {
  assert.equal(
    areMaintenanceShellStatesEqual(
      { syncing: false, lastSync: '2026-11-19T19:15:00Z', fromCache: false },
      { syncing: false, lastSync: '2026-11-19T19:15:00Z', fromCache: false },
    ),
    true,
  );
  assert.equal(
    areMaintenanceShellStatesEqual(
      { syncing: true, lastSync: null, fromCache: false },
      { syncing: false, lastSync: null, fromCache: false },
    ),
    false,
  );
  assert.equal(
    areMaintenanceShellStatesEqual(
      { syncing: false, lastSync: '2026-11-19T19:10:00Z', fromCache: false },
      { syncing: false, lastSync: '2026-11-19T19:15:00Z', fromCache: false },
    ),
    false,
  );
});

test('stabilizeScheduleListReference preserves previous array identity when element references match', () => {
  const a = makeItem('1');
  const b = makeItem('2');
  const prev = [a, b];
  const sameContentNewArray = [a, b];
  const changedLength = [a];
  const changedElement = [a, makeItem('2')];

  assert.equal(stabilizeScheduleListReference(prev, sameContentNewArray), prev);
  assert.equal(stabilizeScheduleListReference(prev, changedLength), changedLength);
  assert.equal(stabilizeScheduleListReference(prev, changedElement), changedElement);
  assert.equal(stabilizeScheduleListReference(null, sameContentNewArray), sameContentNewArray);
});

test('resolveEffectiveShellSync selects maintenanceShell on maintenance pages and Lavagem state otherwise', () => {
  const maint = resolveEffectiveShellSync({
    maintenancePage: true,
    maintenanceShell: {
      syncing: false,
      lastSync: '2026-11-19T19:15:00.000Z',
      fromCache: true,
    },
    maintenanceRefreshIntervalMs: 300_000,
    lavagemSyncing: true,
    lavagemLastSync: '19/11/2026, 18:00',
    lavagemLastSyncAt: 1000,
    lavagemRefreshIntervalMs: 180_000,
    lavagemFromCache: false,
  });

  assert.equal(maint.syncing, false);
  assert.equal(maint.fromCache, true);
  assert.equal(maint.refreshIntervalMs, 300_000);
  assert.ok(maint.lastSync && maint.lastSync.length > 0);
  assert.ok(typeof maint.lastSyncAt === 'number');

  const lav = resolveEffectiveShellSync({
    maintenancePage: false,
    maintenanceShell: { syncing: true, lastSync: null, fromCache: true },
    maintenanceRefreshIntervalMs: 300_000,
    lavagemSyncing: false,
    lavagemLastSync: '19/11/2026, 18:00',
    lavagemLastSyncAt: 123456,
    lavagemRefreshIntervalMs: 180_000,
    lavagemFromCache: false,
  });

  assert.deepEqual(lav, {
    syncing: false,
    lastSync: '19/11/2026, 18:00',
    lastSyncAt: 123456,
    refreshIntervalMs: 180_000,
    fromCache: false,
  });
});

test('App.tsx wires granular AppInner memoization, stabilized visibleSchedules, and split pageContent', () => {
  const appSrc = fs.readFileSync(path.join(ROOT, 'src', 'App.tsx'), 'utf8');
  assert.match(appSrc, /stabilizeScheduleListReference/);
  assert.match(appSrc, /areMaintenanceShellStatesEqual/);
  assert.match(appSrc, /resolveEffectiveShellSync/);
  assert.match(appSrc, /const standalonePageContent = useMemo/);
  assert.match(appSrc, /const lavagemPageContent = useMemo/);
  assert.match(appSrc, /const MemoizedAcompanhamentoView = React\.memo/);
  assert.match(appSrc, /const MemoizedCentralGerencialView = React\.memo/);
  assert.match(appSrc, /const pendingBannerStyle = useMemo/);
  assert.match(appSrc, /const handleMaintenanceStateEvent = useCallback/);
});

test('Calda and Vitrea CSS fully style portaled Lavagem edit modal (.lub-premium-modal) and padded .mt-source-line', () => {
  for (const file of ['calda.css', 'vitrea.css']) {
    const css = fs.readFileSync(path.join(ROOT, 'src', 'styles', file), 'utf8');
    const prefix = file === 'calda.css' ? 'html.theme-calda' : 'html.theme-vitrea';

    assert.ok(
      css.includes(`${prefix} .lub-premium-modal .lub-modal > :is(div):first-child`),
      `${file} must override modal header bar`,
    );
    assert.ok(
      css.includes(`${prefix} .lub-premium-modal .lub-modal > :is(div):last-child`),
      `${file} must override modal footer bar`,
    );
    assert.ok(
      css.includes(`${prefix} .lub-premium-modal .lub-modal label`),
      `${file} must override modal label contrast`,
    );
    assert.ok(
      css.includes(`${prefix} .lub-premium-modal .lub-modal :is(input, select, textarea)`),
      `${file} must override modal form fields`,
    );
    assert.ok(
      css.includes(`${prefix} .lub-premium-modal .lub-modal .lub-modal-note`),
      `${file} must override modal info callout`,
    );
    assert.ok(
      css.includes(`${prefix} .app-shell .maintenance-tracking .mt-source-line {`),
      `${file} must add internal padding to .mt-source-line card`,
    );
  }
});
