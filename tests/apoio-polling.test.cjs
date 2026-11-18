const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');
const { build } = require('esbuild');
const ROOT = path.resolve(__dirname, '..');

(async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'apoio-polling-'));
  try {
    const outfile = path.join(temp, 'apoioPolling.cjs');
    await build({
      entryPoints: [path.join(ROOT, 'src/lib/apoioPolling.ts')],
      outfile, bundle: true, platform: 'node', format: 'cjs', target: 'node18', logLevel: 'silent',
    });
    const polling = require(outfile);
    const now = 1_000_000_000;

    // Versão normalizada.
    assert.equal(polling.versionKey(' 2026-11-15T19:10:02+00:00 '), '2026-11-15T19:10:02+00:00');
    assert.equal(polling.versionKey(''), null);
    assert.equal(polling.versionKey(null), null);
    assert.equal(polling.versionKey(undefined), null);

    // Primeira carga sempre baixa.
    assert.equal(polling.shouldReloadSnapshot({ version: null, loadedAt: null }, 'v1', now), true);

    // Mesma versão e fotografia fresca: não baixa (o caso de cada minuto).
    assert.equal(polling.shouldReloadSnapshot({ version: 'v1', loadedAt: now - 60_000 }, 'v1', now), false);
    assert.equal(polling.shouldReloadSnapshot({ version: 'v1', loadedAt: now - 30_000 }, ' v1 ', now), false);

    // Versão nova respeita o intervalo mínimo automático (5 min).
    assert.equal(polling.shouldReloadSnapshot({ version: 'v1', loadedAt: now - 10_000 }, 'v2', now), false);
    assert.equal(polling.shouldReloadSnapshot({ version: 'v1', loadedAt: now - polling.APOIO_AUTO_RELOAD_MIN_INTERVAL_MS - 1 }, 'v2', now), true);
    // Sem intervalo mínimo (atualização manual), versão nova baixa na hora.
    assert.equal(polling.shouldReloadSnapshot({ version: 'v1', loadedAt: now - 10_000 }, 'v2', now, polling.APOIO_SNAPSHOT_MAX_AGE_MS, 0), true);

    // Mesma versão, mas fotografia velha: revalida por segurança.
    assert.equal(polling.shouldReloadSnapshot({ version: 'v1', loadedAt: now - polling.APOIO_SNAPSHOT_MAX_AGE_MS - 1 }, 'v1', now), true);

    // Sem versão confiável: mantém enquanto nova, revalida quando velha.
    assert.equal(polling.shouldReloadSnapshot({ version: null, loadedAt: now - 1_000 }, null, now), false);
    assert.equal(polling.shouldReloadSnapshot({ version: 'v1', loadedAt: now - 1_000 }, '', now), false);
    assert.equal(polling.shouldReloadSnapshot({ version: 'v1', loadedAt: now - polling.APOIO_SNAPSHOT_MAX_AGE_MS - 1 }, null, now), true);

    // Rajadas de foco/realtime/intervalo não repetem a consulta.
    assert.equal(polling.shouldCheckVersion(null, now), true);
    assert.equal(polling.shouldCheckVersion(now - 1_000, now), false);
    assert.equal(polling.shouldCheckVersion(now - polling.APOIO_VERSION_MIN_INTERVAL_MS, now), true);

    assert.equal(polling.isSnapshotStale(null, now), true);
    assert.equal(polling.isSnapshotStale(now - 1_000, now), false);
    assert.equal(polling.isSnapshotStale(now - polling.APOIO_SNAPSHOT_MAX_AGE_MS, now), true);

    // A TV precisa usar a carga enxuta e escutar só a tabela de controle.
    const hook = fs.readFileSync(path.join(ROOT, 'src/hooks/useTVOrders.ts'), 'utf8');
    assert.match(hook, /loadApoioTVData/, 'TV deve usar a carga enxuta');
    assert.match(hook, /loadApoioVersion/, 'TV deve consultar a versão antes de baixar');
    assert.match(hook, /TV_REALTIME_TABLE = 'apoio_sync'/, 'TV deve escutar só apoio_sync');
    assert.doesNotMatch(hook, /TV_TABLES/, 'TV não deve mais escutar quatro tabelas');
    assert.equal((hook.match(/loadApoioData\(/g) || []).length, 1, 'leitura completa só como fallback');
    assert.match(hook, /shouldReloadSnapshot/, 'TV deve respeitar a versão');

    // O Controle de Apoio trocou o refresh de 60s por verificação de versão.
    const page = fs.readFileSync(path.join(ROOT, 'src/pages/ControleApoio.tsx'), 'utf8');
    assert.match(page, /checkVersion/, 'Controle de Apoio deve verificar a versão');
    assert.match(page, /loadApoioVersion/, 'Controle de Apoio deve usar a consulta mínima');
    assert.doesNotMatch(page, /setInterval\(\(\) => \{ void refresh\(\); \}, 60_000\)/, 'não deve baixar a fotografia a cada minuto');

    // O serviço precisa expor as funções econômicas.
    const service = fs.readFileSync(path.join(ROOT, 'src/lib/apoioService.ts'), 'utf8');
    assert.match(service, /export async function loadApoioVersion/);
    assert.match(service, /export async function loadApoioTVData/);
    assert.match(service, /\.eq\('ativo', true\)/, 'carga da TV só traz ordens ativas');

    // Lavagem: a fotografia de 1,3 MB não pode mais descer a cada 15 segundos.
    const schedules = fs.readFileSync(path.join(ROOT, 'src/hooks/useSchedules.ts'), 'utf8');
    assert.match(schedules, /const AUTO_REFRESH_MS = 5 \* 60 \* 1000/, 'Lavagem deve usar 5 minutos');
    assert.match(schedules, /const REALTIME_MIN_MS = 2 \* 60 \* 1000/, 'tempo real não pode recarregar em rajada');
    assert.match(schedules, /syncIfStale/, 'Lavagem deve pular cargas repetidas');
    assert.doesNotMatch(schedules, /AUTO_REFRESH_MS = 15 \* 1000/, 'não deve voltar aos 15 segundos');
    assert.doesNotMatch(schedules, /setTimeout\(\(\) => syncFromSheet\(true, true\), 400\)/, 'tempo real deve passar pelo limite');

    console.log('OK: revalidação econômica — versão só baixa quando muda, fotografia velha revalida, TV usa carga enxuta e escuta só apoio_sync.');
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
})().catch(error => {
  console.error(error);
  process.exit(1);
});
