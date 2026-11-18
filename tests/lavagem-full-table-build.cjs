const { build } = require('esbuild');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const dir = path.join(root, 'tests/.tmp-lavagem-full-table');
fs.mkdirSync(dir, { recursive: true });

const cssFiles = [
  'src/index.css',
  'src/styles/glassy-v18.css',
  'src/styles/glassy-v18-refinements.css',
  'src/styles/apoio-premium.css',
  'src/styles/apoio-reference.css',
  'src/styles/apoio-devices.css',
  'src/styles/shell-theme.css',
  'src/styles/sidebar-motion.css',
  'src/styles/lavagem-premium.css',
  'src/styles/operational-compact.css',
  'src/styles/lubrificacao.css',
  'src/styles/mobile-operations-v1011.css',
  'src/styles/equipment-images.css',
];

const fullCss = cssFiles.map(file => fs.readFileSync(path.join(root, file), 'utf8')).join('\n\n');
const legacyMarker = '.lavagem-premium .lub-module:not(.lub-operations-v1011)';
const legacyCss = fullCss.split(legacyMarker).join('.lavagem-premium .lub-module');

build({
  entryPoints: [path.join(root, 'tests/lavagem-full-table-harness.tsx')],
  outfile: path.join(dir, 'lavagem-full-table.js'),
  bundle: true,
  platform: 'browser',
  format: 'esm',
  loader: { '.png': 'dataurl', '.svg': 'dataurl', '.css': 'empty' },
  logLevel: 'warning',
}).then(() => {
  fs.writeFileSync(path.join(dir, 'lavagem-full-table.css'), fullCss);
  fs.writeFileSync(path.join(dir, 'lavagem-full-table-baseline.css'), legacyCss);
  const html = (css) => `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/${css}"></head><body><div id="root"></div><script type="module" src="/lavagem-full-table.js"></script></body></html>`;
  fs.writeFileSync(path.join(dir, 'index.html'), html('lavagem-full-table.css'));
  fs.writeFileSync(path.join(dir, 'baseline.html'), html('lavagem-full-table-baseline.css'));
  console.log(`Harness completo pronto em ${dir}`);
}).catch(error => {
  console.error(error);
  process.exitCode = 1;
});
