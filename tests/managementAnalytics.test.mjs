import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const temp = await mkdtemp(path.resolve('tests/.tmp-management-analytics-'));

function order(overrides = {}) {
  return {
    chave: `${overrides.frota || '101'}::${overrides.os || 'BI-1'}`,
    os: String(overrides.os || 'BI-1'),
    frota: String(overrides.frota || '101'),
    modelo: overrides.modelo ?? 'Equipamento sintético',
    grupo_fonte: overrides.grupo_fonte ?? '',
    setor: overrides.setor ?? 'Manutenção',
    ponto: overrides.ponto ?? 'Pátio',
    origem: overrides.origem ?? 'Oficina',
    prestador: overrides.prestador ?? 'Prestador A',
    status: overrides.status ?? 'PROGRAMADA',
    entrada: overrides.entrada ?? '2026-11-01T12:00:00-03:00',
    previsao: overrides.previsao ?? '2026-11-10',
    narrativa: overrides.narrativa ?? 'Revisão preventiva do equipamento',
    ativo: overrides.ativo ?? true,
    primeira_vista: overrides.primeira_vista ?? '2026-11-01T12:00:00-03:00',
    ultima_vista: overrides.ultima_vista ?? '2026-11-08T10:00:00-03:00',
    ausente_desde: overrides.ausente_desde ?? null,
    classe: overrides.classe ?? 'PREVENTIVA',
    motivo: overrides.motivo ?? '',
    cd_ponto: overrides.cd_ponto ?? '',
  };
}

const now = new Date('2026-11-08T12:00:00-03:00');
const data = {
  role: 'viewer',
  groups: [
    { id: 'g1', nome: 'Grupo Cadastrado', cor: '#060' },
    { id: 'g2', nome: 'Outro Cadastro', cor: '#606' },
  ],
  fleets: [
    { frota: '101', grupo_id: 'g1', nome: 'Caminhão 101' },
    { frota: '102', grupo_id: 'g2', nome: 'Caminhão 102' },
  ],
  orders: [
    order({ os: 'PROGRAMADA', frota: '101', entrada: '2026-11-01T12:00:00-03:00', origem: 'OFICINA INTERNA' }),
    order({ os: 'PECA', frota: '101', status: 'Aguardando Peça', entrada: '2026-10-01T12:00:00-03:00', origem: 'Externo', prestador: 'Prestador B', classe: null }),
    order({ os: 'PENDENTE-FONTE', frota: '999', grupo_fonte: 'Grupo Externo', status: 'PENDENTE', entrada: '2026-11-05', narrativa: 'Troca de peça urgente', origem: 'externa' }),
    order({ os: 'ANDAMENTO', frota: '102', status: 'EM EXECUÇÃO', entrada: '2026-11-07T12:00:00-03:00' }),
    order({ os: 'FECHADO-FONTE', frota: '101', status: 'ENCERRADO', ativo: false, entrada: '2026-10-01T08:00:00-03:00', primeira_vista: '2026-10-01T08:00:00-03:00', ultima_vista: '2026-11-07T08:00:00-03:00', ausente_desde: null }),
    order({ os: 'FECHADO-AUSENCIA', frota: '102', status: 'EM ANDAMENTO', ativo: false, entrada: '2026-11-02T08:00:00-03:00', primeira_vista: '2026-11-02T08:00:00-03:00', ultima_vista: '2026-11-07T08:00:00-03:00', ausente_desde: '2026-11-08T09:00:00-03:00' }),
    order({ os: 'STALE-ABSENCE', frota: '102', status: 'PROGRAMADA', ativo: false, primeira_vista: '2026-11-08T10:00:00-03:00', ultima_vista: '2026-11-07T10:00:00-03:00', ausente_desde: '2026-11-08T11:00:00-03:00' }),
    order({ os: 'FUTURA', frota: '101', entrada: '2026-11-10', status: 'PROGRAMADA' }),
    order({ os: 'INVALIDA', frota: '101', entrada: '2026-02-31', status: 'PROGRAMADA' }),
  ],
  sync: null,
};

