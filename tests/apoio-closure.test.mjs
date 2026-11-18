// Casos canônicos de Apoio: somente fixtures locais, sem banco ou rede.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const temp = await mkdtemp(path.resolve('tests/.tmp-apoio-closure-'));
const baseOrder = (overrides = {}) => ({
  chave: `F-01::${overrides.os || 'APOIO-1'}`,
  os: overrides.os || 'APOIO-1',
  frota: 'F-01',
  modelo: 'Equipamento teste',
  grupo_fonte: 'Grupo teste',
  setor: 'Manutenção',
  ponto: 'Oficina',
  origem: 'Oficina',
  prestador: '',
  status: 'Programada',
  entrada: '2026-11-01T08:00:00',
  previsao: '2026-11-10',
  narrativa: 'Serviço de teste',
  ativo: true,
  primeira_vista: '2026-11-07T08:00:00Z',
  ultima_vista: '2026-11-08T08:00:00Z',
  ausente_desde: null,
  ...overrides,
});
const dataFor = (orders) => ({
  groups: [{ id: 'g1', nome: 'Grupo teste', cor: '#1f6b45' }],
  fleets: [{ frota: 'F-01', grupo_id: 'g1', nome: 'Equipamento teste' }],
  orders,
  sync: null,
  role: 'admin',
});

try {
  await build({
    entryPoints: ['src/lib/apoioFilters.ts', 'src/lib/maintenanceTracking.ts'],
    outdir: temp,
    bundle: true,
    format: 'esm',
    platform: 'node',
    logLevel: 'silent',
  });
  const filters = await import(pathToFileURL(path.join(temp, 'apoioFilters.js')));
  const tracking = await import(pathToFileURL(path.join(temp, 'maintenanceTracking.js')));

  const mixedRawAndamentoClosed = baseOrder({
    os: 'MIXED-RAW-ANDAMENTO-CLOSED',
    status: 'Andamento',
    ativo: false,
    ausente_desde: '2026-11-08T09:00:00Z',
  });
  const explicitClosedActive = baseOrder({
    os: 'EXPLICIT-CLOSED-ACTIVE',
    status: 'CONCLUIDA',
    ativo: true,
  });
  const reopened = baseOrder({
    os: 'REOPENED',
    status: 'Programada',
    ativo: true,
    ausente_desde: '2026-11-07T09:00:00Z',
  });
  const invalidProof = baseOrder({
    os: 'INVALID-PROOF',
    status: 'Andamento',
    ativo: false,
    primeira_vista: '2026-11-09T08:00:00Z',
    ultima_vista: '2026-11-08T08:00:00Z',
    ausente_desde: '2026-11-08T09:00:00Z',
  });
  const orders = [mixedRawAndamentoClosed, explicitClosedActive, reopened, invalidProof];
  const data = dataFor(orders);

  const mixedClosure = tracking.getMaintenanceOrderClosure(mixedRawAndamentoClosed);
  assert.equal(mixedClosure.status, 'encerrado', 'Andamento bruto com ausência validada fecha operacionalmente');
  assert.equal(mixedClosure.origin, 'ausencia');
  assert.equal(mixedClosure.detectedAt, mixedRawAndamentoClosed.ausente_desde);
  assert.equal(mixedRawAndamentoClosed.status, 'Andamento', 'status bruto não é sobrescrito');

  const sourceClosure = tracking.getMaintenanceOrderClosure(explicitClosedActive);
  assert.equal(sourceClosure.status, 'encerrado', 'status explícito fecha mesmo com ativo=true');
  assert.equal(sourceClosure.origin, 'fonte');
  assert.equal(sourceClosure.detectedAt, null, 'status da fonte não inventa detecção');

  const reopenClosure = tracking.getMaintenanceOrderClosure(reopened);
  assert.equal(reopenClosure.status, 'programado', 'reaparecimento ativo reabre a ordem');
  assert.equal(reopenClosure.origin, null);
  assert.equal(reopenClosure.detectedAt, null);

  const invalidClosure = tracking.getMaintenanceOrderClosure(invalidProof);
  assert.equal(invalidClosure.status, 'ausente', 'prova temporal inválida não fecha');
  assert.equal(invalidClosure.origin, null);
  assert.equal(filters.apoioOrderStatusLabel(invalidProof), 'Outros · Sem confirmação');

  assert.deepEqual(filters.apoioBaseRows(data, 'abertas').map(row => row.os), ['REOPENED'], 'abertas exclui ambos os tipos confirmados e ausências inativas');
  assert.deepEqual(
    filters.apoioBaseRows(data, 'encerradas').map(row => row.os).sort(),
    ['EXPLICIT-CLOSED-ACTIVE', 'MIXED-RAW-ANDAMENTO-CLOSED'],
    'vista explícita reúne fonte e ausência validada',
  );
  assert.deepEqual(
    filters.apoioBaseRows(data, 'historico').map(row => row.os).sort(),
    ['EXPLICIT-CLOSED-ACTIVE', 'INVALID-PROOF', 'MIXED-RAW-ANDAMENTO-CLOSED'],
    'histórico preserva encerradas e ausências sem prova',
  );

  const history = filters.apoioBaseRows(data, 'historico');
  const empty = { query: '', groups: [], location: '', status: '', provider: '' };
  assert.deepEqual(filters.filterApoioRows(data, history, { ...empty, status: 'Encerrada' }).map(row => row.os).sort(), ['EXPLICIT-CLOSED-ACTIVE', 'MIXED-RAW-ANDAMENTO-CLOSED']);
  assert.deepEqual(filters.filterApoioRows(data, history, { ...empty, status: 'Outros' }).map(row => row.os), ['INVALID-PROOF']);
  assert.equal(filters.filterApoioRows(data, history, { ...empty, query: 'sem confirmação' }).length, 1);

  console.log('OK: mixed raw Andamento fechado, fonte encerrada ativa, reabertura, prova inválida e filtro fechado.');
} finally {
  await rm(temp, { recursive: true, force: true });
}
