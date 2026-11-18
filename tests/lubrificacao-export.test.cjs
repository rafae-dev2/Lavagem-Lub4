'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { build } = require('esbuild');

const ROOT = path.resolve(__dirname, '..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'lubrificacao-export-contract-'));

async function loadBundled(entryPoint) {
  const outfile = path.join(
    TMP,
    `${path.basename(entryPoint).replace(/[^a-z0-9]/gi, '_')}-${Math.random().toString(16).slice(2)}.cjs`,
  );
  await build({
    entryPoints: [entryPoint],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node18',
    outfile,
    logLevel: 'silent',
  });
  delete require.cache[require.resolve(outfile)];
  return require(outfile);
}

let nextId = 1;
function schedule(overrides = {}) {
  const id = String(nextId++);
  return {
    id,
    frota: `F-${id}`,
    descricaoPonto: 'LAVADOR',
    tipoPreventiva: 'Lavagem / Lubrificação',
    dataProgramada: '2026-11-04',
    dataRealizada: '',
    situacao: 'PROGRAMADO',
    horarioAgendado: '08:00',
    observacao: '',
    origemRegistro: 'MANUAL',
    ...overrides,
  };
}

function sp(value) {
  return new Date(`${value}-03:00`);
}

const ids = rows => rows.map(row => row.frota);
const byFleet = (rows, frota) => rows.find(row => row.frota === frota);
const blankFilters = { tipo: '', origem: '', apoio: '', semana: '' };

function assertSet(actual, expected, message) {
  assert.deepEqual(new Set(actual), new Set(expected), message);
}

function assertStaticUiContract() {
  const appSource = fs.readFileSync(path.join(ROOT, 'src/App.tsx'), 'utf8');
  const exportCaseStart = appSource.indexOf("case 'exportar':");
  const exportCaseEnd = appSource.indexOf("case 'calendario':", exportCaseStart);
  assert.ok(exportCaseStart >= 0 && exportCaseEnd > exportCaseStart, 'App deve manter o case exportar localizável');
  const exportCase = appSource.slice(exportCaseStart, exportCaseEnd);
  assert.match(exportCase, /<Exportar\s+schedules=\{schedules\}\s*\/>/, 'Exportar deve receber a lista bruta completa');
  assert.doesNotMatch(exportCase, /visibleSchedules|shouldHideClosedSchedule|hideEncerradas/, 'o case de exportação não deve reaplicar o filtro visual');

  const exportSource = fs.readFileSync(path.join(ROOT, 'src/pages/Exportar.tsx'), 'utf8');
  const compact = exportSource.replace(/\s+/g, ' ');
  assert.match(exportSource, /selectLubricationExportSchedules/);
  assert.match(exportSource, /const reportMode\s*=\s*['"]operacional['"]/, 'o nome do relatório deve ser operacional');
  assert.doesNotMatch(exportSource, /LubricationReportMode/);
  assert.doesNotMatch(exportSource, /option value=["'](?:completo|diario)["']/i, 'não deve existir seletor de modo completo/diário');
  assert.doesNotMatch(exportSource, /mode\s*:\s*["'](?:completo|diario)["']/i, 'a UI não deve enviar modo ao helper');
  assert.match(exportSource, /\bstatusFilter\b/);
  assert.doesNotMatch(exportSource, /hideClosed && statusFilter === 'ENCERRADO'/, 'o corte não deve resetar nem ignorar o filtro Encerrado');
  assert.match(
    compact,
    /filter\(status => status !== 'PENDENTE'\)/,
    'ENCERRADO deve permanecer no seletor durante todo o dia',
  );
  assert.match(exportSource, /const reportSignature\s*=.*getDailyExportWindowKey\(now\)/, 'a chave da janela deve invalidar o preview');
  assert.match(exportSource, /setInterval\(\(\) => setClock\(Date\.now\(\)\),\s*1_000\)/, 'o relógio deve acompanhar a virada operacional');

  const imageStart = exportSource.indexOf('const handleGenerateImage');
  const pdfStart = exportSource.indexOf('const handleGeneratePdf');
  const shareStart = exportSource.indexOf('const shareWhatsApp');
  assert.ok(imageStart >= 0 && pdfStart > imageStart && shareStart > pdfStart, 'PNG, PDF e WhatsApp devem permanecer localizáveis');
  const imagePath = exportSource.slice(imageStart, pdfStart);
  const pdfPath = exportSource.slice(pdfStart, shareStart);
  const sharePath = exportSource.slice(shareStart);
  for (const [name, source] of [['PNG', imagePath], ['PDF', pdfPath], ['WhatsApp', sharePath]]) {
    assert.match(source, /selectRowsForExport\(/, `${name} deve usar a seleção compartilhada`);
    assert.match(source, /getDailyExportStats\(/, `${name} deve calcular contadores pela mesma seleção`);
  }
  assert.ok((exportSource.match(/\bselectRowsForExport\(/g) || []).length >= 4, 'preview e os três formatos devem compartilhar a seleção');
  assert.match(imagePath, /getDailyExportWindowKey\(new Date\(\)\)/, 'PNG deve invalidar geração se a janela mudar');
  assert.match(pdfPath, /getDailyExportWindowKey\(new Date\(\)\)/, 'PDF deve invalidar geração se a janela mudar');
}

async function main() {
  const helperPath = path.join(ROOT, 'src/lib/lubricationExport.ts');
  assert.ok(fs.existsSync(helperPath), `Helper ainda não existe: ${helperPath}`);
  const helperSource = fs.readFileSync(helperPath, 'utf8');
  assert.match(helperSource, /export interface LubricationExportOptions/);
  assert.match(helperSource, /status:\s*StatusType\s*\|\s*''/);
  assert.match(helperSource, /filters:\s*PCMReportFilters/);
  assert.doesNotMatch(helperSource, /LubricationReportMode|\bmode\b/, 'o helper não deve manter modos completo/diário');
  assert.match(helperSource, /selectDailyExportSchedules\(rows\.filter/, 'abertas mantêm a janela operacional');
  assert.match(helperSource, /const closed = rows\.filter/, 'encerradas são selecionadas independentemente do corte');

  const { selectLubricationExportSchedules, getLubricationClosedWindowStart } = await loadBundled(helperPath);
  assert.equal(typeof selectLubricationExportSchedules, 'function');
  assert.equal(typeof getLubricationClosedWindowStart, 'function');

  const before0710 = sp('2026-11-04T07:09:59');
  const rows = [
    schedule({ frota: 'ATRASADO-BASE', dataProgramada: '2020-01-01', situacao: 'ATRASADO', tipoPreventiva: 'Lavagem / Lubrificação', apoioId: 'grupo-a' }),
    schedule({ frota: 'PROGRAMADO-PASSADO', dataProgramada: '2026-11-03', situacao: 'PROGRAMADO', horarioAgendado: '09:00', tipoPreventiva: 'Troca de Óleo', origemRegistro: 'MANUAL', apoioId: 'grupo-b', apoioNome: 'Grupo B' }),
    schedule({ frota: 'PROGRAMADO-HOJE', dataProgramada: '2026-11-04', situacao: 'PROGRAMADO', horarioAgendado: '23:59', tipoPreventiva: 'Lavagem / Lubrificação', origemRegistro: 'PCM', apoioId: 'grupo-a', observacao: 'OS 900' }),
    schedule({ frota: 'PROGRAMADO-AMANHA-0710', dataProgramada: '2026-11-05', situacao: 'PROGRAMADO', horarioAgendado: '07:10', origemRegistro: 'MANUAL', apoioId: 'grupo-a' }),
    schedule({ frota: 'ANDAMENTO-OLD', dataProgramada: '2020-01-01', situacao: 'ANDAMENTO', horarioAgendado: '08:00', origemRegistro: 'PCM', apoioId: 'grupo-a' }),
    schedule({ frota: 'ENCERRADO-PCM', dataProgramada: '2026-11-03', situacao: 'ENCERRADO', origemRegistro: 'PCM', encerradoDetectadoEm: '2026-11-04T10:00:00Z', motivoEncerramento: 'Ausente no snapshot Apoio', observacao: 'OS 910 | encerrada por ausência em 2026-11-04 07:00 | Execução confirmada: conferido', apoioId: 'grupo-a' }),
    schedule({ frota: 'PENDENTE', dataProgramada: '2026-11-04', situacao: 'PENDENTE', apoioId: 'grupo-a' }),
    schedule({ frota: 'PROGRAMADO-FUTURO', dataProgramada: '2026-11-06', situacao: 'PROGRAMADO', horarioAgendado: '08:00', apoioId: 'grupo-a' }),
    schedule({ frota: 'ARQUIVADO', dataProgramada: '2020-01-01', situacao: 'ATRASADO', manualArquivadoEm: '2026-11-01T12:00:00Z' }),
  ];
  const originalRows = structuredClone(rows);

  const operational = selectLubricationExportSchedules(rows, before0710, {
    status: '',
    filters: blankFilters,
  });
  assertSet(ids(operational), [
    'ATRASADO-BASE',
    'PROGRAMADO-PASSADO',
    'PROGRAMADO-HOJE',
    'PROGRAMADO-AMANHA-0710',
    'ANDAMENTO-OLD',
    'ENCERRADO-PCM',
  ], 'abertas seguem a janela operacional e encerradas também entram');
  assert.equal(byFleet(operational, 'PROGRAMADO-PASSADO').situacao, 'ATRASADO', 'programado passado é normalizado antes do filtro de status');
  assert.equal(byFleet(operational, 'ENCERRADO-PCM').dataRealizada, '2026-11-04', 'data PCM encerrada usa a data efetiva em São Paulo');
  assert.equal(byFleet(operational, 'ENCERRADO-PCM').observacao, 'OS 910 | Execução confirmada: conferido', 'marcador técnico é removido sem apagar a observação operacional');
  assert.deepEqual(rows, originalRows, 'a exportação deve clonar a apresentação e nunca mutar o cache');

  assertSet(ids(selectLubricationExportSchedules(rows, before0710, {
    status: 'ATRASADO',
    filters: blankFilters,
  })), ['ATRASADO-BASE', 'PROGRAMADO-PASSADO'], 'status ATRASADO inclui backlog e programado passado normalizado');
  assertSet(ids(selectLubricationExportSchedules(rows, before0710, {
    status: 'ANDAMENTO',
    filters: blankFilters,
  })), ['ANDAMENTO-OLD'], 'status ANDAMENTO mantém andamento anterior');
  assertSet(ids(selectLubricationExportSchedules(rows, before0710, {
    status: 'ENCERRADO',
    filters: blankFilters,
  })), ['ENCERRADO-PCM'], 'ENCERRADO pode ser filtrado a qualquer hora');
  assert.deepEqual(
    ids(selectLubricationExportSchedules(rows, sp('2026-11-04T07:10:01'), { status: 'ENCERRADO', filters: blankFilters })),
    ['ENCERRADO-PCM'],
    'após 07:10 o relatório mantém encerradas quando o status é pedido',
  );

  assert.deepEqual(
    ids(selectLubricationExportSchedules(rows, before0710, {
      status: '',
      filters: { tipo: 'Troca de Óleo', origem: 'MANUAL', apoio: 'grupo-b', semana: '2026-11-02' },
    })),
    ['PROGRAMADO-PASSADO'],
    'filtros de tipo, origem e grupo são aplicados após a seleção; semana não reabre o histórico',
  );
  assert.deepEqual(
    ids(selectLubricationExportSchedules(rows, before0710, {
      status: '',
      filters: { tipo: 'Lavagem / Lubrificação', origem: 'PCM', apoio: 'grupo-a', semana: '' },
    })),
    ['ANDAMENTO-OLD', 'ENCERRADO-PCM', 'PROGRAMADO-HOJE'],
    'filtros PCM combinam sobre abertas e encerradas',
  );

  const closedWindow = [
    schedule({ frota: 'ANTES0700', situacao: 'ENCERRADO', origemRegistro: 'PCM', encerradoDetectadoEm: '2026-11-04T09:59:59Z' }),
    schedule({ frota: 'EXATAMENTE0700', situacao: 'ENCERRADO', origemRegistro: 'PCM', encerradoDetectadoEm: '2026-11-04T10:00:00Z', apoioId: 'grupo-a' }),
    schedule({ frota: 'DEPOIS0700', situacao: 'ENCERRADO', origemRegistro: 'PCM', encerradoDetectadoEm: '2026-11-04T10:00:01Z' }),
    schedule({ frota: 'ONTEM', situacao: 'ENCERRADO', origemRegistro: 'PCM', encerradoDetectadoEm: '2026-11-03T23:00:00Z' }),
    schedule({ frota: 'FUTURA', situacao: 'ENCERRADO', origemRegistro: 'PCM', encerradoDetectadoEm: '2026-11-04T23:00:00Z' }),
    schedule({ frota: 'SEM-DATA', situacao: 'ENCERRADO', origemRegistro: 'PCM' }),
    schedule({ frota: 'ARQUIVADA', situacao: 'ENCERRADO', origemRegistro: 'PCM', encerradoDetectadoEm: '2026-11-04T10:00:00Z', manualArquivadoEm: '2026-11-04T12:00:00Z' }),
    schedule({ frota: 'MANUAL-HOJE', situacao: 'ENCERRADO', dataRealizada:'2026-11-04', horarioAgendado:'09:00' }),
  ];
  for (const time of ['2026-11-04T07:09:59', '2026-11-04T07:10:00', '2026-11-04T07:10:01']) {
    const selected = selectLubricationExportSchedules(closedWindow, sp(time), {status:'ENCERRADO', filters:blankFilters});
    assertSet(ids(selected), ['EXATAMENTE0700', 'DEPOIS0700'], `encerradas de hoje desde07:00, sem aplicar corte07:10: ${time}`);
    assert.equal(selected.length, 2, 'encerradas sem duplicação');
  }
  assertSet(ids(selectLubricationExportSchedules(closedWindow,sp('2026-11-04T07:00:00'),{status:'ENCERRADO',filters:blankFilters})), ['EXATAMENTE0700'], 'limite07:00 inclusive');
  assertSet(ids(selectLubricationExportSchedules(closedWindow,sp('2026-11-04T06:59:59'),{status:'ENCERRADO',filters:blankFilters})), ['ANTES0700','ONTEM'], 'antes das07:00 o turno anterior permanece aberto, incluindo encerradas desde07 do dia anterior');
  assertSet(ids(selectLubricationExportSchedules(closedWindow,sp('2026-11-04T14:00:00'),{status:'ENCERRADO',filters:blankFilters})), ['EXATAMENTE0700','DEPOIS0700','MANUAL-HOJE'], 'somente hoje desde07:00 até geração');
  assertSet(ids(selectLubricationExportSchedules(closedWindow,sp('2026-11-05T00:30:00'),{status:'ENCERRADO',filters:blankFilters})), ['EXATAMENTE0700','DEPOIS0700','FUTURA','MANUAL-HOJE'], 'a janela do turno continua após a meia-noite até07:00');
  assert.deepEqual(selectLubricationExportSchedules(closedWindow,sp('2026-11-05T07:00:00'),{status:'ENCERRADO',filters:blankFilters}), [], 'às07:00 reinicia o turno e remove encerradas da janela anterior');
  assert.equal(getLubricationClosedWindowStart(sp('2026-11-05T00:30:00')).toISOString(),'2026-11-04T10:00:00.000Z','antes das07:00 o início operacional é07:00 do dia anterior');
  assert.equal(getLubricationClosedWindowStart(sp('2026-11-05T07:00:00')).toISOString(),'2026-11-05T10:00:00.000Z','às07:00 começa a nova janela');
  const incidentOrders=[
    schedule({id:'sb-1077',frota:'4626',numeroOS:'159331208',situacao:'ENCERRADO',dataRealizada:'2026-11-05',origemRegistro:'PCM',encerradoDetectadoEm:'2026-11-06T02:11:01.183015Z',motivoEncerramento:'Ausente no snapshot Apoio'}),
    schedule({id:'sb-1085',frota:'6608',numeroOS:'159331210',situacao:'ENCERRADO',dataRealizada:'2026-11-05',origemRegistro:'PCM',encerradoDetectadoEm:'2026-11-06T02:11:01.183015Z',motivoEncerramento:'Ausente no snapshot Apoio'}),
  ];
  assertSet(ids(selectLubricationExportSchedules(incidentOrders,sp('2026-11-06T00:39:00'),{status:'ENCERRADO',filters:blankFilters})),['4626','6608'],'as duas OS encerradas às23:11 entram no mesmo turno, embora a geração ocorra após a meia-noite');
  assert.deepEqual(selectLubricationExportSchedules(incidentOrders,sp('2026-11-06T07:00:00'),{status:'ENCERRADO',filters:blankFilters}),[],'as duas OS saem da janela quando começa o turno novo às07:00');
  assertSet(ids(selectLubricationExportSchedules(closedWindow,sp('2026-11-04T14:00:00'),{status:'ENCERRADO',filters:{...blankFilters,origem:'PCM',apoio:'grupo-a'}})),['EXATAMENTE0700'],'filtros explícitos preservados');
  assert.match(fs.readFileSync(path.join(ROOT,'src/pages/Exportar.tsx'),'utf8'),/janela operacional atual/,'a interface deve explicar a janela de encerradas atravessando a meia-noite');
  assertStaticUiContract();
  console.log('OK: contrato operacional único, status pós-seleção, filtros PCM, limpeza/data, imutabilidade e integração UI verificados.');
}

main()
  .catch(error => {
    console.error(`FAIL: ${error.stack || error.message}`);
    process.exitCode = 1;
  })
  .finally(() => {
    fs.rmSync(TMP, { recursive: true, force: true });
  });
