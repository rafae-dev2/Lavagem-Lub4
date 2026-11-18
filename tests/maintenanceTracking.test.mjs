import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import * as XLSX from 'xlsx';

// Keep the generated ESM below the project tree so Node can resolve the
// already-installed jspdf/xlsx packages without installing anything.
const temp = await mkdtemp(path.resolve('tests/.tmp-maintenance-tracking-'));

function order(overrides = {}) {
  return {
    chave: `${overrides.frota || '23677'}::${overrides.os || Math.random()}`,
    os: String(overrides.os || 'OS-1'),
    frota: String(overrides.frota || '23677'),
    modelo: overrides.modelo || 'Implemento',
    grupo_fonte: overrides.grupo_fonte || '',
    setor: overrides.setor || 'Manutenção',
    ponto: overrides.ponto || 'Pátio',
    origem: overrides.origem || 'Campo',
    prestador: overrides.prestador || '',
    status: overrides.status || 'PROGRAMADA',
    entrada: overrides.entrada || '2026-11-01T08:00:00',
    previsao: overrides.previsao ?? '2026-11-10',
    narrativa: overrides.narrativa || 'Revisão periódica do equipamento.',
    ativo: overrides.ativo ?? true,
    primeira_vista: '2026-11-01T08:00:00Z',
    ultima_vista: '2026-11-07T08:00:00Z',
    ausente_desde: overrides.ausente_desde ?? null,
    classe: overrides.classe ?? '',
    motivo: overrides.motivo ?? '',
    cd_ponto: overrides.cd_ponto ?? '',
  };
}

const data = {
  groups: [{ id: 'g1', nome: 'Apoio Cana', cor: '#0a0' }],
  fleets: [
    { frota: '23677', grupo_id: 'g1', nome: 'Carreta 23677' },
    { frota: '23676', grupo_id: 'g1', nome: 'Carreta 23676' },
    { frota: '23675', grupo_id: 'g1', nome: 'Carreta 23675' },
    { frota: '23674', grupo_id: 'g1', nome: 'Carreta 23674' },
    { frota: '23673', grupo_id: 'g1', nome: 'Carreta 23673' },
    { frota: '999', grupo_id: 'g1', nome: 'Trator apoio' },
  ],
  orders: [
    order({ os: 'P-1', frota: '23677', classe: 'PREVENTIVA MECÂNICA' }),
    order({ os: 'L-1', frota: '23676', motivo: 'Lubrificação', status: 'ANDAMENTO', previsao: '2026-11-05' }),
    order({ os: 'L-2', frota: '23675', motivo: 'Lubrificação', ativo: false, status: 'ANDAMENTO', ausente_desde: '2026-11-07T10:00:00Z' }),
    order({ os: 'L-3', frota: '23674', motivo: 'Lubrificação', ativo: false, status: 'ENCERRADO', ausente_desde: '2026-11-07T10:00:00Z' }),
    order({ os: 'R-1', frota: '23673', classe: 'REFORMA', narrativa: 'Reforma geral do implemento.' }),
    order({ os: 'R-2', frota: '999', motivo: 'Reforma', narrativa: 'Reforma do chassi.' }),
    order({ os: 'N-1', frota: '999', classe: 'MANUTENÇÃO CORRETIVA', narrativa: 'Manutenção geral do equipamento.' }),
    order({ os: 'C-1', frota: '888', modelo: 'Carreta', grupo_fonte: 'Transporte', narrativa: 'Manutenção da carreta.' }),
    order({ os: 'C-2', frota: '777', modelo: 'Carreta Canavieira', grupo_fonte: 'Implementos', classe: 'PREVENTIVA MECÂNICA', narrativa: 'Revisão de conjunto.' }),
    order({ os: 'P-2', frota: '23672', classe: 'PREVENTIVA', status: 'PROGRAMADO', previsao: '2026-11-05' }),
  ],
  sync: null,
  role: 'admin',
};

