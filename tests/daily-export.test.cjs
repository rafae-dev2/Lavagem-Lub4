'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { build } = require('esbuild');

const ROOT = path.resolve(__dirname, '..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'daily-export-contract-'));

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

function ids(rows) {
  return rows.map(row => row.frota);
}

function assertSet(actual, expected, message) {
  assert.deepEqual(new Set(actual), new Set(expected), message);
}

async function main() {
  const dailyExportPath = path.join(ROOT, 'src/lib/dailyExport.ts');
  assert.ok(fs.existsSync(dailyExportPath), `Helper ainda não existe: ${dailyExportPath}`);

  const {
    getDailyExportWindow,
    selectDailyExportSchedules,
    getDailyExportStats,
  } = await loadBundled(dailyExportPath);
  assert.equal(typeof getDailyExportWindow, 'function');
  assert.equal(typeof selectDailyExportSchedules, 'function');
  assert.equal(typeof getDailyExportStats, 'function');

  const before0710 = sp('2026-11-04T07:09:59');
  const exact0710 = sp('2026-11-04T07:10:00');
  const after0710 = sp('2026-11-04T07:10:01');

  assert.deepEqual(getDailyExportWindow(before0710), {
    today: '2026-11-04',
    nextDay: '2026-11-05',
    cutoffMinutes: 430,
    hideClosed: false,
    phase: 'antes0710',
  }, '07:09:59 em São Paulo ainda pertence à fase anterior');
  assert.deepEqual(getDailyExportWindow(exact0710), {
    today: '2026-11-04',
    nextDay: '2026-11-05',
    cutoffMinutes: 420,
    hideClosed: true,
    phase: 'apos0710',
  }, '07:10:00 muda a fase e o limite de amanhã');
  assert.deepEqual(getDailyExportWindow(after0710), {
    today: '2026-11-04',
    nextDay: '2026-11-05',
    cutoffMinutes: 420,
    hideClosed: true,
    phase: 'apos0710',
  });

  const originalTZ = process.env.TZ;
  try {
    process.env.TZ = 'UTC';
    const utcProcessWindow = getDailyExportWindow(new Date('2026-11-05T02:00:00Z'));
    process.env.TZ = 'America/Sao_Paulo';
    const saoPauloProcessWindow = getDailyExportWindow(new Date('2026-11-05T02:00:00Z'));
    assert.deepEqual(utcProcessWindow, {
      today: '2026-11-04',
      nextDay: '2026-11-05',
      cutoffMinutes: 420,
      hideClosed: true,
      phase: 'apos0710',
    }, '02:00Z ainda é 23:00 do dia anterior em São Paulo');
    assert.deepEqual(utcProcessWindow, saoPauloProcessWindow, 'o cálculo não depende de TZ do processo');
  } finally {
    if (originalTZ === undefined) delete process.env.TZ;
    else process.env.TZ = originalTZ;
  }

  assert.deepEqual(getDailyExportWindow(sp('2026-12-31T07:09:59')), {
    today: '2026-12-31',
    nextDay: '2027-01-01',
    cutoffMinutes: 430,
    hideClosed: false,
    phase: 'antes0710',
  }, 'a janela atravessa o ano no calendário civil de São Paulo');
  assert.deepEqual(getDailyExportWindow(sp('2028-02-29T23:59:00')), {
    today: '2028-02-29',
    nextDay: '2028-03-01',
    cutoffMinutes: 420,
    hideClosed: true,
    phase: 'apos0710',
  }, 'a janela respeita o dia bissexto');

  const rows = [
    schedule({ frota: 'ATRASADO-ALL', dataProgramada: '2020-01-01', situacao: 'ATRASADO' }),
    schedule({ frota: 'ATRASADO-INVALID-DATE', dataProgramada: '', situacao: 'ATRASADO' }),
    schedule({ frota: 'PROGRAMADO-PASSADO', dataProgramada: '2026-11-03', situacao: 'PROGRAMADO', horarioAgendado: '09:00' }),
    schedule({ frota: 'PROGRAMADO-HOJE-SEM-HORA', dataProgramada: '2026-11-04', horarioAgendado: '' }),
    schedule({ frota: 'PROGRAMADO-HOJE-FIM', dataProgramada: '2026-11-04', horarioAgendado: '23:59:59' }),
    schedule({ frota: 'PROGRAMADO-AMANHA-0710', dataProgramada: '2026-11-05', horarioAgendado: '07:10' }),
    schedule({ frota: 'PROGRAMADO-AMANHA-071001', dataProgramada: '2026-11-05', horarioAgendado: '07:10:01' }),
    schedule({ frota: 'PROGRAMADO-AMANHA-0700', dataProgramada: '2026-11-05', horarioAgendado: '07:00:00' }),
    schedule({ frota: 'PROGRAMADO-AMANHA-070001', dataProgramada: '2026-11-05', horarioAgendado: '07:00:01' }),
    schedule({ frota: 'PROGRAMADO-AMANHA-0701', dataProgramada: '2026-11-05', horarioAgendado: '07:01' }),
    schedule({ frota: 'PROGRAMADO-DIA-DEPOIS', dataProgramada: '2026-11-06', horarioAgendado: '07:00' }),
    schedule({ frota: 'PROGRAMADO-DATA-INVALIDA', dataProgramada: '2026-02-30', horarioAgendado: '08:00' }),
    schedule({ frota: 'ANDAMENTO-PASSADO', dataProgramada: '2020-01-01', situacao: 'ANDAMENTO', horarioAgendado: '08:00' }),
    schedule({ frota: 'ANDAMENTO-HOJE', dataProgramada: '2026-11-04', situacao: 'ANDAMENTO', horarioAgendado: '23:59' }),
    schedule({ frota: 'ANDAMENTO-AMANHA-0710', dataProgramada: '2026-11-05', situacao: 'ANDAMENTO', horarioAgendado: '07:10' }),
    schedule({ frota: 'ANDAMENTO-AMANHA-071001', dataProgramada: '2026-11-05', situacao: 'ANDAMENTO', horarioAgendado: '07:10:01' }),
    schedule({ frota: 'ANDAMENTO-AMANHA-0700', dataProgramada: '2026-11-05', situacao: 'ANDAMENTO', horarioAgendado: '07:00:00' }),
    schedule({ frota: 'ANDAMENTO-AMANHA-070001', dataProgramada: '2026-11-05', situacao: 'ANDAMENTO', horarioAgendado: '07:00:01' }),
    schedule({ frota: 'ANDAMENTO-AMANHA-0701', dataProgramada: '2026-11-05', situacao: 'ANDAMENTO', horarioAgendado: '07:01' }),
    schedule({ frota: 'ANDAMENTO-DIA-DEPOIS', dataProgramada: '2026-11-06', situacao: 'ANDAMENTO', horarioAgendado: '07:00' }),
    schedule({ frota: 'ANDAMENTO-SEM-DATA', dataProgramada: '', situacao: 'ANDAMENTO', horarioAgendado: '' }),
    schedule({ frota: 'ENCERRADO-TURNO-ATUAL', origemRegistro: 'PCM', dataProgramada: '2026-11-03', situacao: 'ENCERRADO', encerradoDetectadoEm: '2026-11-03T11:00:00Z' }),
    schedule({ frota: 'ENCERRADO-HISTORICO', origemRegistro: 'PCM', dataProgramada: '2026-11-02', situacao: 'ENCERRADO', encerradoDetectadoEm: '2026-11-02T11:00:00Z' }),
    schedule({ frota: 'ENCERRADO-FUTURO', origemRegistro: 'PCM', dataProgramada: '2026-11-04', situacao: 'ENCERRADO', encerradoDetectadoEm: '2026-11-04T11:00:00Z' }),
    schedule({ frota: 'ENCERRADO-SEM-REFERENCIA', origemRegistro: 'PCM', dataProgramada: '2026-11-04', situacao: 'ENCERRADO' }),
    schedule({ frota: 'PENDENTE', dataProgramada: '2026-11-04', situacao: 'PENDENTE' }),
    schedule({ frota: 'ARQUIVADO-ATRASADO', dataProgramada: '2020-01-01', situacao: 'ATRASADO', manualArquivadoEm: '2026-11-01T12:00:00Z' }),
    schedule({ frota: 'ARQUIVADO-ANDAMENTO', dataProgramada: '', situacao: 'ANDAMENTO', manualArquivadoEm: '2026-11-01T12:00:00Z' }),
  ];
  const originalRows = structuredClone(rows);

  const selectedBefore = selectDailyExportSchedules(rows, before0710);
  assertSet(ids(selectedBefore), [
    'ATRASADO-ALL',
    'ATRASADO-INVALID-DATE',
    'PROGRAMADO-PASSADO',
    'PROGRAMADO-HOJE-SEM-HORA',
    'PROGRAMADO-HOJE-FIM',
    'PROGRAMADO-AMANHA-0710',
    'PROGRAMADO-AMANHA-0700',
    'PROGRAMADO-AMANHA-070001',
    'PROGRAMADO-AMANHA-0701',
    'ANDAMENTO-PASSADO',
    'ANDAMENTO-HOJE',
    'ANDAMENTO-AMANHA-0710',
    'ANDAMENTO-AMANHA-0700',
    'ANDAMENTO-AMANHA-070001',
    'ANDAMENTO-AMANHA-0701',
    'ANDAMENTO-SEM-DATA',
    'ENCERRADO-TURNO-ATUAL',
  ], 'antes de 07:10 inclui backlog, hoje, amanhã até 07:10, andamento e encerradas do turno');
  assert.equal(selectedBefore.find(row => row.frota === 'PROGRAMADO-PASSADO').situacao, 'ATRASADO');
  assert.equal(rows.find(row => row.frota === 'PROGRAMADO-PASSADO').situacao, 'PROGRAMADO');
  assert.equal(selectedBefore.find(row => row.frota === 'ENCERRADO-TURNO-ATUAL').situacao, 'ENCERRADO');
  assert.deepEqual(rows, originalRows, 'seleção e normalização não podem mutar as fixtures de entrada');

  const beforeStats = getDailyExportStats(selectedBefore);
  assert.deepEqual(beforeStats, {
    total: 17,
    atrasado: 3,
    pendente: 0,
    programado: 6,
    encerrado: 1,
    andamento: 7,
  }, 'os contadores devem refletir os status efetivos da fotografia operacional');
  assert.equal(
    beforeStats.atrasado + beforeStats.pendente + beforeStats.programado + beforeStats.encerrado + beforeStats.andamento,
    beforeStats.total,
  );

  const selectedAfter = selectDailyExportSchedules(rows, after0710);
  assertSet(ids(selectedAfter), [
    'ATRASADO-ALL',
    'ATRASADO-INVALID-DATE',
    'PROGRAMADO-PASSADO',
    'PROGRAMADO-HOJE-SEM-HORA',
    'PROGRAMADO-HOJE-FIM',
    'PROGRAMADO-AMANHA-0700',
    'ANDAMENTO-PASSADO',
    'ANDAMENTO-HOJE',
    'ANDAMENTO-AMANHA-0700',
    'ANDAMENTO-SEM-DATA',
  ], 'a partir de 07:10 amanhã passa a cortar em 07:00 e nenhuma encerrada entra');
  for (const excluded of [
    'PROGRAMADO-AMANHA-0710', 'PROGRAMADO-AMANHA-071001', 'PROGRAMADO-AMANHA-070001', 'PROGRAMADO-AMANHA-0701',
    'PROGRAMADO-DIA-DEPOIS', 'PROGRAMADO-DATA-INVALIDA',
    'ANDAMENTO-AMANHA-0710', 'ANDAMENTO-AMANHA-071001', 'ANDAMENTO-AMANHA-070001', 'ANDAMENTO-AMANHA-0701',
    'ANDAMENTO-DIA-DEPOIS', 'ENCERRADO-TURNO-ATUAL', 'ENCERRADO-HISTORICO', 'ENCERRADO-FUTURO',
    'ENCERRADO-SEM-REFERENCIA', 'PENDENTE', 'ARQUIVADO-ATRASADO', 'ARQUIVADO-ANDAMENTO',
  ]) {
    assert.equal(selectedAfter.some(row => row.frota === excluded), false, `${excluded} não pertence à janela após 07:10`);
  }

  console.log('OK: janela São Paulo 07:10, limites com segundos, rollover UTC, status operacionais, encerradas, arquivados, imutabilidade e contadores verificados.');
}

main()
  .catch(error => {
    console.error(`FAIL: ${error.stack || error.message}`);
    process.exitCode = 1;
  })
  .finally(() => {
    fs.rmSync(TMP, { recursive: true, force: true });
  });
