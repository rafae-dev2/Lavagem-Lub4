const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { build } = require('esbuild');

(async () => {
  const baseline = fs.readFileSync('tests/fixtures/Exportar-before-PCM.tsx', 'utf8');
  const current = fs.readFileSync('src/pages/Exportar.tsx', 'utf8');
  const generators = text => text.slice(text.indexOf('// ─── Paleta de status'), text.indexOf('export default function Exportar'));
  assert.equal(generators(current), generators(baseline), 'O desenho ou gerador de imagem mudou');
  const pdf = text => text.slice(text.indexOf('  const handleGeneratePdf = async'), text.indexOf('  const shareWhatsApp'))
    .replace('      const filtered = selectRowsForExport(now);\n      const stats = getDailyExportStats(filtered);\n      setClock(now.getTime());\n', '');
  assert.equal(pdf(current), pdf(baseline), 'O gerador PDF mudou');
  for (const name of ['src/lib/apoioReport.ts', 'src/lib/apoioImageReport.ts']) {
    const hash = require('node:crypto').createHash('sha256').update(fs.readFileSync(name)).digest('hex');
    assert.ok(fs.readFileSync('tests/fixtures/relatorios-hashes-antes.txt', 'utf8').includes(hash), `${name} foi alterado`);
  }
  const out = path.resolve('tests/.tmp'); fs.mkdirSync(out, { recursive: true });
  for (const [label, source] of [['before', baseline], ['after', current]]) {
    const prefix = source.slice(0, source.indexOf('export default function Exportar'));
    const harness = prefix + `\nwindow.render_${label} = async (rows, themeName, sizeName) => { const stats = {total:rows.length,atrasado:rows.filter(x=>x.situacao==='ATRASADO').length,pendente:rows.filter(x=>x.situacao==='PENDENTE').length,programado:rows.filter(x=>x.situacao==='PROGRAMADO').length,andamento:rows.filter(x=>x.situacao==='ANDAMENTO').length,encerrado:rows.filter(x=>x.situacao==='ENCERRADO').length};return await generatePagePremium(rows,stats,await loadLogo('/logo.png'),1,1,new Date('2026-11-04T10:05:00-03:00'),THEMES[themeName],SIZE_CONFIGS.find(x=>x.id===sizeName));};`;
    await build({ stdin: { contents: harness, resolveDir: path.resolve('src/pages'), loader: 'tsx' }, bundle: true, format: 'iife', platform: 'browser', outfile: path.join(out, `pcm-report-${label}.js`) });
  }
  await build({ entryPoints: ['src/lib/pcmReportFilters.ts'], bundle: true, platform: 'node', format: 'cjs', outfile: path.join(out, 'pcm-report-filters.cjs') });
  const { pcmWeekRange, matchesPCMReportFilters } = require(path.join(out, 'pcm-report-filters.cjs'));
  assert.deepEqual(pcmWeekRange('2026-11-04'), { start: '2026-11-02', end: '2026-11-08' });
  assert.equal(pcmWeekRange('2026-02-31'), null);
  const row = { dataProgramada: '2026-11-04', tipoPreventiva: 'Troca de Óleo', origemRegistro: 'PCM', apoioId: 'teste' };
  assert.equal(matchesPCMReportFilters(row, { tipo: 'Troca de Óleo', origem: 'PCM', apoio: 'teste', semana: '2026-11-04' }), true);
  assert.equal(matchesPCMReportFilters(row, { tipo: 'Lavagem / Lubrificação', origem: '', apoio: '', semana: '' }), false);
  assert.equal(matchesPCMReportFilters(row, { tipo: '', origem: 'MANUAL', apoio: '', semana: '' }), false);
  assert.equal(matchesPCMReportFilters({ ...row, dataProgramada: '2026-11-01' }, { tipo: '', origem: '', apoio: '', semana: '2026-11-04' }), false);
  assert.equal(matchesPCMReportFilters({ dataProgramada: '' }, { tipo: '', origem: '', apoio: '', semana: '' }), true);
  console.log('OK: desenhos e geradores PDF/PNG e relatórios do Apoio preservados; filtros PCM verificados.');
})();
