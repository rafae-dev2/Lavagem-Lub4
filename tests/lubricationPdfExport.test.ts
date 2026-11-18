import assert from 'node:assert/strict';
import test from 'node:test';
import {
  EXPORT_PDF_LAYOUT_STORAGE_KEY,
  buildDetailedPdfRows,
  buildPdfSummaryGroups,
  buildSimplifiedPdfRows,
  describeActivePdfFilters,
  normalizePdfExportLayout,
  readStoredPdfLayout,
  saveStoredPdfLayout,
} from '../src/lib/lubricationPdfExport';
import type { Programacao } from '../src/types';

function makeSchedule(overrides: Partial<Programacao> = {}): Programacao {
  return {
    id: 'sched-1',
    frota: '8825',
    descricaoPonto: 'LAVADOR',
    tipoPreventiva: 'Lavagem / Lubrificação',
    dataProgramada: '2026-11-15',
    dataRealizada: '',
    situacao: 'PROGRAMADO',
    horarioAgendado: '08:00',
    observacao: 'Revisar mangueiras',
    origemRegistro: 'PCM',
    numeroOS: 'OS-9910',
    apoioId: 'apoio-pipa',
    apoioNome: 'Caminhão Pipa',
    statusPCM: 'Programada',
    previsaoPCM: '2026-11-15',
    narrativaPCM: 'Preventiva completa no lavador',
    ...overrides,
  };
}

test('normalizePdfExportLayout normaliza variantes para simplificado ou detalhado', () => {
  assert.equal(normalizePdfExportLayout('detalhado'), 'detalhado');
  assert.equal(normalizePdfExportLayout('DETALHADA'), 'detalhado');
  assert.equal(normalizePdfExportLayout('completo'), 'detalhado');
  assert.equal(normalizePdfExportLayout('simplificado'), 'simplificado');
  assert.equal(normalizePdfExportLayout(undefined), 'simplificado');
  assert.equal(normalizePdfExportLayout('desconhecido'), 'simplificado');
});

test('readStoredPdfLayout e saveStoredPdfLayout persistem a preferência no localStorage', () => {
  const storage = new Map<string, string>();
  const prevWindow = (globalThis as { window?: unknown }).window;
  (globalThis as { window: unknown }).window = {
    localStorage: {
      getItem: (k: string) => storage.get(k) ?? null,
      setItem: (k: string, v: string) => storage.set(k, v),
    },
  };

  try {
    assert.equal(readStoredPdfLayout(), 'simplificado');
    saveStoredPdfLayout('detalhado');
    assert.equal(storage.get(EXPORT_PDF_LAYOUT_STORAGE_KEY), 'detalhado');
    assert.equal(readStoredPdfLayout(), 'detalhado');
    saveStoredPdfLayout('simplificado');
    assert.equal(readStoredPdfLayout(), 'simplificado');
  } finally {
    if (prevWindow === undefined) {
      delete (globalThis as { window?: unknown }).window;
    } else {
      (globalThis as { window: unknown }).window = prevWindow;
    }
  }
});

test('describeActivePdfFilters lista filtros selecionados e nomes de grupo Apoio', () => {
  const active = describeActivePdfFilters({
    statusFilter: 'ATRASADO',
    pcmFilters: { tipo: 'Lavagem / Lubrificação', origem: 'PCM', apoio: 'apoio-pipa' },
    apoioLabels: { 'apoio-pipa': 'Caminhão Pipa' },
  });
  assert.deepEqual(active, [
    'Situação: ATRASADO',
    'Serviço: Lavagem / Lubrificação',
    'Origem: Automáticas · PCM',
    'Grupo Apoio: Caminhão Pipa',
  ]);
});

test('buildPdfSummaryGroups agrupa e contabiliza situações por Grupo Apoio', () => {
  const rows = [
    makeSchedule({ id: '1', apoioNome: 'Caminhão Pipa', situacao: 'ATRASADO' }),
    makeSchedule({ id: '2', apoioNome: 'Caminhão Pipa', situacao: 'ENCERRADO' }),
    makeSchedule({ id: '3', apoioNome: 'Caminhão Pipa', situacao: 'PROGRAMADO' }),
    makeSchedule({ id: '4', apoioNome: 'Colhedora', situacao: 'ANDAMENTO' }),
  ];

  const groups = buildPdfSummaryGroups(rows);
  assert.equal(groups.length, 2);
  assert.deepEqual(groups[0], {
    grupo: 'Caminhão Pipa',
    total: 3,
    atrasado: 1,
    andamento: 0,
    programado: 1,
    pendente: 0,
    encerrado: 1,
  });
  assert.equal(groups[1].grupo, 'Colhedora');
  assert.equal(groups[1].andamento, 1);
});

test('buildSimplifiedPdfRows gera linhas enxutas com formatação pt-BR', () => {
  const rows = buildSimplifiedPdfRows([
    makeSchedule({ dataProgramada: '2026-11-15', horarioAgendado: '09:30', situacao: 'ANDAMENTO' }),
    makeSchedule({ dataProgramada: '2026-11-15', horarioAgendado: '', observacao: '' }),
  ]);

  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], {
    frota: '8825',
    servico: 'Lavagem / Lubrificação',
    local: 'LAVADOR',
    programacao: '15/11/26',
    horario: '09:30',
    status: 'ANDAMENTO',
    statusLabel: 'ANDAMENTO',
    observacao: 'Revisar mangueiras',
  });
  assert.equal(rows[1].horario, '—');
  assert.equal(rows[1].observacao, '—');
});

test('buildDetailedPdfRows inclui OS, origem, previsão, status PCM e narrativa completa', () => {
  const rows = buildDetailedPdfRows([
    makeSchedule({
      situacao: 'ENCERRADO',
      dataRealizada: '2026-11-15',
      encerradoDetectadoEm: '2026-11-15T10:25:00-03:00',
    }),
  ]);

  assert.equal(rows.length, 1);
  assert.match(rows[0].frotaBloco, /8825/);
  assert.match(rows[0].frotaBloco, /Caminhão Pipa/);
  assert.match(rows[0].osOrigemBloco, /OS-9910/);
  assert.match(rows[0].osOrigemBloco, /PCM Automática/);
  assert.match(rows[0].servicoLocalBloco, /LAVADOR/);
  assert.match(rows[0].datasBloco, /Prog\.: 15\/11\/26 às 08:00/);
  assert.match(rows[0].datasBloco, /Prev\.: 15\/11\/26/);
  assert.match(rows[0].datasBloco, /Real\.: 15\/11\/26/);
  assert.match(rows[0].statusBloco, /ENCERRADO/);
  assert.match(rows[0].statusBloco, /PCM: Programada/);
  assert.match(rows[0].statusBloco, /Detec\.: 15\/11\/26/);
  assert.match(rows[0].observacaoNarrativaBloco, /Revisar mangueiras/);
  assert.match(rows[0].observacaoNarrativaBloco, /Preventiva completa no lavador/);
});
