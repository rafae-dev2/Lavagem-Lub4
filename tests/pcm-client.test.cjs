const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { build } = require('esbuild');

const ROOT = path.resolve(__dirname, '..');
const TMP = path.join('/tmp', `pcm-client-tests-${process.pid}`);
fs.mkdirSync(TMP, { recursive: true });

function createSupabaseMock() {
  const state = {
    rpcCalls: [],
    fromCalls: [],
    selects: [],
    inserts: [],
    updates: [],
    deletes: [],
    rpcResponse: { data: [], error: null },
    rows: [],
    legacyPages: [],
    lookupError: null,
    fromError: null,
    nextId: 9000,
    channelCalls: 0,
  };

  function resultFor(builder) {
    if (builder.op === 'select') {
      if (state.fromError) return { data: null, error: state.fromError };
      if (builder.rangeValue) {
        const [start, end] = builder.rangeValue;
        const page = state.legacyPages.length
          ? (state.legacyPages[builder.rangeOffsetIndex || 0] || [])
          : state.rows.slice(start, end + 1);
        return { data: page, error: null };
      }
      return { data: state.rows, error: null };
    }
    if (builder.op === 'update') {
      if (state.fromError) return { data: null, error: state.fromError };
      return { data: null, error: null };
    }
    if (builder.op === 'delete') {
      if (state.fromError) return { data: null, error: state.fromError };
      return { data: null, error: null };
    }
    return { data: null, error: null };
  }

  function makeBuilder(table) {
    const builder = {
      table,
      op: null,
      eqValue: undefined,
      rangeValue: null,
      rangeOffsetIndex: 0,
      select(columns, options) {
        state.selects.push({ table, columns, options });
        this.op = 'select';
        return this;
      },
      order() { return this; },
      range(start, end) {
        this.rangeValue = [start, end];
        this.rangeOffsetIndex = Math.floor(start / 1000);
        return this;
      },
      eq(_column, value) {
        this.eqValue = value;
        return this;
      },
      maybeSingle: async function maybeSingle() {
        state.selects.push({ table, columns: 'pcm_chave', maybeSingle: true, id: this.eqValue });
        if (state.lookupError) return { data: null, error: state.lookupError };
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
      then(resolve, reject) {
        return Promise.resolve(resultFor(this)).then(resolve, reject);
      },
    };
    return builder;
  }

  const supabase = {
    rpc: async name => {
      state.rpcCalls.push(name);
      return state.rpcResponse;
    },
    from(table) {
      state.fromCalls.push(table);
      return makeBuilder(table);
    },
    channel() {
      state.channelCalls += 1;
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
    name: 'pcm-supabase-mock',
    setup(build) {
      build.onResolve({ filter: /supabaseClient$/ }, () => ({ path: 'pcm-supabase', namespace: 'pcm-supabase' }));
      build.onLoad({ filter: /.*/, namespace: 'pcm-supabase' }, () => ({
        loader: 'js',
        contents: `
          export const supabase = globalThis.__pcmMockSupabase;
          export const LAVAGEM_TABLE = 'lavagem_lubrificacao';
          export const SUPABASE_URL = 'https://mock.supabase.local';
        `,
      }));
    },
  };
}

function reactPlugin() {
  return {
    name: 'pcm-react-hook-runner',
    setup(build) {
      build.onResolve({ filter: /^react$/ }, () => ({ path: 'pcm-react', namespace: 'pcm-react' }));
      build.onLoad({ filter: /.*/, namespace: 'pcm-react' }, () => ({
        loader: 'js',
        contents: `
          export const useState = (...args) => globalThis.__pcmReact.useState(...args);
          export const useEffect = (...args) => globalThis.__pcmReact.useEffect(...args);
          export const useCallback = (...args) => globalThis.__pcmReact.useCallback(...args);
          export const useRef = (...args) => globalThis.__pcmReact.useRef(...args);
        `,
      }));
    },
  };
}

function nanoidPlugin() {
  return {
    name: 'pcm-nanoid-mock',
    setup(build) {
      build.onResolve({ filter: /^nanoid$/ }, () => ({ path: 'pcm-nanoid', namespace: 'pcm-nanoid' }));
      build.onLoad({ filter: /.*/, namespace: 'pcm-nanoid' }, () => ({
        loader: 'js',
        contents: "export const nanoid = () => 'pcm-test-id';",
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

function pad(value) {
  return String(value).padStart(2, '0');
}

function localISO(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function baseDbRow(overrides = {}) {
  return {
    id: 1,
    frota: '4508',
    local: 'LAVADOR',
    tipo: 'Lavagem / Lubrificação',
    data_programada: '2026-11-01',
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
  let cursor = 0;
  let output;
  let dirty = false;

  const runtime = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
      const setter = value => {
        slots[index] = typeof value === 'function' ? value(slots[index]) : value;
        dirty = true;
      };
      return [slots[index], setter];
    },
    useRef(initial) {
      const index = cursor++;
      if (!(index in refs)) refs[index] = { current: initial };
      return refs[index];
    },
    useCallback(fn) {
      cursor += 1;
      return fn;
    },
    useEffect(effect) {
      cursor += 1;
      effect();
    },
  };

  globalThis.__pcmReact = runtime;
  function render() {
    cursor = 0;
    dirty = false;
    output = hook();
    return output;
  }
  render();
  return {
    get current() { return output; },
    render,
    get dirty() { return dirty; },
  };
}

async function main() {
  const mock = createSupabaseMock();
  globalThis.__pcmMockSupabase = mock.supabase;
  installLocalStorage();

  const service = await loadBundled(path.join(ROOT, 'src/lib/sheetsService.ts'), [supabasePlugin()]);
  const {
    fetchSchedules,
    appendRowToSheet,
    updateRowInSheet,
    deleteRowFromSheet,
    parseCsvToSchedules,
  } = service;

  // 1) Mapeamento dos três registros PCM reais informados no caso de teste.
  mock.state.rpcResponse = {
    data: [
      baseDbRow({ id: 101, frota: '4508', data_programada: '2026-11-01', tipo: 'Lavagem / Lubrificação', pcm_chave: '4508-01-lavagem', pcm_os: '4508', pcm_status: 'PROGRAMADA', pcm_apoio_id: undefined }),
      baseDbRow({ id: 102, frota: '4508', data_programada: '2026-11-04', tipo: 'Troca de Óleo', pcm_chave: '4508-04-oleo', pcm_os: '4508', pcm_status: 'PROGRAMADA' }),
      baseDbRow({ id: 103, frota: '4588', data_programada: '2026-11-04', tipo: 'Lavagem / Lubrificação', pcm_chave: '4588-04-lavagem', pcm_os: '4588', pcm_status: 'PROGRAMADA' }),
    ],
    error: null,
  };
  let schedules = await fetchSchedules();
  assert.equal(schedules.length, 3);
  assert.deepEqual(
    schedules.map(row => [row.frota, row.tipoPreventiva, row.dataProgramada]),
    [
      ['4508', 'Lavagem / Lubrificação', '2026-11-01'],
      ['4508', 'Troca de Óleo', '2026-11-04'],
      ['4588', 'Lavagem / Lubrificação', '2026-11-04'],
    ],
    'As três OS PCM devem manter frota, tipo e data programada',
  );
  assert.equal(schedules[0].origemRegistro, 'PCM');
  assert.equal(schedules[0].numeroOS, '4508');
  assert.equal(schedules[0].horarioAgendado, '08:30');
  assert.equal(schedules[0].statusPCM, 'PROGRAMADA');

  // 2) RPC não pode truncar snapshots acima da página legada de 1000 linhas.
  mock.state.rpcResponse = {
    data: Array.from({ length: 1001 }, (_, index) => baseDbRow({
      id: index + 1,
      frota: `F-${index + 1}`,
      data_programada: '2026-11-04',
      pcm_chave: `key-${index + 1}`,
    })),
    error: null,
  };
  schedules = await fetchSchedules();
  assert.equal(schedules.length, 1001, 'RPC deve devolver todos os 1001 registros, sem range/truncamento');
  assert.equal(schedules.at(-1).frota, 'F-1001');

  // 3) Erro de execução/permissão do RPC não é "função ausente" e não deve mascarar a causa com fallback.
  mock.state.fromCalls.length = 0;
  mock.state.rpcResponse = { data: null, error: { code: '42501', message: 'permission denied for function carregar_lavagem_programacoes' } };
  await assert.rejects(
    () => fetchSchedules(),
    /Supabase: permission denied for function carregar_lavagem_programacoes/,
    'Erro não relacionado a função ausente deve propagar sem consultar a tabela legada',
  );
  assert.equal(mock.state.fromCalls.length, 0);

  // 4) Só o erro explícito de RPC ausente pode acionar o fallback legado paginado.
  mock.state.rpcResponse = { data: null, error: { code: 'PGRST202', message: 'Could not find the function public.carregar_lavagem_programacoes' } };
  mock.state.rows = [baseDbRow({ id: 201, frota: 'MANUAL-1', pcm_chave: null, data_realizada: '2026-11-03', status: 'ENCERRADO' })];
  mock.state.fromCalls.length = 0;
  schedules = await fetchSchedules();
  assert.equal(schedules.length, 1);
  assert.equal(mock.state.fromCalls.length, 1);
  assert.equal(schedules[0].origemRegistro, 'MANUAL');
  assert.equal(schedules[0].dataRealizada, '2026-11-03');
  assert.equal(schedules[0].dataProgramada, '2026-11-01');

  // 5) ENCERRADO PCM: dataRealizada fica vazia; rastreabilidade oficial fica separada.
  mock.state.rpcResponse = {
    data: [baseDbRow({
      id: 301,
      frota: '4508',
      data_programada: '2026-11-04',
      data_realizada: '2026-11-04',
      status: 'ENCERRADO',
      pcm_chave: '4508-04-oleo',
      pcm_status: 'ENCERRADO',
      pcm_encerrado_em: '2026-11-04T10:00:00-03:00',
      pcm_motivo_encerramento: 'Fechado no PCM',
    })],
    error: null,
  };
  schedules = await fetchSchedules();
  assert.equal(schedules[0].situacao, 'ENCERRADO');
  assert.equal(schedules[0].dataRealizada, '', 'PCM encerrado não deve parecer execução manual');
  assert.equal(schedules[0].encerradoDetectadoEm, '2026-11-04T10:00:00-03:00');
  assert.equal(schedules[0].motivoEncerramento, 'Fechado no PCM');

  // 6) Status PROGRAMADO atrasado pela data passada deve virar ATRASADO.
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  mock.state.rpcResponse = {
    data: [baseDbRow({
      id: 302,
      frota: 'ATRASADA',
      data_programada: localISO(yesterday),
      status: 'PROGRAMADO',
      pcm_chave: 'atrasada',
    })],
    error: null,
  };
  schedules = await fetchSchedules();
  assert.equal(schedules[0].situacao, 'ATRASADO');

  // 7) Contrato CSV manual continua funcionando, inclusive com campos legados.
  const csv = [
    'FROTA,LOCAL,TIPO,DATA PROGRAMADA,DATA REALIZADA,STATUS,HORARIO,OBSERVAÇÃO',
    'M-01,LAVADOR,Lavagem / Lubrificação,01/11/2026,02/11/2026,ENCERRADO,08:00,Manual',
  ].join('\n');
  const csvRows = parseCsvToSchedules(csv);
  assert.deepEqual(csvRows[0], {
    id: 'csv-2',
    frota: 'M-01',
    descricaoPonto: 'LAVADOR',
    tipoPreventiva: 'Lavagem / Lubrificação',
    dataProgramada: '2026-11-01',
    dataRealizada: '2026-11-02',
    situacao: 'ENCERRADO',
    horarioAgendado: '08:00',
    observacao: 'Manual',
  });

  // 8) Guards no serviço: PCM não atualiza/exclui; CRUD manual continua gravando.
  mock.state.rpcResponse = { data: [], error: null };
  mock.state.rows = [
    baseDbRow({ id: 401, frota: 'PCM-1', pcm_chave: 'pcm-401' }),
    baseDbRow({ id: 402, frota: 'MAN-1', pcm_chave: null }),
  ];
  mock.state.updates.length = 0;
  mock.state.deletes.length = 0;
  const pcmProgramacao = {
    id: 'sb-401', frota: 'PCM-1', descricaoPonto: 'LAVADOR', tipoPreventiva: 'Lavagem / Lubrificação',
    dataProgramada: '2026-11-04', dataRealizada: '', situacao: 'PROGRAMADO', horarioAgendado: '08:00', observacao: '',
    rowIndex: 401, origemRegistro: 'PCM',
  };
  const manualProgramacao = {
    ...pcmProgramacao,
    id: 'sb-402', frota: 'MAN-1', rowIndex: 402, origemRegistro: 'MANUAL',
  };
  let result = await updateRowInSheet(401, pcmProgramacao);
  assert.equal(result.success, false);
  assert.match(result.error, /somente leitura/i);
  assert.equal(mock.state.updates.length, 0);
  result = await deleteRowFromSheet(401);
  assert.equal(result.success, false);
  assert.match(result.error, /somente leitura/i);
  assert.equal(mock.state.deletes.length, 0);
  result = await updateRowInSheet(402, manualProgramacao);
  assert.equal(result.success, true);
  assert.equal(mock.state.updates.length, 1);
  result = await deleteRowFromSheet(402);
  assert.equal(result.success, true);
  assert.equal(mock.state.deletes.length, 1);
  result = await appendRowToSheet(manualProgramacao);
  assert.equal(result.success, true);
  assert.equal(mock.state.inserts.length, 1);

  // 9) Guard do serviço também respeita a origem PCM recebida pelo cliente mesmo se a linha lookup vier sem chave.
  mock.state.rows = [baseDbRow({ id: 403, frota: 'SEM-CHAVE', pcm_chave: null })];
  result = await updateRowInSheet(403, { ...manualProgramacao, rowIndex: 403, origemRegistro: 'PCM' });
  assert.equal(result.success, false);
  assert.match(result.error, /somente leitura/i);
  assert.equal(mock.state.updates.length, 1, 'A tentativa PCM não pode acrescentar update');

  // 10) Hook: PCM é somente leitura antes da atualização otimista; manual ainda chama CRUD.
  const hookModule = await loadBundled(path.join(ROOT, 'src/hooks/useSchedules.ts'), [supabasePlugin(), reactPlugin(), nanoidPlugin()]);
  const pcmItem = {
    id: 'sb-501', frota: 'PCM-HOOK', descricaoPonto: 'LAVADOR', tipoPreventiva: 'Lavagem / Lubrificação',
    dataProgramada: '2026-11-04', dataRealizada: '', situacao: 'PROGRAMADO', horarioAgendado: '08:00', observacao: '',
    rowIndex: 501, origemRegistro: 'PCM',
  };
  const manualItem = { ...pcmItem, id: 'sb-502', frota: 'MAN-HOOK', rowIndex: 502, origemRegistro: 'MANUAL' };
  const cache = JSON.stringify([pcmItem, manualItem]);
  installLocalStorage({
    bp_schedules_cache_v4: cache,
    bp_schedules_cache_meta_v4: JSON.stringify({ timestamp: Date.now(), count: 2 }),
  });
  mock.state.rows = [baseDbRow({ id: 501, frota: 'PCM-HOOK', pcm_chave: 'pcm-hook' }), baseDbRow({ id: 502, frota: 'MAN-HOOK', pcm_chave: null })];
  mock.state.updates.length = 0;
  mock.state.deletes.length = 0;
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
    assert.equal(runner.current.schedules.length, 2);
    const before = JSON.stringify(runner.current.schedules);
    result = await runner.current.updateSchedule('sb-501', { situacao: 'ENCERRADO' });
    assert.match(result.sheetError, /somente leitura/i);
    assert.equal(mock.state.updates.length, 0);
    assert.equal(JSON.stringify(runner.current.schedules), before, 'PCM não pode sofrer atualização otimista');
    result = await runner.current.deleteSchedule('sb-501');
    assert.match(result.sheetError, /somente leitura/i);
    assert.equal(mock.state.deletes.length, 0);
    result = await runner.current.updateSchedule('sb-502', { situacao: 'ANDAMENTO' });
    assert.equal(result.sheetError, undefined);
    assert.equal(mock.state.updates.length, 1, 'Manual deve continuar passando pelo CRUD do hook');
  } finally {
    global.setTimeout = oldSetTimeout;
    global.setInterval = oldSetInterval;
    global.clearTimeout = oldClearTimeout;
    global.clearInterval = oldClearInterval;
  }

  // 11) Contratos de integração visual: badge PCM e ausência das ações na linha PCM.
  const programacoesSource = fs.readFileSync(path.join(ROOT, 'src/pages/Programacoes.tsx'), 'utf8');
  assert.match(programacoesSource, /\{!isPcmSchedule\(s\) && <div className="flex items-center justify-end/);
  assert.match(programacoesSource, /\{isPcmSchedule\(s\) \? 'PCM' : 'MANUAL'\}/);
  assert.match(programacoesSource, /if \(isPcmSchedule\(s\)\)/);

  console.log('OK: PCM client mapping/RPC/CRUD/hook guards, manual contract and Programacoes read-only UI verified.');
}

main().catch(error => {
  console.error(`FAIL: ${error.stack || error.message}`);
  process.exitCode = 1;
});
