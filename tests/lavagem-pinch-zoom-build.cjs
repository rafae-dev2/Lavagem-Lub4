const { build } = require('esbuild');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const dir = path.join(root, 'tests/.tmp-lavagem-pinch-zoom');
fs.mkdirSync(dir, { recursive: true });

build({
  entryPoints: [path.join(root, 'tests/lavagem-pinch-zoom-harness.tsx')],
  outfile: path.join(dir, 'lavagem-pinch-zoom.js'),
  bundle: true,
  platform: 'browser',
  format: 'esm',
  loader: { '.png': 'dataurl', '.svg': 'dataurl' },
}).then(() => {
  const css = [
    fs.readFileSync(path.join(root, 'src/index.css'), 'utf8'),
    fs.readFileSync(path.join(root, 'src/styles/lubrificacao.css'), 'utf8'),
    fs.readFileSync(path.join(root, 'src/styles/mobile-operations-v1011.css'), 'utf8'),
  ].join('\n');
  fs.writeFileSync(path.join(dir, 'lavagem-pinch-zoom.css'), css);
  fs.writeFileSync(
    path.join(dir, 'index.html'),
    '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/lavagem-pinch-zoom.css"></head><body><div id="root"></div><script type="module" src="/lavagem-pinch-zoom.js"></script></body></html>',
  );
  console.log(`Harness de pinch zoom pronto em ${dir}`);
}).catch(error => {
  console.error(error);
  process.exitCode = 1;
});
