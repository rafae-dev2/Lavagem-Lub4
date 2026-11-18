const assert = require('node:assert/strict');
const { buildSync } = require('esbuild');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'apoio-card-'));
const out = path.join(dir, 'date.cjs');
buildSync({entryPoints:['src/lib/apoioCardPresentation.ts'],outfile:out,bundle:true,format:'cjs',platform:'node',logLevel:'silent'});
const { apoioForecastOverdue } = require(out);
const check = (previsao, now, ativo = true) => apoioForecastOverdue({ativo, previsao}, new Date(now));
assert.equal(check('2026-11-06T17:00:00', '2026-11-06T20:00:01Z'),true);
assert.equal(check('2026-11-06T17:00:00', '2026-11-06T20:00:00Z'),false);
assert.equal(check('2026-11-06T20:00:00Z', '2026-11-06T20:00:01Z'),true);
assert.equal(check('2026-11-06', '2026-11-06T20:00:00Z'),false);
assert.equal(check('2026-11-06', '2026-11-07T03:00:00Z'),true);
assert.equal(check('2026-11-06T17:00:00', '2026-11-06T23:00:00Z',false),false);
for (const invalid of ['', 'não disponível', '2026-02-30', '2026-11-06T25:00', '2026-13-01', '2026-11-06T17:80:00']) {
  assert.equal(check(invalid, '2026-11-07T03:00:00Z'),false,invalid);
}
assert.equal(check('2026-11-06', 'inválido'),false);
fs.rmSync(dir,{recursive:true,force:true});
console.log('OK: previsão vencida sem alterar status, dia civil até23:59:59, Brasília/UTC e datas inválidas.');
