const { build } = require('esbuild');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'tests/.tmp-glassy');
fs.mkdirSync(output, { recursive: true });
build({
  absWorkingDir: root,
  entryPoints: ['tests/glassy-apoio-harness.tsx'],
  outfile: 'tests/.tmp-glassy/harness.js',
  bundle: true,
  platform: 'browser',
  format: 'iife',
  define: { 'process.env.NODE_ENV': '"development"' },
  plugins: [{
    name: 'isolated-apoio-service',
    setup(build) {
      build.onResolve({ filter: /lib\/apoioService$/ }, () => ({ path: path.join(root, 'tests/glassy-apoio-service-mock.ts') }));
    },
  }],
}).then(() => {
  execFileSync(path.join(root, 'node_modules/.bin/tailwindcss'), ['-i','src/index.css','-o','tests/.tmp-glassy/base.css','--minify'], { cwd: root, stdio: 'inherit' });
  console.log('Harness local preparado. Todas as funções do apoioService são simuladas; nenhuma mutação real é possível.');
}).catch(error => { console.error(error); process.exitCode = 1; });
