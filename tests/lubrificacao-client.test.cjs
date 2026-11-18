const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { build } = require('esbuild');

const ROOT = path.resolve(__dirname, '..');
const TMP = path.join('/tmp', `lubrificacao-client-tests-${process.pid}`);
fs.mkdirSync(TMP, { recursive: true });

function createSupabaseMock() {
  const state = {
    rpcCalls: [],
    fromCalls: [],
    selects: [],
    inserts: [],
    updates: [],
    deletes: [],
    rows: [],
    rpcHandler: null,
    rpcResponse: { data: [], error: null },
    fromError: null,
    nextId: 9000,
  };

  function resultFor(builder) {
    if (builder.op === 'select') {
      if (state.fromError) return { data: null, error: state.fromError };
      if (builder.rangeValue) {
        const [start, end] = builder.rangeValue;
        return { data: state.rows.slice(start, end + 1), error: null };
      }
      return { data: state.rows, error: null };
    }
    if (builder.op === 'update' || builder.op === 'delete') {
      return { data: null, error: state.fromError };
    }
    return { data: null, error: null };
  }

  function makeBuilder(table) {
    const builder = {
      table,
      op: null,
      eqValue: undefined,
      rangeValue: null,
      select(columns, options) {
        state.selects.push({ table, columns, options });
        this.op = 'select';
        return this;
      },
      order() { return this; },
      range(start, end) {
        this.rangeValue = [start, end];
        return this;
      },
      eq(_column, value) {
        this.eqValue = value;
        return this;
      },
      maybeSingle: async function maybeSingle() {
        state.selects.push({ table, columns: 'pcm_chave', maybeSingle: true, id: this.eqValue });
        if (state.fromError) return { data: null, error: state.fromError };
        const row = state.rows.find(item => Number(item.id) === Number(this.eqValue));
        return { data: row ? { pcm_chave: row.pcm_chave } : null, error: null };
      },
      insert(payload) {
        this.op = 'insert';
        state.inserts.push({ table, payload });
        return this;
      },
      update(payload) {
        this.op = 'update';
        state.updates.push({ table, payload, id: this.eqValue });
        return this;
      },
      delete() {
        this.op = 'delete';
        state.deletes.push({ table, id: this.eqValue });
        return this;
      },
      single: async function single() {
        if (state.fromError) return { data: null, error: state.fromError };
        return { data: { id: state.nextId++ }, error: null };
      },
      abortSignal() { return this; },
      then(resolve, reject) {
        return Promise.resolve(resultFor(this)).then(resolve, reject);
      },
    };
    return builder;
  }

  const supabase = {
    rpc: (name, args) => {
      state.rpcCalls.push({ name, args });
      const query = {
        abortSignal() { return query; },
        then(resolve, reject) {
          const res = state.rpcHandler ? state.rpcHandler(name, args) : state.rpcResponse;
          return Promise.resolve(res).then(resolve, reject);
        },
      };
      return query;
    },
    from(table) {
      state.fromCalls.push(table);
      return makeBuilder(table);
    },
    channel() {
      const channel = {
        on() { return channel; },
        subscribe(callback) {
          if (callback) callback('SUBSCRIBED');
          return channel;
        },
      };
      return channel;
    },
    removeChannel() {},
  };

  return { state, supabase };
}

function supabasePlugin() {
  return {
    name: 'lubrificacao-supabase-mock',
    setup(esbuild) {
      esbuild.onResolve({ filter: /supabaseClient$/ }, () => ({ path: 'lubrificacao-supabase', namespace: 'lubrificacao-supabase' }));
      esbuild.onLoad({ filter: /.*/, namespace: 'lubrificacao-supabase' }, () => ({
        loader: 'js',
        contents: `
          export const supabase = globalThis.__lubrificacaoSupabase;
          export const LAVAGEM_TABLE = 'lavagem_lubrificacao';
          export const SUPABASE_URL = 'https://mock.supabase.local';
        `,
      }));
    },
  };
}

