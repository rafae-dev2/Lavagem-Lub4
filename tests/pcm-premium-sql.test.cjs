// PCM premium: testes locais, sem Supabase remoto.
// Se @electric-sql/pglite estiver instalado, os cenários SQL também rodam em
// PostgreSQL em memória; sem ele, as verificações estáticas continuam úteis.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const premiumPath = path.join(root, 'supabase', 'PCM_EDICAO_PREMIUM.sql');
const sql = fs.readFileSync(premiumPath, 'utf8');

function functionBody(source, name) {
  const marker = `function public.${name}`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `função ${name} não encontrada`);
  const bodyStart = source.indexOf('as $$', start);
  assert.notEqual(bodyStart, -1, `corpo ${name} não encontrado`);
  const bodyEnd = source.indexOf('$$;', bodyStart);
  assert.notEqual(bodyEnd, -1, `fim ${name} não encontrado`);
  return source.slice(bodyStart, bodyEnd);
}

function assertStaticContract() {
  assert.equal((sql.match(/\$\$/g) || []).length % 2, 0, 'dollar quotes SQL desbalanceadas');
  assert.match(sql, /add column if not exists pcm_edicao_campos jsonb not null default '\{\}'::jsonb/i);
  assert.match(sql, /add column if not exists pcm_editado_em timestamptz/i);
  assert.match(sql, /not \(coalesce\(pcm_edicao_campos, '\{\}'::jsonb\) \? 'data_realizada'\)/i);
  assert.match(sql, /at time zone 'America\/Sao_Paulo'\)::date/i);

  const rpc = functionBody(sql, 'editar_programacao_pcm');
  const rpcSignatureStart = sql.indexOf('create or replace function public.editar_programacao_pcm');
  const rpcSignatureEnd = sql.indexOf('as $$', rpcSignatureStart);
  const rpcDefinition = sql.slice(rpcSignatureStart, rpcSignatureEnd) + rpc;
  assert.match(rpcDefinition, /returns jsonb/i);
  assert.match(rpcDefinition, /security definer/i);
  assert.match(rpcDefinition, /set search_path = pg_catalog, public/i);
  assert.match(rpc, /pg_advisory_xact_lock\(pg_catalog\.hashtext\('apoio:sync:claim'\)\)/i);
  assert.ok(rpc.indexOf('pg_advisory_xact_lock') < rpc.indexOf('for update'), 'RPC deve travar sync antes da linha');
  assert.match(rpc, /'local', 'tipo', 'data_programada', 'horario', 'status'/i);
  assert.match(rpc, /'data_realizada', 'observacao'/i);
  assert.match(rpc, /campos de edição devem ser um objeto JSON/i);
  assert.match(rpc, /campo PCM não editável/i);
  assert.match(rpc, /'LAVADOR', 'CAMPO'/i);
  assert.match(rpc, /'Lavagem \/ Lubrificação', 'Lubrificação', 'Troca de Óleo'/i);
  assert.match(rpc, /'PENDENTE', 'PROGRAMADO', 'ATRASADO', 'ANDAMENTO', 'ENCERRADO'/i);
  assert.match(rpc, /YYYY-MM-DD/i);
  assert.match(rpc, /HH:MM/i);
  assert.match(rpc, /excede 1000 caracteres/i);
  assert.match(rpc, /'ok', true, 'row'/i);
  assert.doesNotMatch(rpc, /delete\s+from/i, 'RPC não pode liberar DELETE');
  assert.doesNotMatch(rpc, /set\s+frota\s*=|set\s+pcm_chave\s*=|set\s+pcm_os\s*=|set\s+pcm_grupo/i, 'RPC não pode editar identidade PCM');
  assert.doesNotMatch(rpc, /reconciliar_pcm\s*\(/i, 'RPC não deve inventar snapshot/reconciliação');

  const trigger = functionBody(sql, 'pcm_proteger_lavagem');
  assert.match(trigger, /pcm_edicao_campos/i);
  assert.match(trigger, /pcm_editado_em/i);
  assert.match(trigger, /ordem PCM automática não pode ser excluída/i);

  const reconcile = functionBody(sql, 'reconciliar_pcm');
  assert.match(reconcile, /v_existing\.pcm_encerrado_em is null/i);
  assert.match(reconcile, /v_existing\.pcm_motivo_encerramento = 'Ausente no snapshot Apoio'/i);
  assert.match(reconcile, /v_edits := v_edits - 'status' - 'data_realizada'/i);
  assert.match(reconcile, /frota removida.*nunca são conclusão|Frota removida do Apoio/is);
  assert.match(reconcile, /v_sync_error is not null or v_sync_source is null/i);
  assert.match(reconcile, /pcm_execucao_confirmada_em = case when v_reopened then null else pcm_execucao_confirmada_em end/i);
  assert.doesNotMatch(reconcile, /observacao\s*=\s*left\(/i, 'sync premium não deve anexar texto técnico na observação');

  assert.match(sql, /revoke execute on function public\.editar_programacao_pcm\(bigint, jsonb\)\s+from public, anon, authenticated/i);
  assert.match(sql, /grant execute on function public\.editar_programacao_pcm\(bigint, jsonb\)\s+to anon, authenticated/i);
  assert.doesNotMatch(sql, /grant\s+(select|insert|update|delete|all).*on table public\.lavagem_lubrificacao/i);
}

function order(os, eq, overrides = {}) {
  return {
    os: String(os),
    eq,
    modelo: 'Equipamento de teste',
    grupo: '',
    setor: 'Lavador',
    ponto: 'Lub Lavador99BP',
    origem: 'PCM',
    prestador: '',
    status: 'Programada',
    entrada: '2026-11-01T07:00:00',
    prev: '2026-11-04',
    narrativa: 'Lavagem e manutenção semanal.',
    motivo: 'Lavagem programada',
    classe: 'Rotina',
    cdPonto: '99',
    ...overrides,
  };
}

function snapshot(atualizado, ordens) {
  return { ok: true, atualizado, total: ordens.length, ordens };
}

function saoPauloDate() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const get = (type) => parts.find((part) => part.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function dateValue(value) {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

async function runDatabaseScenarios() {
  let PGlite;
  try {
    ({ PGlite } = require('@electric-sql/pglite'));
  } catch (error) {
    console.log(`SKIP: @electric-sql/pglite não disponível; contrato estático validado (${error.code || 'sem pacote'}).`);
    return;
  }

  const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
  const db = new PGlite();
  const base = read('supabase/APOIO_SETUP.sql');
  const automation = read('supabase/PCM_AUTOMACAO.sql');
  const history = read('supabase/PCM_HISTORICO.sql');
  try {
    await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
    await db.exec(`
      create table public.lavagem_lubrificacao (
        id bigserial primary key,
        frota text not null,
        local text not null default 'LAVADOR',
        tipo text not null default 'Lavagem / Lubrificação',
        data_programada date,
        horario text,
        status text not null default 'PENDENTE',
        data_realizada date,
        observacao text default '',
        created_at timestamptz default now(),
        updated_at timestamptz default now()
      );
    `);
    await db.exec(base);
    await db.exec(automation);
    await db.exec(history);
    await db.exec(sql);
    await db.exec(`
      grant select, insert, update, delete on public.lavagem_lubrificacao to anon, authenticated;
      grant usage, select on sequence public.lavagem_lubrificacao_id_seq to anon, authenticated;
    `);
    await db.query("insert into public.apoio_grupos (id, nome, cor) values ('g1', 'Grupo Norte', '#123456')");
    await db.query("insert into public.apoio_frotas (frota, grupo_id, nome) values ('F1', 'g1', 'Frota 1')");

    const apply = (payload) => db.query(
      'select public.aplicar_apoio_snapshot($1::jsonb) as value',
      [JSON.stringify(payload)],
    );
    const getRow = async (chave) => (await db.query(
      'select * from public.lavagem_lubrificacao where pcm_chave = $1', [chave],
    )).rows[0];
    const eventCount = async (chave, evento) => (await db.query(
      'select count(*)::int as count from public.pcm_eventos where chave = $1 and evento = $2',
      [chave, evento],
    )).rows[0].count;

    const a = order('A-001', 'F1');
    const b = order('B-001', 'F1', { entrada: '2026-11-02T08:00:00' });
    const t1 = new Date(Date.now() - 20 * 60 * 1000).toISOString();
    await apply(snapshot(t1, [a, b]));
    let rowA = await getRow('F1::A-001');
    const idA = rowA.id;
    const originalKey = rowA.pcm_chave;
    const originalFleet = rowA.frota;

    await db.exec('set role anon;');
    const edited = (await db.query(
      `select public.editar_programacao_pcm($1, $2::jsonb) as value`,
      [idA, JSON.stringify({
        local: 'CAMPO',
        tipo: 'Lubrificação',
        data_programada: '2026-11-05',
        horario: '09:30',
        status: 'ANDAMENTO',
        data_realizada: null,
        observacao: 'Nota manual premium',
      })],
    )).rows[0].value;
    assert.equal(edited.ok, true);
    assert.equal(edited.row.id, idA);
    assert.equal(edited.row.pcm_chave, originalKey);
    assert.equal(edited.row.frota, originalFleet);
    await assert.rejects(
      db.query('select public.editar_programacao_pcm($1, $2::jsonb)', [idA, JSON.stringify({ frota: 'FRAUDE' })]),
      /não editável/i,
    );
    await assert.rejects(
      db.query('select public.editar_programacao_pcm($1, $2::jsonb)', [idA, JSON.stringify({ data_programada: '2026-02-31' })]),
      /data_programada inválida/i,
    );
    await assert.rejects(
      db.query('select public.editar_programacao_pcm($1, $2::jsonb)', [idA, JSON.stringify({ horario: '25:00' })]),
      /horario deve ser HH:MM/i,
    );
    await assert.rejects(
      db.query('select public.editar_programacao_pcm($1, $2::jsonb)', [idA, JSON.stringify({ status: 'CANCELADO' })]),
      /status PCM inválido/i,
    );
    await assert.rejects(
      db.query('update public.lavagem_lubrificacao set pcm_edicao_campos = \'{"frota":"FRAUDE"}\'::jsonb where id = $1', [idA]),
      /campos PCM|servidor|ordem PCM automática/i,
    );
    await db.exec('reset role;');

    rowA = await getRow('F1::A-001');
    assert.equal(rowA.local, 'CAMPO');
    assert.equal(rowA.tipo, 'Lubrificação');
    assert.equal(rowA.status, 'ANDAMENTO');
    assert.equal(rowA.data_realizada, null, 'NULL manual deve continuar vazio');
    assert.equal(rowA.pcm_edicao_campos.data_realizada, null);
    assert.equal(rowA.pcm_edicao_campos.local, 'CAMPO');
    assert.ok(rowA.pcm_editado_em);
    assert.equal(await eventCount('F1::A-001', 'STATUS'), 1);

    // Encerrar manualmente uma ordem ainda ativa não é o dia de desaparecimento.
    const activeB = await getRow('F1::B-001');
    await db.query('select public.editar_programacao_pcm($1,$2::jsonb)', [activeB.id, JSON.stringify({ status: 'ENCERRADO' })]);
    await db.query('select public.reconciliar_pcm()');
    const manualClosedB = await getRow('F1::B-001');
    assert.equal(manualClosedB.status, 'ENCERRADO');
    assert.equal(manualClosedB.pcm_encerrado_em, null, 'status manual não cria detecção de ausência');
    assert.equal(manualClosedB.data_realizada, null);

    // A mudança real de status da fonte remove apenas o override de status;
    // tipo/local/data/hora/observação e data_realizada:null sobrevivem.
    await apply(snapshot(new Date(Date.now() - 19 * 60 * 1000).toISOString(), [
      { ...a, status: 'Andamento' }, b,
    ]));
    rowA = await getRow('F1::A-001');
    assert.equal(rowA.status, 'ANDAMENTO');
    assert.equal(Object.prototype.hasOwnProperty.call(rowA.pcm_edicao_campos, 'status'), false);
    assert.equal(rowA.pcm_edicao_campos.tipo, 'Lubrificação');
    assert.equal(rowA.pcm_edicao_campos.data_realizada, null);
    assert.equal(rowA.observacao, 'Nota manual premium');

    // Ausência válida: A tem override nulo e permanece sem data; B recebe o
    // dia da detecção em America/Sao_Paulo. Nenhuma confirmação é inventada.
    await apply(snapshot(new Date(Date.now() - 18 * 60 * 1000).toISOString(), []));
    rowA = await getRow('F1::A-001');
    const rowB = await getRow('F1::B-001');
    assert.equal(rowA.status, 'ENCERRADO');
    assert.ok(rowA.pcm_encerrado_em);
    assert.equal(rowA.pcm_motivo_encerramento, 'Ausente no snapshot Apoio');
    assert.equal(rowA.data_realizada, null);
    assert.equal(rowA.pcm_execucao_confirmada_em, null);
    assert.equal(Object.prototype.hasOwnProperty.call(rowA.pcm_edicao_campos, 'status'), false);
    assert.equal(rowA.pcm_edicao_campos.data_realizada, null);
    assert.equal(rowB.status, 'ENCERRADO');
    assert.equal(dateValue(rowB.data_realizada), saoPauloDate());
    assert.equal(rowB.pcm_execucao_confirmada_em, null);
    assert.equal(await eventCount('F1::A-001', 'CLOSE'), 1);

    // Confirmação humana posterior vence uma data explicitamente limpa.
    await db.query('select public.registrar_execucao_pcm($1,$2::date,$3)', ['F1::A-001', saoPauloDate(), 'Confirmado pelo operador']);
    await db.query('select public.reconciliar_pcm()');
    const confirmedA = await getRow('F1::A-001');
    assert.equal(dateValue(confirmedA.data_realizada), saoPauloDate());
    assert.equal(confirmedA.pcm_edicao_campos.data_realizada, saoPauloDate());
    assert.ok(confirmedA.pcm_execucao_confirmada_em);

    // Reaparecimento conserva identidade e overrides de negócio, mas remove
    // status/data_realizada overrides e limpa a realização do ciclo fechado.
    await apply(snapshot(new Date(Date.now() - 17 * 60 * 1000).toISOString(), [
      { ...a, status: 'Andamento' }, b,
    ]));
    rowA = await getRow('F1::A-001');
    assert.equal(rowA.id, idA);
    assert.equal(rowA.pcm_chave, originalKey);
    assert.equal(rowA.frota, originalFleet);
    assert.equal(rowA.status, 'ANDAMENTO');
    assert.equal(rowA.pcm_encerrado_em, null);
    assert.equal(rowA.data_realizada, null);
    assert.equal(rowA.pcm_execucao_confirmada_em, null);
    assert.equal(Object.prototype.hasOwnProperty.call(rowA.pcm_edicao_campos, 'status'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(rowA.pcm_edicao_campos, 'data_realizada'), false);
    assert.equal(rowA.pcm_edicao_campos.local, 'CAMPO');
    assert.equal(rowA.pcm_edicao_campos.tipo, 'Lubrificação');
    assert.equal(await eventCount('F1::A-001', 'REOPEN'), 1);

    // Frota removida apenas suspende; erro de sync também é inerte.
    await db.query("delete from public.apoio_frotas where frota = 'F1'");
    rowA = await getRow('F1::A-001');
    assert.equal(rowA.pcm_suspenso, true);
    assert.equal(rowA.pcm_encerrado_em, null);
    assert.notEqual(rowA.status, 'ENCERRADO');
    await db.query("insert into public.apoio_frotas (frota, grupo_id, nome) values ('F1', 'g1', 'Frota 1')");
    await db.query("select public.registrar_apoio_sync_erro('falha de rede')");
    await db.query("delete from public.apoio_ordens where chave = 'F1::A-001'");
    await db.query('select public.reconciliar_pcm()');
    rowA = await getRow('F1::A-001');
    assert.equal(rowA.pcm_encerrado_em, null, 'erro de sync não pode encerrar');

    await db.close();
    console.log('OK: PCM_EDICAO_PREMIUM validou contrato estático, RPC/whitelist, metadata protegida, overrides por campo, data nula explícita, data local de ausência, lifecycle/reabertura, frota removida e erro de sync.');
  } catch (error) {
    await db.close();
    throw error;
  }
}

(async () => {
  assertStaticContract();
  await runDatabaseScenarios();
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
