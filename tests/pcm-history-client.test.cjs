const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { build } = require('esbuild');

const ROOT = path.resolve(__dirname, '..');
const TMP = path.join('/tmp', `pcm-history-tests-${process.pid}`);
fs.mkdirSync(TMP, { recursive: true });

function createSupabaseMock() {
  const state = { rpcCalls: [], rpcResponse: { data: [], error: null } };
  const supabase = {
    rpc: async (name, args) => {
      state.rpcCalls.push({ name, args });
      return state.rpcResponse;
    },
  };
  return { state, supabase };
}

function supabasePlugin() {
  return {
    name: 'pcm-history-supabase-mock',
    setup(esbuild) {
      esbuild.onResolve({ filter: /supabaseClient$/ }, () => ({ path: 'pcm-history-supabase', namespace: 'pcm-history-supabase' }));
      esbuild.onLoad({ filter: /.*/, namespace: 'pcm-history-supabase' }, () => ({
        loader: 'js',
        contents: `export const supabase = globalThis.__pcmHistorySupabase; export const LAVAGEM_TABLE = 'lavagem_lubrificacao'; export const SUPABASE_URL = 'https://mock.supabase.local';`,
      }));
    },
  };
}

async function loadBundled(entryPoint) {
  const outfile = path.join(TMP, `${path.basename(entryPoint).replace(/[^a-z0-9]/gi, '_')}-${Math.random().toString(16).slice(2)}.cjs`);
  await build({
    entryPoints: [entryPoint],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node18',
    plugins: [supabasePlugin()],
    outfile,
    logLevel: 'silent',
  });
  delete require.cache[require.resolve(outfile)];
  return require(outfile);
}

function raw(overrides = {}) {
  return {
    id: 1,
    frota: '4508',
    local: 'LAVADOR',
    tipo: 'Lavagem / Lubrificação',
    data_programada: '2026-11-04',
    horario: '06:00:00',
    status: 'ENCERRADO',
    data_realizada: '2026-11-04',
    observacao: '',
    pcm_chave: 'pcm-4508-1',
    pcm_os: 'OS-1',
    pcm_grupo_id: 'g1',
    pcm_grupo_nome: 'Caminhões Muck',
    pcm_status: 'ENCERRADO',
    ...overrides,
  };
}

async function main() {
  const mock = createSupabaseMock();
  globalThis.__pcmHistorySupabase = mock.supabase;
  const sheets = await loadBundled(path.join(ROOT, 'src/lib/sheetsService.ts'));
  const historyService = await loadBundled(path.join(ROOT, 'src/lib/pcmHistoryService.ts'));
  const order = await loadBundled(path.join(ROOT, 'src/lib/scheduleOrder.ts'));

  // PCM encerrado só expõe a execução quando o marcador de confirmação existe.
  const confirmed = sheets.mapRawToProgramacao(raw({ pcm_execucao_confirmada_em: '2026-11-04T12:00:00-03:00' }));
  assert.equal(confirmed.situacao, 'ENCERRADO');
  assert.equal(confirmed.dataRealizada, '2026-11-04');
  assert.equal(confirmed.execucaoConfirmadaEm, '2026-11-04T12:00:00-03:00');
  assert.equal(confirmed.pcmChave, 'pcm-4508-1');

  const detectedOnly = sheets.mapRawToProgramacao(raw());
  assert.equal(detectedOnly.dataRealizada, '', 'encerramento detectado não pode virar execução automaticamente');
  assert.equal(detectedOnly.execucaoConfirmadaEm, undefined);

  const archivedManual = sheets.mapRawToProgramacao(raw({
    id: 2,
    pcm_chave: null,
    pcm_os: null,
    pcm_status: null,
    status: 'ENCERRADO',
    data_realizada: '2026-11-03',
    pcm_manual_arquivado_em: '2026-11-04T07:20:00-03:00',
    pcm_manual_automatico_id: '77',
  }));
  assert.equal(archivedManual.origemRegistro, 'MANUAL');
  assert.equal(archivedManual.manualArquivadoEm, '2026-11-04T07:20:00-03:00');
  assert.equal(archivedManual.manualAutomaticoId, 77);
  assert.equal(archivedManual.dataRealizada, '2026-11-03');

  // Histórico é leitura explícita e o RPC de confirmação recebe o contrato exato.
  mock.state.rpcResponse = { data: [raw({ id: 3, pcm_execucao_confirmada_em: '2026-11-04T13:00:00-03:00' })], error: null };
  const history = await historyService.fetchPcmHistory();
  assert.equal(history.length, 1);
  assert.equal(history[0].dataRealizada, '2026-11-04');
  assert.deepEqual(mock.state.rpcCalls.at(-1), { name: 'carregar_pcm_historico', args: undefined });

  mock.state.rpcResponse = { data: { ok: true }, error: null };
  await historyService.registerPcmExecution('pcm-4508-1', '2026-11-03', 'Executado no turno da manhã');
  assert.deepEqual(mock.state.rpcCalls.at(-1), {
    name: 'registrar_execucao_pcm',
    args: { p_chave: 'pcm-4508-1', p_data: '2026-11-03', p_observacao: 'Executado no turno da manhã' },
  });
  await assert.rejects(() => historyService.registerPcmExecution('pcm-4508-1', '03/11/2026', ''), /data de execução válida/i);

  // Data antiga, hoje às 06:00 e futura em ordem; inválidas no fim.
  const schedules = [
    { id: 'future', frota: '1000', numeroOS: 'OS-9', dataProgramada: '2026-11-05', horarioAgendado: '06:00' },
    { id: 'bad', frota: '0001', numeroOS: 'OS-0', dataProgramada: 'não-é-data', horarioAgendado: '00:00' },
    { id: 'today-late', frota: '1000', numeroOS: 'OS-3', dataProgramada: '2026-11-04', horarioAgendado: '08:00' },
    { id: 'today-early', frota: '1000', numeroOS: 'OS-2', dataProgramada: '2026-11-04', horarioAgendado: '06:00' },
    { id: 'old', frota: '9999', numeroOS: 'OS-1', dataProgramada: '2026-11-03', horarioAgendado: '23:00' },
    { id: 'same-fleet-os-1', frota: '1000', numeroOS: 'OS-1', dataProgramada: '2026-11-04', horarioAgendado: '06:00' },
  ].map(item => ({ ...item, descricaoPonto: 'LAVADOR', tipoPreventiva: 'Lavagem / Lubrificação', situacao: 'PROGRAMADO' }));
  const sorted = order.sortSchedules(schedules);
  assert.deepEqual(sorted.map(item => item.id), [
    'old',
    'same-fleet-os-1',
    'today-early',
    'today-late',
    'future',
    'bad',
  ]);
  assert.equal(order.compareScheduleDates(sorted[0], sorted[1]) < 0, true);

  console.log('OK: mapper PCM confirmado/detectado/arquivado, RPCs de histórico e ordenação cronológica estável verificados.');
}

main().catch((error) => {
  console.error(`FAIL: ${error.stack || error.message}`);
  process.exitCode = 1;
});
