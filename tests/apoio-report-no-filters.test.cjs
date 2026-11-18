// Regressão local: filtros e view são dados de seleção, não metadados dos exports PDF/imagem.
// Não usa rede, Supabase ou dados operacionais reais.
const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { build } = require('esbuild');

const root = path.resolve(__dirname, '..');
const temp = fs.mkdtempSync(path.join(root, 'tests/.tmp-apoio-no-filters-'));
const reportBundle = path.join(temp, 'report.cjs');
const pdfPath = path.join(temp, 'report.pdf');
const textPath = path.join(temp, 'report.txt');

const row = {
  chave: 'F-01|42',
  os: '42',
  frota: 'F-01',
  modelo: 'Escavadeira de teste',
  grupo_fonte: 'Grupo de teste',
  setor: 'Operações',
  ponto: 'Oficina interna',
  origem: 'Oficina',
  prestador: '',
  status: 'Em andamento',
  entrada: '2026-11-01T09:00:00',
  previsao: '2026-11-10T09:00:00',
  narrativa: 'Narrativa operacional preservada no relatório.',
  ativo: true,
  primeira_vista: '2026-11-05T10:00:00Z',
  ultima_vista: '2026-11-05T10:00:00Z',
  ausente_desde: null,
  apoio: 'Grupo de teste',
  equipamento: 'Escavadeira de teste',
};

function installPdfDomMock() {
  const logo = 'data:image/png;base64,' + fs.readFileSync(path.join(root, 'public/logo.png')).toString('base64');
  const context = {
    filter: '',
    globalCompositeOperation: 'source-over',
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    createLinearGradient() {
      return { addColorStop() {} };
    },
    fillRect() {},
    beginPath() {},
    arc() {},
    fill() {},
    stroke() {},
    drawImage() {},
  };
  global.window = {};
  global.document = {
    createElement() {
      return {
        width: 1,
        height: 1,
        getContext: () => context,
        toDataURL: () => logo,
      };
    },
  };
  global.Image = class {
    constructor() {
      this.naturalWidth = 1024;
      this.naturalHeight = 1024;
    }
    set src(_value) {
      queueMicrotask(() => this.onload?.());
    }
  };
}

(async () => {
  try {
    const reportSource = fs.readFileSync(path.join(root, 'src/lib/apoioReport.ts'), 'utf8');
    await build({
      stdin: {
        contents: `${reportSource}\nexport { buildPdf, reportFilename };\n`,
        resolveDir: path.join(root, 'src/lib'),
        loader: 'ts',
      },
      outfile: reportBundle,
      bundle: true,
      format: 'cjs',
      platform: 'node',
      packages: 'external',
    });
    const { buildPdf, reportFilename } = require(reportBundle);
    const options = {
      rows: [row],
      filters: ['filterCanary — grupo secreto', 'Outro filtro que não deve aparecer'],
      sourceUpdated: '2026-11-05T10:00:00Z',
      lastSynced: '2026-11-05T10:00:00Z',
      view: 'VIEW_CANARY',
      sourceError: 'Dados desatualizados para teste.',
    };

    assert.match(reportFilename('xlsx', options, new Date('2026-11-05T12:00:00Z')), /filtercanary/);
    assert.doesNotMatch(reportFilename('pdf', options, new Date('2026-11-05T12:00:00Z')), /filtercanary/i);

    installPdfDomMock();
    const doc = await buildPdf(options);
    fs.writeFileSync(pdfPath, Buffer.from(doc.output('arraybuffer')));
    const extraction = childProcess.spawnSync('pdftotext', [pdfPath, textPath], { encoding: 'utf8' });
    assert.equal(extraction.status, 0, extraction.stderr || 'pdftotext falhou');
    const pdfText = fs.readFileSync(textPath, 'utf8');

    assert.match(pdfText, /Resumo operacional/);
    assert.match(pdfText, /Ordens selecionadas: 1/);
    assert.match(pdfText, /Atualização pendente: consulte o aplicativo antes de tomar decisões\./);
    assert.match(pdfText, /Narrativa operacional preservada no relatório\./);
    assert.doesNotMatch(pdfText, /filterCanary/i);
    assert.doesNotMatch(pdfText, /VIEW_CANARY/i);
    assert.doesNotMatch(pdfText, /Filtros ativos|Filtro ativo|Sem filtros informados|Visão:/i);

    const imageSource = fs.readFileSync(path.join(root, 'src/lib/apoioImageReport.ts'), 'utf8');
    assert.doesNotMatch(imageSource, /options\.filters\.forEach/);
    assert.doesNotMatch(imageSource, /appendLongText\([^\n]*Filtro/);
    assert.match(imageSource, /Atualização pendente: consulte o aplicativo antes de tomar decisões\./);

    console.log('OK: PDF sem filtros/view, aviso preservado, filename PDF sem valores de filtro e composição de imagem sem bloco de filtros.');
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