function reactPlugin() {
  return {
    name: 'lubrificacao-react-hook-mock',
    setup(esbuild) {
      esbuild.onResolve({ filter: /^react$/ }, () => ({ path: 'lubrificacao-react', namespace: 'lubrificacao-react' }));
      esbuild.onLoad({ filter: /.*/, namespace: 'lubrificacao-react' }, () => ({
        loader: 'js',
        contents: `
          export const useState = (...args) => globalThis.__lubrificacaoReact.useState(...args);
          export const useEffect = (...args) => globalThis.__lubrificacaoReact.useEffect(...args);
          export const useCallback = (...args) => globalThis.__lubrificacaoReact.useCallback(...args);
          export const useRef = (...args) => globalThis.__lubrificacaoReact.useRef(...args);
        `,
      }));
    },
  };
}

function nanoidPlugin() {
  return {
    name: 'lubrificacao-nanoid-mock',
    setup(esbuild) {
      esbuild.onResolve({ filter: /^nanoid$/ }, () => ({ path: 'lubrificacao-nanoid', namespace: 'lubrificacao-nanoid' }));
      esbuild.onLoad({ filter: /.*/, namespace: 'lubrificacao-nanoid' }, () => ({
        loader: 'js',
        contents: "export const nanoid = () => 'lubrificacao-test-id';",
      }));
    },
  };
}

async function loadBundled(entryPoint, plugins) {
  const outfile = path.join(TMP, `${path.basename(entryPoint).replace(/[^a-z0-9]/gi, '_')}-${Math.random().toString(16).slice(2)}.cjs`);
  await build({
    entryPoints: [entryPoint],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node18',
    plugins,
    outfile,
    logLevel: 'silent',
  });
  delete require.cache[require.resolve(outfile)];
  return require(outfile);
}

function baseDbRow(overrides = {}) {
  return {
    id: 1,
    frota: '4508',
    local: 'LAVADOR',
    tipo: 'Lavagem / Lubrificação',
    data_programada: '2026-11-04',
    horario: '08:30:00',
    status: 'PROGRAMADO',
    data_realizada: null,
    observacao: '',
    ...overrides,
  };
}

function installLocalStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  global.localStorage = {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
    clear: () => values.clear(),
  };
  return values;
}

function createHookRunner(hook) {
  const slots = [];
  const refs = [];
  const effects = new Map();
  const callbacks = new Map();
  let pendingEffects = [];
  const sameDeps = (a, b) => a && b && a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
  let cursor = 0;
  let output;

  const runtime = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
      const setter = value => {
        slots[index] = typeof value === 'function' ? value(slots[index]) : value;
      };
      return [slots[index], setter];
    },
    useRef(initial) {
      const index = cursor++;
      if (!(index in refs)) refs[index] = { current: initial };
      return refs[index];
    },
    useCallback(fn, deps) {
      const index = cursor++;
      const previous = callbacks.get(index);
      if (previous && sameDeps(previous.deps, deps)) return previous.fn;
      callbacks.set(index, { fn, deps });
      return fn;
    },
    useEffect(effect, deps) {
      const index = cursor++;
      const previous = effects.get(index);
      if (!previous || !sameDeps(previous.deps, deps)) {
        pendingEffects.push(() => {
          previous?.cleanup?.();
          effects.set(index, { deps, cleanup: effect() });
        });
      }
    },
  };

  globalThis.__lubrificacaoReact = runtime;
  function render() {
    cursor = 0;
    output = hook();
    const queued = pendingEffects; pendingEffects = [];
    queued.forEach(effect => effect());
    return output;
  }
  render();
  return {
    get current() { return output; },
    render,
  };
}

function pcmProgramacao(overrides = {}) {
  return {
    id: 'sb-700',
    frota: 'PCM-700',
    descricaoPonto: 'LAVADOR',
    tipoPreventiva: 'Lavagem / Lubrificação',
    dataProgramada: '2026-11-04',
    dataRealizada: '',
    situacao: 'PROGRAMADO',
    horarioAgendado: '08:00',
    observacao: '',
    rowIndex: 700,
    origemRegistro: 'PCM',
    pcmChave: 'pcm-700',
    numeroOS: 'OS 700',
    ...overrides,
  };
}

