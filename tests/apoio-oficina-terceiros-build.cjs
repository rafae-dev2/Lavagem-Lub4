const { build } = require('esbuild');
const path = require('path');
const fs = require('fs');

const dir = path.resolve('tests/.tmp-oficina-terceiros');
fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(dir, { recursive: true });

build({
  entryPoints: ['tests/apoio-oficina-terceiros-harness.ts'],
  outdir: dir,
  bundle: true,
  platform: 'browser',
  format: 'esm',
  target: 'chrome110',
  logLevel: 'warning',
})
  .then(() => {
    fs.writeFileSync(
      path.join(dir, 'index.html'),
      '<!doctype html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Relatório oficina de terceiros</title></head><body><div id="root"></div><script type="module" src="/apoio-oficina-terceiros-harness.js"></script></body></html>',
    );
    console.log('Harness Equipamentos em Oficina de Terceiros pronto.');
  })
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