try {
  await build({
    entryPoints: ['src/lib/maintenanceTracking.ts', 'src/lib/maintenanceTrackingReport.ts'],
    outdir: temp,
    bundle: true,
    format: 'esm',
    platform: 'node',
    external: ['jspdf', 'jspdf-autotable', 'xlsx'],
  });
  const tracking = await import(pathToFileURL(path.join(temp, 'maintenanceTracking.js')));
  const report = await import(pathToFileURL(path.join(temp, 'maintenanceTrackingReport.js')));
  const now = new Date('2026-11-07T12:00:00');

  const preventivas = tracking.buildTrackingRows(data, 'preventivas', now);
  assert.deepEqual(preventivas.map((row) => row.os), ['P-1', 'C-2', 'P-2']);
  assert.equal(preventivas.find((row) => row.os === 'P-1').trackingStatus, 'programado');
  assert.equal(preventivas.find((row) => row.os === 'P-2').overdue, true);
  assert.match(preventivas.find((row) => row.os === 'P-1').classificationReason, /mapa padrão/);
  assert.equal(preventivas.some((row) => row.os === 'C-1'), false, 'carreta genérica não pode entrar');

  const lubrificacao = tracking.buildTrackingRows(data, 'lubrificacao', now);
  assert.deepEqual(lubrificacao.map((row) => row.os), ['L-1', 'L-2', 'L-3']);
  assert.equal(lubrificacao.find((row) => row.os === 'L-1').trackingStatus, 'andamento');
  assert.equal(lubrificacao.find((row) => row.os === 'L-1').overdue, true);
  assert.equal(lubrificacao.find((row) => row.os === 'L-2').trackingStatus, 'encerrado', 'ausência válida encerra operacionalmente');
  assert.equal(tracking.trackingClosureOrigin(lubrificacao.find((row) => row.os === 'L-2')), 'ausencia');
  assert.equal(tracking.trackingClosedAt(lubrificacao.find((row) => row.os === 'L-2')), '2026-11-07T10:00:00Z');
  assert.equal(lubrificacao.find((row) => row.os === 'L-2').overdue, false, 'encerramento não é atraso/execução');
  assert.equal(lubrificacao.find((row) => row.os === 'L-3').trackingStatus, 'encerrado', 'encerrado explícito prevalece');
  assert.equal(tracking.trackingClosureOrigin(lubrificacao.find((row) => row.os === 'L-3')), 'fonte');
  assert.match(lubrificacao.find((row) => row.os === 'L-1').classificationReason, /classe\/motivo estruturado/);

  const pureCleaning = ['Lavagem do implemento', 'Lavar o equipamento', 'Limpeza do conjunto', 'Troca de óleo']
    .map((motivo, index) => order({ os: `PURE-${index}`, frota: `2367${index}`, motivo, classe: '' }));
  const combinedLub = order({ os: 'COMBINED', frota: '23671', motivo: 'Lavagem e lubrificação dos pontos' });
  const structuredPreventiveNarrativeLub = order({ os: 'BLOCKED-LUB', frota: '23670', classe: 'PREVENTIVA', narrativa: 'Lubrificar durante a revisão' });
  const lubeOnly = tracking.buildTrackingRows({ ...data, orders: [...pureCleaning, combinedLub, structuredPreventiveNarrativeLub] }, 'lubrificacao', now);
  assert.deepEqual(lubeOnly.map((row) => row.os), ['COMBINED']);

  const preventiveRegimeWithLubPoint = order({
    os: 'LUB-POINT', frota: '23669', classe: 'PREVENTIVA', motivo: 'Rotina',
    ponto: 'Lub Lavador 99 BP', narrativa: 'Serviço do ponto de lubrificação',
  });
  const lubPointRows = tracking.buildTrackingRows({ ...data, orders: [preventiveRegimeWithLubPoint] }, 'lubrificacao', now);
  assert.equal(lubPointRows.length, 1, 'ponto PIMS de lubrificação vence classe preventiva genérica');
  assert.equal(tracking.buildTrackingRows({ ...data, orders: [preventiveRegimeWithLubPoint] }, 'preventivas', now).length, 0, 'lubrificação não duplica preventiva');
  assert.equal(tracking.buildTrackingRows({ ...data, orders: [order({ os: 'CORRECTIVE-UNKNOWN', frota: '23668', classe: 'MANUTENÇÃO CORRETIVA', motivo: 'Motivo sem classificação' })] }, 'preventivas', now).length, 0, 'corretiva desconhecida não vira preventiva');

  const statusCases = [
    ['PENDENTE', 'outros', true],
    ['AGUARDANDO PEÇA', 'outros', true],
    ['ATRASADO', 'outros', false],
    ['ABERTA', 'outros', true],
    ['PROGRAMADA', 'programado', true],
    ['AGENDADO', 'programado', true],
    ['EM EXECUÇÃO', 'andamento', true],
  ];
  const statusRows = tracking.buildTrackingRows({
    ...data,
    orders: statusCases.map(([status], index) => order({
      os: `STATUS-${index}`,
      frota: `2366${index}`,
      classe: 'PREVENTIVA',
      status,
      previsao: status === 'ATRASADO' ? '' : '2026-11-05',
    })),
  }, 'preventivas', now);
  statusCases.forEach(([status, expectedStatus, expectedOverdue], index) => {
    const row = statusRows.find((candidate) => candidate.os === `STATUS-${index}`);
    assert.ok(row, `caso de status ${status} deveria ser selecionado`);
    assert.equal(row.trackingStatus, expectedStatus, `status ${status} não deve ser inferido como programado`);
    assert.equal(row.status, status, 'status original deve permanecer intacto');
    assert.equal(row.overdue, expectedOverdue, `atraso de ${status} deve depender de previsão válida`);
  });

  const registeredNewCanavieira = tracking.buildTrackingRows({
    ...data,
    groups: [...data.groups, { id: 'carretas_canavieiras_novas', nome: 'Carretas Canavieiras', cor: '#f80' }],
    fleets: [...data.fleets, { frota: '123', grupo_id: 'carretas_canavieiras_novas', nome: 'Reboque novo' }],
    orders: [order({ os: 'CADASTRO-CANA', frota: '123', classe: 'PREVENTIVA' })],
  }, 'preventivas', now);
  assert.equal(registeredNewCanavieira.length, 1, 'grupo cadastrado canavieiro deve reconhecer frota nova');
  assert.equal(tracking.buildTrackingRows({
    ...data,
    orders: [order({ os: 'CAVALO-CANA', frota: '888', modelo: 'Cavalo Canavieiro', grupo_fonte: 'Transporte' })],
  }, 'preventivas', now).length, 0, 'cavalo canavieiro genérico não é carreta canavieira');

  const specialCanavieiraOrders = [
    order({ os: 'VINHACA-P', frota: '601', modelo: 'Carreta tanque Vinhaça', grupo_fonte: 'Implementos', classe: 'PREVENTIVA MECÂNICA' }),
    order({ os: 'DOLLY-P', frota: '602', modelo: 'Dolly Canavieiros', grupo_fonte: 'Implementos', classe: 'PREVENTIVA' }),
    order({ os: 'VINHACA-L', frota: '603', modelo: 'Carreta tanque Vinhaça', grupo_fonte: 'Implementos', motivo: 'Lubrificação' }),
    order({ os: 'DOLLY-L', frota: '604', modelo: 'Dolly Canavieiros', grupo_fonte: 'Implementos', motivo: 'Lubrificação' }),
  ];
  assert.deepEqual(
    tracking.buildTrackingRows({ ...data, orders: specialCanavieiraOrders.slice(0, 2) }, 'preventivas', now).map((row) => row.os),
    ['VINHACA-P', 'DOLLY-P'],
    'preventivas devem incluir carreta tanque de vinhaça e dolly canavieiro',
  );
  assert.deepEqual(
    tracking.buildTrackingRows({ ...data, orders: specialCanavieiraOrders.slice(2) }, 'lubrificacao', now).map((row) => row.os),
    ['VINHACA-L', 'DOLLY-L'],
    'lubrificação deve incluir carreta tanque de vinhaça e dolly canavieiro',
  );
  assert.equal(tracking.buildTrackingRows({
    ...data,
    orders: [order({ os: 'TANQUE-AGUA', frota: '605', modelo: 'Carreta tanque água', classe: 'PREVENTIVA' })],
  }, 'preventivas', now).length, 0, 'carreta tanque genérica não deve ser adicionada por engano');
  assert.equal(tracking.buildTrackingRows({
    ...data,
    orders: [order({ os: 'DOLLY-GENERICO', frota: '606', modelo: 'Dolly industrial', classe: 'PREVENTIVA' })],
  }, 'preventivas', now).length, 0, 'dolly genérico não deve ser adicionado por engano');

  const wallClock = tracking.parseTrackingDate('2026-11-07T00:30:00');
  assert.equal(wallClock.dateKey, '2026-11-07');
  assert.equal(wallClock.timestamp, Date.parse('2026-11-07T03:30:00Z'), 'timestamp sem offset deve usar Brasília -03');

  const reformas = tracking.buildTrackingRows(data, 'reformas', now);
  assert.deepEqual(reformas.map((row) => row.os), ['R-1', 'R-2']);
  assert.equal(tracking.buildTrackingRows({ ...data, fleets: [] }, 'reformas', now).length, 0, 'reformas exigem frota cadastrada');
  assert.equal(tracking.buildTrackingRows(data, 'reformas', now).some((row) => row.os === 'N-1'), false, 'manutenção genérica não é reforma');

  const counts = tracking.getTrackingCounts(lubrificacao);
  assert.deepEqual(counts, {
    total: 3,
    programado: 0,
    andamento: 1,
    encerrado: 2,
    ausente: 0,
    outros: 0,
    atrasado: 1,
    frotas: 3,
  });
  assert.equal(tracking.statusLabel('ausente'), 'Ausente da fonte');

  const filtered = tracking.filterTrackingRows(preventivas, {
    query: 'P-2', status: 'atrasado', group: '', location: 'Campo', provider: '', start: '2026-11-01', end: '2026-11-07',
  }, now);
  assert.deepEqual(filtered.map((row) => row.os), ['P-2']);
  assert.equal(tracking.filterTrackingRows(preventivas, {
    query: '', status: 'programado', group: '', location: '', provider: '', start: '', end: '',
  }, now).length, 3);

  const legacyClosed = preventivas.find((row) => row.os === 'P-1');
  const staleProgrammed = { ...legacyClosed, status: 'PROGRAMADA', trackingStatus: 'encerrado', closureOrigin: 'ausencia', ativo: false, ausente_desde: '2026-11-07T11:00:00Z' };
  assert.equal(tracking.filterTrackingRows([staleProgrammed], {
    query: '', status: 'programado', group: '', location: '', provider: '', start: '', end: '',
  }, now).length, 0, 'status bruto programado não reintroduz encerrada no filtro oficial');

  const pdf = await report.buildTrackingPDF({
    rows: [...preventivas, ...lubrificacao, ...reformas],
    module: 'reformas',
    filters: ['Status: todos'],
    sourceUpdated: '2026-11-07T11:30:00Z',
    lastSynced: '2026-11-07T11:31:00Z',
    sourceError: null,
  });
  assert.ok(pdf.getNumberOfPages() >= 1);
  assert.ok(pdf.output('arraybuffer').byteLength > 1000);
  console.log('OK: maintenanceTracking — classificação conservadora, ausência, atraso, filtros, métricas e PDF.');
} finally {
  await rm(temp, { recursive: true, force: true });
}
