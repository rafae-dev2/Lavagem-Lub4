// Verificação local, sem navegador, sem gravações remotas e sem classificação operacional fictícia.
const { build } = require('esbuild');
const fs = require('node:fs');
const path = require('node:path');
const sourcePath = process.argv[2];
if (!sourcePath) throw new Error('Informe um JSON real da fonte como argumento.');
(async () => {
  const out = path.resolve('tests/.tmp');
  fs.mkdirSync(out, { recursive: true });
  await build({ stdin: { contents: fs.readFileSync('src/lib/apoioReport.ts', 'utf8') + '\nexport { buildPdf };\n', resolveDir: path.resolve('src/lib'), loader: 'ts' }, outfile: path.join(out, 'report.cjs'), bundle: true, format: 'cjs', platform: 'node', packages: 'external' });
  const { buildPdf } = require(path.join(out, 'report.cjs'));
  const logo = 'data:image/png;base64,' + fs.readFileSync('public/logo.png').toString('base64');
  // Adapter de DOM para a conversão do logo; retorna os bytes reais fornecidos no projeto.
  global.window = {};
  global.document = { createElement: () => ({ width: 1, height: 1, getContext: () => ({ drawImage() {} }), toDataURL: () => logo }) };
  global.Image = class { constructor() { this.naturalWidth = 1024; this.naturalHeight = 1024; } set src(value) { queueMicrotask(() => this.onload()); } };
  const j = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
  const rows = j.ordens.slice(0, 12).map(o => ({ chave: `${o.eq}|${o.os}`, os: String(o.os), frota: String(o.eq), modelo: o.modelo || '', grupo_fonte: o.grupo || '', setor: o.setor || '', ponto: o.ponto || '', origem: o.origem || '', prestador: o.prestador || '', status: o.status || '', entrada: o.entrada || '', previsao: o.prev || '', narrativa: o.narrativa || '', ativo: true, primeira_vista: j.atualizado, ultima_vista: j.atualizado, ausente_desde: null, apoio: 'Não cadastrado como próprio', equipamento: o.modelo || '' }));
  const doc = await buildPdf({ rows, filters: ['Amostra técnica: primeiras 12 ordens da fonte pública', 'Sem cadastro ou atribuição de equipamentos próprios', 'Local: todos', 'Status: todos'], sourceUpdated: j.atualizado, lastSynced: j.atualizado, view: 'Amostra técnica da fonte — sem classificação própria' });
  fs.writeFileSync(path.join(out, 'apoio-relatorio-verificacao.pdf'), Buffer.from(doc.output('arraybuffer')));
  console.log(`PDF com ${rows.length} ordens reais e ${doc.getNumberOfPages()} páginas gerado em ${out}.`);
})();
