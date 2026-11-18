const { build } = require('esbuild');
const fs = require('node:fs');
const path = require('node:path');

const dir = path.resolve('tests/.tmp-apoio-sticky-search');
fs.mkdirSync(dir, { recursive: true });

build({
  entryPoints: ['tests/apoio-reformas-layout-harness.tsx'],
  outdir: dir,
  bundle: true,
  platform: 'browser',
  format: 'esm',
  jsx: 'automatic',
  external: ['/apoio-reference-ribbons.svg', '/apoio-reference-header.svg'],
  loader: { '.png': 'dataurl', '.svg': 'dataurl' },
  plugins: [{
    name: 'only-local-apoio-mock',
    setup(buildApi) {
      buildApi.onLoad({ filter: /src\/lib\/apoioService\.ts$/ }, () => ({
        loader: 'ts',
        contents: fs.readFileSync('tests/apoio-table-mock.ts', 'utf8').replace(
          'const groups=',
          "orders.push({...orders[0],chave:'OS-DEMO-4',os:'159339998',frota:'15116',origem:'Oficina Interna',modelo:'Carreta Área de Vivência',entrada:'2026-11-06T07:00:00-03:00',previsao:'2026-12-08T23:00:00-03:00',narrativa:'Prévia de teste: conferir conjunto hidráulico e validar funcionamento antes da liberação.'});const groups=",
        ),
      }));
      buildApi.onResolve({ filter: /hooks\/useMaintenanceTracking$/ }, () => ({
        path: path.resolve('tests/apoio-reformas-comparison-hook.ts'),
      }));
    },
  }],
}).then(async () => {
  const cssFile = path.join(dir, 'apoio-reformas-layout-harness.css');
  const result = await require('postcss')([require('tailwindcss'), require('autoprefixer')]).process(fs.readFileSync(cssFile, 'utf8'), { from: cssFile });
  fs.writeFileSync(cssFile, result.css);
  fs.writeFileSync(path.join(dir, 'index.html'), '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/apoio-reformas-layout-harness.css"></head><body><div id="root"></div><script type="module" src="/apoio-reformas-layout-harness.js"></script></body></html>');
  console.log('Harness fullLayout Apoio sticky pronto; somente mock local.');
}).catch(error => {
  console.error(error);
  process.exitCode = 1;
});