try {
  await build({
    entryPoints: ['src/lib/managementAnalytics.ts'],
    outfile: path.join(temp, 'managementAnalytics.mjs'),
    bundle: true,
    format: 'esm',
    platform: 'node',
  });
  const bi = await import(pathToFileURL(path.join(temp, 'managementAnalytics.mjs')));
  const rows = bi.buildBIRows(data, now);

  assert.equal(rows.length, data.orders.length, 'a fotografia inteira da fonte deve permanecer no modelo');
  assert.equal(rows.find((row) => row.os === 'PROGRAMADA').groupId, 'apoio:g1');
  assert.equal(rows.find((row) => row.os === 'PENDENTE-FONTE').groupId, 'fonte:grupo externo');
  assert.equal(rows.find((row) => row.os === 'PENDENTE-FONTE').registered, false);
  assert.equal(rows.find((row) => row.os === 'PECA').statusKey, 'aguardando');
  assert.equal(rows.find((row) => row.os === 'PENDENTE-FONTE').statusKey, 'aguardando');
  assert.equal(rows.find((row) => row.os === 'ANDAMENTO').statusKey, 'andamento');
  assert.equal(rows.find((row) => row.os === 'FECHADO-FONTE').statusKey, 'encerrado');
  assert.equal(rows.find((row) => row.os === 'FECHADO-FONTE').closedDate, '', 'fonte sem detecção não recebe data inventada');
  assert.equal(rows.find((row) => row.os === 'FECHADO-FONTE').observedCycleDays, 37, 'ciclo observado usa entrada até última presença');
  assert.equal(rows.find((row) => row.os === 'FECHADO-AUSENCIA').closureType, 'ausencia');
  assert.equal(rows.find((row) => row.os === 'FECHADO-AUSENCIA').closedDetectedAt, '2026-11-08T09:00:00-03:00');
  assert.notEqual(rows.find((row) => row.os === 'STALE-ABSENCE').statusKey, 'encerrado', 'evidência stale não fecha ordem');
  assert.equal(rows.find((row) => row.os === 'FUTURA').ageDays, null);
  assert.equal(rows.find((row) => row.os === 'INVALIDA').waitingDays, null);
  assert.equal(rows.find((row) => row.os === 'PROGRAMADA').workshop, 'Oficina Interna · Pátio');

  const defaults = bi.BI_DEFAULT_FILTERS;
  assert.deepEqual(bi.filterBIRows(rows, { ...defaults, query: 'troca PEÇA' }).map((row) => row.os), ['PENDENTE-FONTE']);
  assert.deepEqual(bi.filterBIRows(rows, { ...defaults, locations: ['Oficina Interna'] }).map((row) => row.os), ['PROGRAMADA', 'ANDAMENTO', 'FECHADO-FONTE', 'FECHADO-AUSENCIA', 'STALE-ABSENCE', 'FUTURA', 'INVALIDA']);
  assert.deepEqual(bi.filterBIRows(rows, { ...defaults, scope: 'unregistered' }).map((row) => row.os), ['PENDENTE-FONTE']);
  assert.deepEqual(bi.filterBIRows(rows, { ...defaults, start: '2026-11-01', end: '2026-11-05' }).map((row) => row.os), ['PROGRAMADA', 'PENDENTE-FONTE', 'FECHADO-AUSENCIA', 'STALE-ABSENCE']);
  assert.equal(bi.filterBIRows(rows, { ...defaults, ageMin: 'abc' }).length, 0, 'idade inválida limpa a seleção');
  assert.equal(bi.validateBIFilters({ ...defaults, start: '2026-11-09', end: '2026-11-01' }), 'A data inicial não pode ser posterior à final.');
  assert.equal(bi.filterBIRows(rows, { ...defaults, overdueOnly: true }).some((row) => row.statusKey === 'encerrado'), false);

  const model = bi.buildBIModel(rows, now);
  assert.equal(model.summary.total, rows.length);
  assert.equal(model.summary.closed, 2);
  assert.equal(model.summary.waiting, 5);
  assert.equal(model.summary.waitingWithDate, 3);
  assert.equal(model.summary.openWithDate, 4);
  assert.equal(model.summary.closureDetected, 1);
  assert.equal(model.trendChart.length, 90);
  assert.equal(model.trendChart.reduce((sum, point) => sum + point.detectedClosed, 0), 1, 'série não fabrica fechamento sem timestamp');
  assert.equal(model.agingChart.reduce((sum, point) => sum + point.count, 0), 3);
  assert.equal(model.heatmap.some((point) => point.total > 0), true);
  assert.equal(model.statusChart.length, 5);
  assert.equal(model.paretoChart.at(-1).cumulativePercent, 100);
  assert.equal(model.workshopChart.length > 0, true);

  assert.deepEqual(bi.getBIFilterLabels({ ...defaults, query: 'peça', waitingOnly: true }, rows), ['Busca: peça', 'Somente fila']);
  const boundaryData = { ...data, orders: [
    order({ os:'FRACTIONAL',entrada:new Date(now.getTime()-7.5*86400000).toISOString() }),
    order({ os:'MISSING-CLOSED',entrada:'',ativo:false,status:'Programada',ultima_vista:'2026-11-07T10:00:00-03:00',ausente_desde:'2026-11-08T09:00:00-03:00' }),
    order({ os:'UTC-BOUNDARY',entrada:'2026-11-08T01:00:00Z' }),
    order({ os:'INACTIVE-UNKNOWN',ativo:false,status:'Programada',ausente_desde:null,previsao:'2026-10-01' }),
  ] };
  const boundary = bi.buildBIRows(boundaryData,now);
  const fraction = boundary.find(row=>row.os==='FRACTIONAL');
  assert.equal(fraction.waitingDays,7.5);
  assert.equal(bi.filterBIRows(boundary,{...defaults,ageBandKey:'3-7'}).some(row=>row.os==='FRACTIONAL'),true,'faixa por dias completos e clique devem incluir a mesma fração');
  assert.equal(boundary.find(row=>row.os==='MISSING-CLOSED').statusKey,'encerrado','data de entrada ausente não desfaz prova de saída');
  assert.equal(boundary.find(row=>row.os==='MISSING-CLOSED').observedCycleDays,null);
  assert.equal(boundary.find(row=>row.os==='INACTIVE-UNKNOWN').ageDays,null);
  assert.equal(boundary.find(row=>row.os==='INACTIVE-UNKNOWN').forecastOverdue,false);
  assert.equal(boundary.find(row=>row.os==='UTC-BOUNDARY').openedDate,'2026-11-07');
  assert.deepEqual(bi.filterBIRows(boundary,{...defaults,start:'2026-11-07',end:'2026-11-07'}).map(row=>row.os),['UTC-BOUNDARY']);
  assert.equal(bi.buildBIModel(boundary,now).summary.invalidDates,1,'entrada ausente é sinalizada');
  assert.equal(bi.filterBIRows(rows,{...defaults,ageMin:'0.5',ageMax:'1.5'}).some(row=>row.os==='ANDAMENTO'),true,'faixa manual de idade aberta inclui manutenção em andamento');
  for(const band of bi.BI_AGE_BANDS){
    const selected = bi.filterBIRows(boundary,{...defaults,ageBandKey:band.key});
    const point = bi.buildBIModel(boundary,now).agingChart.find(item=>item.key===band.key);
    assert.equal(selected.length,point.count,'contagem do histograma igual à consulta após clicar na faixa');
  }
  console.log('OK: managementAnalytics — fonte completa, evidências, Brasília, filtros, denominadores e gráficos.');
} finally {
  await rm(temp, { recursive: true, force: true });
}
