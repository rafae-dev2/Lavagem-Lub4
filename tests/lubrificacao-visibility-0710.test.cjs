const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { buildSync } = require('esbuild');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'visibility0710-'));
try {
  const outfile = path.join(dir, 'visibility.cjs');
  buildSync({ entryPoints: [path.resolve(__dirname, '../src/lib/scheduleVisibility.ts')], outfile, bundle: true, platform: 'node', format: 'cjs', logLevel: 'silent' });
  const v = require(outfile);
  const store = new Map();
  global.localStorage = { getItem: key => store.get(key) || null, setItem: (key, value) => store.set(key, value) };
  const before = new Date('2026-11-05T07:09:59.999-03:00');
  const after = new Date('2026-11-05T07:10:00-03:00');
  const previous = { situacao: 'ENCERRADO', origemRegistro: 'PCM', encerradoDetectadoEm: '2026-11-04T15:00:00-03:00' };
  assert.equal(v.getOperationalCutoff(before).toISOString(), '2026-11-04T10:10:00.000Z');
  assert.equal(v.getOperationalCutoff(after).toISOString(), '2026-11-05T10:10:00.000Z');
  assert.equal(v.shouldHideClosedSchedule(previous, before), false);
  assert.equal(v.shouldHideClosedSchedule(previous, after), true);
  assert.equal(v.shouldHideClosedSchedule({ ...previous, encerradoDetectadoEm: '2026-11-05T07:10:00-03:00' }, after), false);
  for (const situacao of ['ATRASADO', 'PROGRAMADO', 'ANDAMENTO', 'PENDENTE']) {
    assert.equal(v.shouldHideClosedSchedule({ ...previous, situacao, dataProgramada: '2026-12-31' }, after), false);
  }
  assert.equal(v.shouldHideClosedSchedule({ situacao: 'ENCERRADO', origemRegistro: 'PCM', dataProgramada: '2020-01-01' }, after), false);
  assert.equal(v.parseLocalDateTime('2026-11-05', '07:10:01').toISOString(), '2026-11-05T10:10:01.000Z');
  assert.equal(v.parseLocalDateTime('2026-02-30', '07:00'), null);
  assert.equal(v.parseLocalDateTime('2026-11-05', '07:00:60'), null);
  assert.equal(v.getLocalDateStr(new Date('2026-11-05T02:00:00Z')), '2026-11-04');
  assert.equal(v.getEffectiveHideEncerradas(before), true);
  v.setManualHideEncerradas(false, before);
  assert.equal(v.getEffectiveHideEncerradas(before), false);
  assert.equal(v.getEffectiveHideEncerradas(after), true);
  v.setManualHideEncerradas(false, after);
  assert.equal(v.getEffectiveHideEncerradas(after), false);
  assert.equal(v.getEffectiveHideEncerradas(new Date('2026-11-06T07:10:00-03:00')), true);
  store.set(v.HIDE_ENCERRADAS_STORAGE_KEY, JSON.stringify({ windowKey: '2026-11-05', hidden: false }));
  assert.equal(v.getEffectiveHideEncerradas(after), true);
  console.log('OK: controle todas datas, ocultação 07:10 Brasília, referência PCM/manual, segundos e reset da consulta manual.');
} finally { fs.rmSync(dir, { recursive: true, force: true }); }
