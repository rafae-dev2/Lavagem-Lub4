import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const temp = await mkdtemp(path.resolve('tests/.tmp-maintenance-lifecycle-'));
const sourceData = {
  groups: [{ id: 'cana', nome: 'Carretas Canavieiras', cor: '#1f6b45' }],
  fleets: [{ frota: '23677', grupo_id: 'cana', nome: 'Carreta 23677' }],
  orders: [],
  sync: null,
  role: 'admin',
};

const baseOrder = (overrides = {}) => ({
  chave: `23677::${overrides.os || 'LIFE-1'}`,
  os: overrides.os || 'LIFE-1',
  frota: '23677',
  modelo: 'Carreta canavieira',
  grupo_fonte: 'Carretas Canavieiras',
  setor: 'Mecânica',
  ponto: 'Plano preventivo',
  origem: 'Oficina',
  prestador: '',
  status: 'PROGRAMADA',
  entrada: '2026-11-01T08:00:00',
  previsao: '2026-11-04',
  narrativa: 'Preventiva mecânica.',
  ativo: true,
  primeira_vista: '2026-11-01T08:00:00Z',
  ultima_vista: '2026-11-07T08:00:00Z',
  ausente_desde: null,
  classe: 'PREVENTIVA',
  motivo: '',
  cd_ponto: '',
  ...overrides,
});

try {
  await build({
    entryPoints: ['src/lib/maintenanceTracking.ts'],
    outfile: path.join(temp, 'tracking.mjs'),
    bundle: true,
    format: 'esm',
    platform: 'node',
    logLevel: 'silent',
  });
  const tracking = await import(pathToFileURL(path.join(temp, 'tracking.mjs')));
  const now = new Date('2026-11-07T12:00:00-03:00');

  const validAbsence = tracking.buildTrackingRows({
    ...sourceData,
    orders: [baseOrder({
      os: 'ABSENT-VALID',
      ativo: false,
      ausente_desde: '2026-11-07T10:00:00Z',
      status: 'PROGRAMADA',
    })],
  }, 'preventivas', now)[0];
  assert.equal(validAbsence.trackingStatus, 'encerrado');
  assert.equal(validAbsence.status, 'PROGRAMADA', 'status bruto permanece intacto');
  assert.equal(validAbsence.closureOrigin, 'ausencia');
  assert.equal(validAbsence.closedDetectedAt, '2026-11-07T10:00:00Z');
  assert.equal(tracking.trackingClosureOrigin(validAbsence), 'ausencia');
  assert.equal(tracking.trackingClosedAt(validAbsence), '2026-11-07T10:00:00Z');
  assert.notEqual(tracking.trackingClosedAt(validAbsence), validAbsence.entrada, 'não inventa data humana de execução');

  const missingProof = tracking.buildTrackingRows({
    ...sourceData,
    orders: [baseOrder({
      os: 'ABSENT-MISSING', ativo: false, ausente_desde: null, status: 'PROGRAMADA',
    })],
  }, 'preventivas', now)[0];
  assert.equal(missingProof.trackingStatus, 'ausente');
  assert.equal(tracking.trackingClosureOrigin(missingProof), null);
  assert.equal(tracking.trackingClosedAt(missingProof), null);

  const invalidProof = tracking.buildTrackingRows({
    ...sourceData,
    orders: [baseOrder({
      os: 'ABSENT-INVALID', ativo: false, ausente_desde: '2026-02-31T10:00:00Z', status: 'PROGRAMADA',
    })],
  }, 'preventivas', now)[0];
  assert.equal(invalidProof.trackingStatus, 'ausente');
  assert.equal(tracking.trackingClosureOrigin(invalidProof), null);

  for (const overrides of [
    { primeira_vista: '2026-11-08T08:00:00Z', ultima_vista: '2026-11-07T08:00:00Z', ausente_desde: '2026-11-08T10:00:00Z' },
    { ultima_vista: '2026-11-08T08:00:00Z', ausente_desde: '2026-11-07T10:00:00Z' },
  ]) {
    const row = tracking.buildTrackingRows({ ...sourceData, orders: [baseOrder({ ativo: false, ...overrides })] }, 'preventivas', now)[0];
    assert.equal(row.trackingStatus, 'ausente', 'cronologia inconsistente não encerra');
    assert.equal(tracking.trackingClosureOrigin(row), null);
    assert.equal(tracking.filterTrackingRows([row], { query: '', status: 'outros', group: '', location: '', provider: '', start: '', end: '' }, now).length, 1, 'inconsistência temporal pode ser consultada em Outros');
  }

  const sourceClosed = tracking.buildTrackingRows({
    ...sourceData,
    orders: [baseOrder({
      os: 'SOURCE-CLOSED', ativo: true, status: 'CONCLUIDA',
    })],
  }, 'preventivas', now)[0];
  assert.equal(sourceClosed.trackingStatus, 'encerrado');
  assert.equal(sourceClosed.closureOrigin, 'fonte');
  assert.equal(sourceClosed.closedDetectedAt, null, 'status fonte não inventa detecção');
  assert.equal(tracking.trackingClosureOrigin(sourceClosed), 'fonte');
  assert.equal(tracking.trackingClosedAt(sourceClosed), null);

  const reappeared = tracking.buildTrackingRows({
    ...sourceData,
    orders: [baseOrder({
      os: 'REAPPEARED', ativo: true, status: 'PROGRAMADA',
      closureOrigin: 'ausencia', closedDetectedAt: '2026-11-06T10:00:00Z',
    })],
  }, 'preventivas', now)[0];
  assert.equal(reappeared.trackingStatus, 'programado');
  assert.equal(reappeared.closureOrigin, null);
  assert.equal(reappeared.closedDetectedAt, null);
  assert.equal(tracking.trackingClosureOrigin(reappeared), null);
  assert.equal(tracking.trackingClosedAt(reappeared), null);

  const legacyRawProgrammed = {
    ...validAbsence,
    status: 'PROGRAMADA',
    trackingStatus: 'encerrado',
    closureOrigin: 'ausencia',
  };
  assert.equal(tracking.filterTrackingRows([legacyRawProgrammed], {
    query: '', status: 'programado', group: '', location: '', provider: '', start: '', end: '',
  }, now).length, 0);
  assert.equal(tracking.filterTrackingRows([{
    ...validAbsence, trackingStatus: 'outros', status: 'PENDENTE',
  }], {
    query: '', status: 'PENDENTE', group: '', location: '', provider: '', start: '', end: '',
  }, now).length, 1, 'status fora do vocabulário oficial ainda permite busca bruta compatível');

  console.log('OK: ciclo de vida — ausência validada, prova inválida, fonte encerrada, reaparecimento e filtro derivado.');
} finally {
  await rm(temp, { recursive: true, force: true });
}
