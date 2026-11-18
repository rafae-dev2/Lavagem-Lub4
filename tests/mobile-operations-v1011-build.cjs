const { build } = require('esbuild');
const fs = require('fs');
const path = require('path');

const dir = path.resolve('tests/.tmp-mobile-operations-v1011');
fs.mkdirSync(dir, { recursive: true });
const existingCss = path.resolve('tests/.tmp-apoio-table/apoio-table-harness.css');
if (!fs.existsSync(existingCss)) throw new Error(`CSS base do harness ausente: ${existingCss}`);

build({
  entryPoints: ['tests/apoio-table-harness.tsx'],
  outfile: path.join(dir, 'mobile-operations-v1011.js'),
  bundle: true,
  platform: 'browser',
  format: 'esm',
  external: ['/apoio-reference-ribbons.svg', '/apoio-reference-header.svg'],
  loader: { '.png': 'dataurl', '.svg': 'dataurl' },
  plugins: [{
    name: 'mock-apoio',
    setup(b) {
      b.onLoad({ filter: /src\/lib\/apoioService\.ts$/ }, () => ({
        loader: 'ts',
        contents: fs.readFileSync('tests/apoio-table-mock.ts', 'utf8'),
      }));
    },
  }],
}).then(() => {
  const css = fs.readFileSync(existingCss, 'utf8');
  const scoped = fs.readFileSync('src/styles/mobile-operations-v1011.css', 'utf8');
  fs.writeFileSync(path.join(dir, 'mobile-operations-v1011.css'), `${css}\n/* v10.11 test overlay */\n${scoped}`);
  fs.writeFileSync(path.join(dir, 'index.html'), '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/mobile-operations-v1011.css"></head><body><div id="root"></div><script type="module" src="/mobile-operations-v1011.js"></script></body></html>');
  console.log(`Harness v10.11 pronto em ${dir}`);
}).catch(error => { console.error(error); process.exitCode = 1; });
