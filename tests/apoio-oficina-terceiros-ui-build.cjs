const { build } = require('esbuild');
const path = require('path');
const fs = require('fs');

const dir = path.resolve('tests/.tmp-oficina-terceiros-ui');
fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(dir, { recursive: true });

build({
  entryPoints: ['tests/apoio-oficina-terceiros-ui-harness.tsx'],
  outdir: dir,
  bundle: true,
  platform: 'browser',
  format: 'esm',
  target: 'chrome110',
  jsx: 'automatic',
  external: ['/apoio-reference-ribbons.svg', '/apoio-reference-header.svg'],
  logLevel: 'warning',
  loader: { '.png': 'dataurl', '.svg': 'dataurl' },
  plugins: [{
    name: 'mock-apoio',
    setup(builder) {
      builder.onLoad({ filter: /src\/lib\/apoioService\.ts$/ }, () => ({
        loader: 'ts',
        contents: fs.readFileSync('tests/apoio-oficina-terceiros-ui-mock.ts', 'utf8'),
      }));
    },
  }],
})
  .then(async () => {
    const css = path.join(dir, 'apoio-oficina-terceiros-ui-harness.css');
    const result = await require('postcss')([require('tailwindcss'), require('autoprefixer')]).process(fs.readFileSync(css, 'utf8'), { from: css });
    fs.writeFileSync(css, result.css);
    fs.writeFileSync(
      path.join(dir, 'index.html'),
      '<!doctype html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/apoio-oficina-terceiros-ui-harness.css"></head><body><div id="root"></div><script type="module" src="/apoio-oficina-terceiros-ui-harness.js"></script></body></html>',
    );
    console.log('Harness de interface do relatório pronto.');
  })
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
