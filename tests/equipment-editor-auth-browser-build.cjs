const { build } = require('esbuild');
const fs = require('fs');
const path = require('path');

const dir = path.resolve('tests/.tmp-equipment-editor-auth');
fs.mkdirSync(dir, { recursive: true });
build({
  entryPoints: ['tests/equipment-editor-auth-harness.tsx'],
  outfile: path.join(dir, 'equipment-editor-auth-harness.js'),
  bundle: true,
  platform: 'browser',
  format: 'esm',
  plugins: [{
    name: 'mock-editor-auth',
    setup(buildApi) {
      buildApi.onLoad({ filter: /src\/lib\/apoioService\.ts$/ }, () => ({
        contents: fs.readFileSync('tests/equipment-editor-auth-mock.ts', 'utf8'),
        loader: 'ts',
      }));
    },
  }],
}).then(() => {
  fs.writeFileSync(path.join(dir, 'index.html'), '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/equipment-image-manager.css"></head><body><div id="root"></div><script type="module" src="/equipment-editor-auth-harness.js"></script></body></html>');
  fs.copyFileSync('src/styles/equipment-image-manager.css', path.join(dir, 'equipment-image-manager.css'));
  console.log('Harness browser Auth mockado pronto.');
}).catch((error) => { console.error(error); process.exitCode = 1; });
