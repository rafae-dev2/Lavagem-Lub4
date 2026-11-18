const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { buildSync } = require('esbuild');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'maintenance-visibility-'));
try {
  const outfile = path.join(dir, 'maintenanceVisibility.cjs');
  buildSync({
    entryPoints: [path.resolve(__dirname, '../src/lib/maintenanceVisibility.ts')],
    outfile,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    logLevel: 'silent',
  });

  const store = new Map();
  global.localStorage = {
    getItem: (key) => store.get(key) || null,
    setItem: (key, value) => store.set(key, value),
  };
  const visibility = require(outfile);
  const nowBeforeCutoff = new Date('2026-11-05T07:09:59.999-03:00');
  const nowAtCutoff = new Date('2026-11-05T07:10:00-03:00');

  const row = (overrides = {}) => ({
    chave: overrides.chave || 'fleet::os',
    os: overrides.os || 'OS-1',
    frota: '23677',
    modelo: 'Carreta canavieira',
    grupo_fonte: 'Carretas Canavieiras',
    setor: 'Mecânica',
    ponto: 'Preventiva mecânica',
    origem: 'Oficina',
    prestador: 'Oficina Teste',
    status: 'PROGRAMADA',
    entrada: '2026-11-01T08:00:00-03:00',
    previsao: '2026-11-09',
    narrativa: 'Preventiva mecânica',
    ativo: false,
    primeira_vista: '2026-11-01T08:00:00-03:00',
    ultima_vista: '2026-11-05T06:00:00-03:00',
    ausente_desde: null,
    classe: 'PREVENTIVA',
    motivo: 'PREVENTIVA MECANICA',
    apoio: 'Carretas Canavieiras',
    equipamento: 'Carreta canavieira',
    trackingStatus: 'encerrado',
    classificationReason: 'fixture',
    overdue: false,
    closureOrigin: 'ausencia',
    closedDetectedAt: '2026-11-05T06:59:00-03:00',
    ...overrides,
  });

  const beforeCurrentCutoff = row({
    chave: 'before-current-cutoff',
    closedDetectedAt: '2026-11-05T06:59:00-03:00',
  });
  const exactCutoff = row({
    chave: 'exact-cutoff',
    closedDetectedAt: '2026-11-05T07:10:00-03:00',
  });
  const todayRecent = row({
    chave: 'today-recent',
    closedDetectedAt: '2026-11-05T08:00:00-03:00',
  });
  const withoutDate = row({
    chave: 'without-date',
    closureOrigin: 'fonte',
    status: 'ENCERRADA',
    ativo: true,
    closedDetectedAt: null,
  });
  const reappeared = row({
    chave: 'reappeared',
    trackingStatus: 'programado',
    status: 'PROGRAMADA',
    ativo: true,
    closureOrigin: null,
    closedDetectedAt: null,
  });

  assert.equal(
    visibility.shouldHideClosedTrackingRow(beforeCurrentCutoff, nowBeforeCutoff),
    false,
    'uma saída detectada antes das 07:10 ainda pertence à janela em andamento',
  );
  assert.equal(
    visibility.shouldHideClosedTrackingRow(beforeCurrentCutoff, nowAtCutoff),
    true,
    'a mesma saída passa ao arquivo após o corte',
  );
  assert.equal(
    visibility.shouldHideClosedTrackingRow(exactCutoff, nowAtCutoff),
    false,
    'detecção exatamente às 07:10 permanece visível',
  );
  assert.equal(
    visibility.shouldHideClosedTrackingRow(todayRecent, nowAtCutoff),
    false,
    'encerrada recente de hoje permanece visível',
  );
  assert.equal(
    visibility.shouldHideClosedTrackingRow(withoutDate, nowAtCutoff),
    false,
    'status encerrado sem data oficial nunca é ocultado',
  );
  assert.equal(
    visibility.shouldHideClosedTrackingRow(reappeared, nowAtCutoff),
    false,
    'ordem que reapareceu como programada não fica presa no arquivo',
  );

  const allRows = [beforeCurrentCutoff, exactCutoff, todayRecent, withoutDate, reappeared];
  assert.deepEqual(
    visibility
      .getVisibleTrackingRows(allRows, true, nowAtCutoff)
      .map((item) => item.chave),
    ['exact-cutoff', 'today-recent', 'without-date', 'reappeared'],
    'modo operacional oculta somente encerradas anteriores ao corte',
  );
  assert.equal(
    visibility.getVisibleTrackingRows(allRows, false, nowAtCutoff).length,
    allRows.length,
    'override manual permite selecionar todo o histórico encerrado',
  );
  const rowsForStatus = (status) => visibility.getVisibleTrackingRows(
    allRows,
    status !== 'encerrado',
    nowAtCutoff,
  );
  assert.equal(
    rowsForStatus('encerrado').length,
    allRows.length,
    'a aba Encerrado revela todas as encerradas, inclusive as anteriores ao corte',
  );
  assert.equal(
    rowsForStatus('programado').some((item) => item.chave === 'before-current-cutoff'),
    false,
    'ao voltar para Programado o arquivo não permanece desarquivado',
  );
  assert.equal(
    rowsForStatus('andamento').some((item) => item.chave === 'before-current-cutoff'),
    false,
    'ao voltar para Andamento o arquivo não permanece desarquivado',
  );
  assert.equal(visibility.countHiddenTrackingRows(allRows, nowAtCutoff), 1);

  assert.equal(visibility.getEffectiveHideEncerradas(nowAtCutoff), true);
  visibility.setManualHideEncerradas(false, nowAtCutoff);
  assert.equal(
    visibility.getEffectiveHideEncerradas(nowAtCutoff),
    false,
    'override manual mostrar permanece na janela atual',
  );
  visibility.setManualHideEncerradas(true, nowAtCutoff);
  assert.equal(visibility.getEffectiveHideEncerradas(nowAtCutoff), true);
  assert.equal(
    visibility.getEffectiveHideEncerradas(new Date('2026-11-06T07:10:00-03:00')),
    true,
    'a próxima janela volta ao modo operacional',
  );

  console.log('OK: visibilidade — antes/exato corte, data ausente, recente, override manual e reaparecimento.');
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