async function main() {
  const presentation = await loadBundled(path.join(ROOT, 'src/lib/schedulePresentation.ts'), []);
  const {
    cleanScheduleObservation,
    effectiveScheduleCompletionDate,
    getScheduleCompletionSource,
  } = presentation;

  // A técnica some em qualquer posição, mas a confirmação e outras notas ficam.
  const historyObservation = {
    ...pcmProgramacao({
      observacao: 'OS 1 | encerrada por ausência em 2026-11-04 10:00 | Execução confirmada: revisado',
    }),
  };
  assert.equal(cleanScheduleObservation(historyObservation), 'OS 1 | Execução confirmada: revisado');
  assert.equal(cleanScheduleObservation({ ...historyObservation, observacao: 'OS 1 | encerrada por ausência em 2026-11-04 10:00' }), '');
  assert.equal(cleanScheduleObservation({ ...historyObservation, observacao: 'Texto operacional | outra nota' }), 'Texto operacional | outra nota');
  assert.equal(historyObservation.observacao, 'OS 1 | encerrada por ausência em 2026-11-04 10:00 | Execução confirmada: revisado');

  const timestampCompletion = pcmProgramacao({
    situacao: 'ENCERRADO',
    encerradoDetectadoEm: '2026-11-05T02:30:00Z',
    motivoEncerramento: 'Ausente no snapshot Apoio',
  });
  assert.equal(effectiveScheduleCompletionDate(timestampCompletion), '2026-11-04', 'UTC perto da meia-noite deve virar o dia civil de SP');
  assert.equal(getScheduleCompletionSource(timestampCompletion), 'PCM');
  assert.equal(effectiveScheduleCompletionDate({ ...timestampCompletion, motivoEncerramento: 'Encerrado manualmente' }), '', 'encerramento manual não infere data de desaparecimento');
  assert.equal(effectiveScheduleCompletionDate({ ...timestampCompletion, dataRealizada: '2026-11-03' }), '2026-11-03');
  assert.equal(effectiveScheduleCompletionDate({
    ...timestampCompletion,
    dataRealizada: '2026-11-03',
    pcmEdicaoCampos: { data_realizada: null },
  }), '', 'limpeza explícita deve vencer o fallback PCM');
  assert.equal(effectiveScheduleCompletionDate({ ...timestampCompletion, situacao: 'ANDAMENTO' }), '');

  const mock = createSupabaseMock();
  globalThis.__lubrificacaoSupabase = mock.supabase;
  const service = await loadBundled(path.join(ROOT, 'src/lib/sheetsService.ts'), [supabasePlugin()]);

  const rawHistory = baseDbRow({
    id: 701,
    frota: 'PCM-701',
    status: 'ENCERRADO',
    data_realizada: null,
    pcm_chave: 'pcm-701',
    pcm_status: 'ENCERRADO',
    pcm_encerrado_em: '2026-11-05T02:30:00Z',
    pcm_motivo_encerramento: 'Ausente no snapshot Apoio',
    observacao: 'OS 701 | encerrada por ausência em 2026-11-04 10:00 | Execução confirmada: revisado',
  });
  const rawExplicitClear = baseDbRow({
    id: 702,
    frota: 'PCM-702',
    status: 'ENCERRADO',
    data_realizada: '2026-11-03',
    pcm_chave: 'pcm-702',
    pcm_status: 'ENCERRADO',
    pcm_encerrado_em: '2026-11-05T02:30:00Z',
    pcm_motivo_encerramento: 'Ausente no snapshot Apoio',
    pcm_edicao_campos: { data_realizada: null },
  });
  const rawActive = baseDbRow({
    id: 703,
    frota: 'PCM-703',
    status: 'ANDAMENTO',
    data_realizada: '2026-11-03',
    pcm_chave: 'pcm-703',
    pcm_status: 'ANDAMENTO',
    pcm_encerrado_em: null,
  });
  const rawManual = baseDbRow({
    id: 704,
    frota: 'MAN-704',
    status: 'ENCERRADO',
    data_realizada: '2026-11-03',
    observacao: 'Manual concluído',
  });
  mock.state.rpcHandler = (name) => name === 'carregar_lavagem_programacoes'
    ? { data: [rawHistory, rawExplicitClear, rawActive, rawManual], error: null }
    : { data: [], error: null };
  let schedules = await service.fetchSchedules();
  assert.equal(schedules[0].dataRealizada, '2026-11-04');
  assert.equal(schedules[0].dataRealizadaOrigem, 'PCM');
  assert.equal(schedules[0].observacao, 'OS 701 | Execução confirmada: revisado');
  assert.equal(schedules[1].dataRealizada, '');
  assert.equal(schedules[2].dataRealizada, '');
  assert.equal(schedules[3].dataRealizada, '2026-11-03');
  assert.equal(schedules[3].dataRealizadaOrigem, 'MANUAL');
  assert.equal(schedules[0].pcmEditadoEm, undefined);

  // AbortError (ex.: StrictMode unmount ou cancelamento de leitura) não deve poluir console.error.
  const loggedErrors = [];
  const origConsoleError = console.error;
  console.error = (...args) => loggedErrors.push(args.join(' '));
  try {
    mock.state.rpcHandler = (name) => name === 'carregar_lavagem_programacoes'
      ? { data: null, error: { code: '20', message: 'AbortError: signal is aborted without reason' } }
      : { data: [], error: null };
    const abortController = new AbortController();
    await assert.rejects(
      () => service.fetchSchedules({ fresh: true, signal: abortController.signal }),
      (err) => err && err.name === 'AbortError',
    );
    assert.equal(
      loggedErrors.some((line) => line.includes('Erro no RPC de programações')),
      false,
      'AbortError não deve registrar console.error de falha no RPC',
    );
  } finally {
    console.error = origConsoleError;
  }

  const pcm = {
    ...schedules[0],
    dataRealizada: '',
    situacao: 'PROGRAMADO',
  };
  mock.state.rpcHandler = (name, args) => name === 'editar_programacao_pcm'
    ? { data: { ok: true, row: rawHistory }, error: null }
    : { data: [], error: null };
  const rpcBefore = mock.state.rpcCalls.length;
  let result = await service.updateRowInSheet(701, pcm, {
    situacao: 'ENCERRADO',
    observacao: 'Editado pelo usuário',
    frota: 'NÃO ENVIAR',
    pcmChave: 'NÃO ENVIAR',
  });
  assert.equal(result.success, true);
  const editCall = mock.state.rpcCalls.slice(rpcBefore).find(call => call.name === 'editar_programacao_pcm');
  assert.deepEqual(editCall.args, {
    p_id: 701,
    p_campos: { status: 'ENCERRADO', observacao: 'Editado pelo usuário' },
  });
  assert.equal(Object.hasOwn(editCall.args.p_campos, 'frota'), false);
  assert.equal(Object.hasOwn(editCall.args.p_campos, 'pcm_chave'), false);

  mock.state.rpcHandler = name => name === 'editar_programacao_pcm'
    ? { data: null, error: { code: 'PGRST202', message: 'Could not find function public.editar_programacao_pcm' } }
    : { data: [], error: null };
  result = await service.updateRowInSheet(701, pcm, { observacao: 'Falha' });
  assert.equal(result.success, false);
  assert.match(result.error, /instale supabase\/PCM_EDICAO_PREMIUM\.sql/i);
  mock.state.rows = [rawHistory];
  const deletesBefore = mock.state.deletes.length;
  result = await service.deleteRowFromSheet(701);
  assert.equal(result.success, false);
  assert.equal(mock.state.deletes.length, deletesBefore);
  result = await service.appendRowToSheet(pcm);
  assert.equal(result.success, false);
  assert.match(result.error, /não podem ser inseridos/i);

  // Hook: somente o diff editável chega à RPC; identidade PCM e metadados ficam intactos.
  const hookModule = await loadBundled(path.join(ROOT, 'src/hooks/useSchedules.ts'), [supabasePlugin(), reactPlugin(), nanoidPlugin()]);
  const hookItem = pcmProgramacao();
  const manualHookItem = { ...pcmProgramacao({ id: 'sb-800', rowIndex: 800, frota: 'MAN-800', origemRegistro: 'MANUAL' }), pcmChave: undefined, numeroOS: undefined };
  const cacheValues = installLocalStorage({
    bp_schedules_cache_v5: JSON.stringify([hookItem, manualHookItem]),
    bp_schedules_cache_meta_v5: JSON.stringify({ timestamp: Date.now(), count: 1 }),
    bp_schedules_cache_v4: JSON.stringify([{ id: 'stale-v4' }]),
    bp_schedules_cache_meta_v4: JSON.stringify({ timestamp: Date.now(), count: 1 }),
  });
  assert.equal(cacheValues.has('bp_schedules_cache_v4'), true, 'fixture v4 instalado antes do hook');
  mock.state.rpcHandler = (name) => name === 'carregar_lavagem_programacoes'
    ? { data: [baseDbRow({ id: 700, frota: 'PCM-700', pcm_chave: 'pcm-700', pcm_os: 'OS 700', horario: '08:00' }), baseDbRow({ id: 800, frota: 'MAN-800', horario: '08:00' })], error: null }
    : { data: { ok: true, row: baseDbRow({ id: 700, frota: 'PCM-700', pcm_chave: 'pcm-700', pcm_os: 'OS 700', horario: '08:00' }) }, error: null };
  const oldSetTimeout = global.setTimeout;
  const oldSetInterval = global.setInterval;
  const oldClearTimeout = global.clearTimeout;
  const oldClearInterval = global.clearInterval;
  global.setTimeout = () => 1;
  global.setInterval = () => 1;
  global.clearTimeout = () => {};
  global.clearInterval = () => {};
  try {
    const runner = createHookRunner(hookModule.useSchedules);
    assert.equal(cacheValues.has('bp_schedules_cache_v4'), false, 'cache v4 deve ser invalidado');
    const callsBefore = mock.state.rpcCalls.length;
    result = await runner.current.updateSchedule('sb-700', {
      situacao: 'ENCERRADO',
      observacao: 'Editado pelo usuário',
      frota: 'IDENTIDADE ALTERADA',
      numeroOS: 'OS ALTERADA',
      pcmChave: 'CHAVE ALTERADA',
    });
    assert.equal(result.sheetError, undefined);
    const hookEdit = mock.state.rpcCalls.slice(callsBefore).find(call => call.name === 'editar_programacao_pcm');
    assert.deepEqual(hookEdit.args.p_campos, {
      status: 'ENCERRADO',
      observacao: 'Editado pelo usuário',
    });
    runner.render();
    assert.equal(runner.current.schedules[0].frota, 'PCM-700');

    const noOpCalls = mock.state.rpcCalls.length;
    result = await runner.current.updateSchedule('sb-700', {
      frota: 'NÃO ENVIAR',
      numeroOS: 'OS ANTIGA',
      pcmChave: 'PCM ANTIGO',
    });
    assert.equal(result.sheetError, undefined);
    assert.equal(mock.state.rpcCalls.length, noOpCalls, 'metadados antigos do formulário não geram update');

    const observationBeforeFailure = runner.current.schedules[0].observacao;
    mock.state.rpcHandler = name => name === 'editar_programacao_pcm'
      ? { data: null, error: { code: '08006', message: 'network unavailable' } }
      : { data: [rawHistory], error: null };
    result = await runner.current.updateSchedule('sb-700', { observacao: 'não salvar' });
    assert.match(result.sheetError, /network unavailable/i);
    runner.render();
    assert.equal(runner.current.schedules[0].observacao, observationBeforeFailure, 'falha RPC faz rollback');
    assert.notEqual(runner.current.schedules[0].observacao, 'não salvar');
    result = await runner.current.deleteSchedule('sb-700');
    assert.match(result.sheetError, /PCM.*exclusão/i);
    assert.equal(mock.state.deletes.length, 0);
    result = await runner.current.addSingleSchedule(hookItem);
    assert.equal(result.success, false);
    assert.match(result.sheetError, /não podem ser inseridos/i);
    result = await runner.current.updateSchedule('sb-800', { frota: 'MAN-EDITADA' });
    assert.equal(result.sheetError, undefined);
    assert.deepEqual(mock.state.updates.at(-1).payload, { frota: 'MAN-EDITADA' });
    runner.render();
    assert.equal(runner.current.schedules.find(item => item.id === 'sb-800').frota, 'MAN-EDITADA');
    result = await runner.current.updateSchedule('registro-inexistente', { situacao: 'ENCERRADO' });
    assert.match(result.sheetError, /indisponível.*sincronize/i);
  } finally {
    global.setTimeout = oldSetTimeout;
    global.setInterval = oldSetInterval;
    global.clearTimeout = oldClearTimeout;
    global.clearInterval = oldClearInterval;
  }

  console.log('OK: lubrificação PCM premium — presentation, mapper, whitelist RPC, cache v5, guards e rollback verificados.');
}

main().catch(error => {
  console.error(`FAIL: ${error.stack || error.message}`);
  process.exitCode = 1;
});
