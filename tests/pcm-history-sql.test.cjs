// Requer npm install --no-save --no-package-lock @electric-sql/pglite.
// Todos os dados deste teste vivem em PostgreSQL isolado em memória; nenhum
// projeto Supabase remoto é consultado ou alterado.
const { PGlite } = require('@electric-sql/pglite');
const fs = require('node:fs');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');

const APOIO_SQL = fs.readFileSync('supabase/APOIO_SETUP.sql', 'utf8');
const PCM_SQL = fs.readFileSync('supabase/PCM_AUTOMACAO.sql', 'utf8');
const HISTORY_SQL = fs.readFileSync('supabase/PCM_HISTORICO.sql', 'utf8');

const dateText = (value) => {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).match(/[0-9]{4}-[0-9]{2}-[0-9]{2}/)?.[0] || String(value).slice(0, 10);
};
const originalFields = [
  'id', 'frota', 'local', 'tipo', 'data_programada', 'horario', 'status',
  'data_realizada', 'observacao',
];
const payloadHash = (rows) => crypto
  .createHash('md5')
  .update(JSON.stringify(rows.map((row) => Object.fromEntries(
    originalFields.map((field) => [field, field.startsWith('data_') ? dateText(row[field]) : row[field]]),
  ))))
  .digest('hex');

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
    motivo: 'Motivo10',
    classe: 'Classe10',
    cdPonto: '99',
    ...overrides,
  };
}

function snapshot(atualizado, ordens) {
  return { ok: true, atualizado, total: ordens.length, ordens };
}

(async () => {
  const db = new PGlite();
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
    await db.exec(APOIO_SQL);
    await db.exec(PCM_SQL);
    await db.exec(HISTORY_SQL);

    // O teste concede DML ao papel público para testar os triggers, não apenas
    // o efeito colateral de uma permissão ausente.
    await db.exec(`
      grant select, insert, update, delete on public.lavagem_lubrificacao to anon, authenticated;
      grant usage, select on sequence public.lavagem_lubrificacao_id_seq to anon, authenticated;
    `);
    await db.query("insert into public.apoio_grupos (id, nome, cor) values ('g1', 'Grupo Norte', '#123456')");
    await db.query(`
      insert into public.apoio_frotas (frota, grupo_id, nome)
      values ('F1', 'g1', 'Frota 1'), ('F2', 'g1', 'Frota 2'),
             ('F3', 'g1', 'Frota 3'), ('F9', 'g1', 'Frota 9'), ('F10', 'g1', 'Frota 10')
    `);

    const apply = (payload) => db.query(
      'select public.aplicar_apoio_snapshot($1::jsonb) as result',
      [JSON.stringify(payload)],
    );
    const allRows = async () => (await db.query(
      'select * from public.lavagem_lubrificacao order by id',
    )).rows;
    const automaticRows = async () => (await db.query(
      'select * from public.lavagem_lubrificacao where pcm_chave is not null order by id',
    )).rows;
    const manualRows = async () => (await db.query(
      'select * from public.lavagem_lubrificacao where pcm_chave is null order by id',
    )).rows;
    const manualByObservation = async (observation) => (await db.query(
      'select * from public.lavagem_lubrificacao where pcm_chave is null and observacao = $1',
      [observation],
    )).rows[0];
    const eventCount = async (chave, evento) => (await db.query(
      'select count(*)::int as count from public.pcm_eventos where chave = $1 and evento = $2',
      [chave, evento],
    )).rows[0].count;

    // Manuais com qualquer data são candidatos; tipo usa trim/lower. Os
    // concluídos e os de outra frota/tipo precisam permanecer ativos.
    await db.query(`
      insert into public.lavagem_lubrificacao
        (frota, local, tipo, data_programada, horario, status, observacao)
      values
        ('F1', 'LAVADOR', '  lavagem / lubrificação  ', '2020-01-01', '06:00', 'PENDENTE', 'DUP F1 ANTIGO'),
        ('F1', 'LAVADOR', 'Lavagem / Lubrificação', '2030-01-01', '06:30', 'PENDENTE', 'DUP F1 FUTURO'),
        ('F1', 'LAVADOR', 'Lavagem / Lubrificação', '2024-01-01', '06:30', 'CONCLUIDO', 'MANUAL CONCLUIDO'),
        ('F1', 'LAVADOR', 'Lubrificação', '2024-02-01', '06:30', 'PENDENTE', 'TIPO DIFERENTE'),
        ('F2', 'LAVADOR', 'Lavagem / Lubrificação', '2024-03-01', '06:30', 'PENDENTE', 'FROTA DIFERENTE'),
        ('F2', 'LAVADOR', '  LUBRIFICAÇÃO ', '2024-04-01', '06:30', 'PENDENTE', 'DUP F2 TIPO')
    `);
    const beforeManuals = await manualRows();
    const beforeManualCount = beforeManuals.length;
    const beforePayloadHash = payloadHash(beforeManuals);

    const firstSource = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const secondSource = new Date(Date.now() - 9 * 60 * 1000).toISOString();
    const lavagemF1A = order('A-001', 'F1');
    const lavagemF1B = order('A-002', 'F1', { entrada: '2026-11-02T07:00:00' });
    const lubrificacaoF2 = order('L-001', 'F2', {
      motivo: 'Lubrificação',
      classe: 'ROTINA',
      narrativa: 'Aplicar graxa nos pontos de lubrificação.',
    });
    const lavagemF3 = order('C-001', 'F3');
    const lavagemF9 = order('S-001', 'F9');

    await apply(snapshot(firstSource, [lavagemF1A, lavagemF1B, lubrificacaoF2, lavagemF3, lavagemF9]));

    let autos = await automaticRows();
    assert.deepEqual(autos.map((row) => row.pcm_chave), [
      'F1::A-001', 'F1::A-002', 'F2::L-001', 'F3::C-001', 'F9::S-001',
    ]);
    const autoA = autos.find((row) => row.pcm_chave === 'F1::A-001');
    const autoB = autos.find((row) => row.pcm_chave === 'F1::A-002');
    assert.ok(autoA.id < autoB.id, 'IDs automáticos devem ordenar deterministicamente');

    // Arquivo é metadata-only e escolhe a menor automática da mesma frota/tipo.
    const archivedOld = await manualByObservation('DUP F1 ANTIGO');
    const archivedFuture = await manualByObservation('DUP F1 FUTURO');
    const archivedF2 = await manualByObservation('DUP F2 TIPO');
    assert.ok(archivedOld.pcm_manual_arquivado_em);
    assert.ok(archivedFuture.pcm_manual_arquivado_em);
    assert.ok(archivedF2.pcm_manual_arquivado_em);
    assert.equal(archivedOld.pcm_manual_automatico_id, autoA.id);
    assert.equal(archivedFuture.pcm_manual_automatico_id, autoA.id);
    assert.equal(archivedF2.pcm_manual_automatico_id, autos.find((row) => row.pcm_chave === 'F2::L-001').id);
    assert.equal((await manualRows()).length, beforeManualCount, 'arquivamento não pode apagar manuais');
    assert.equal(payloadHash(await manualRows()), beforePayloadHash, 'payload original dos manuais permanece intacto');

    assert.equal((await manualByObservation('MANUAL CONCLUIDO')).pcm_manual_arquivado_em, null);
    assert.equal((await manualByObservation('TIPO DIFERENTE')).pcm_manual_arquivado_em, null);
    assert.equal((await manualByObservation('FROTA DIFERENTE')).pcm_manual_arquivado_em, null);
    assert.equal((await automaticRows()).filter((row) => row.pcm_chave.startsWith('F1::')).length, 2,
      'OS automáticas diferentes continuam independentes');
    assert.ok((await automaticRows()).every((row) => row.pcm_manual_arquivado_em == null));

    // O leitor operacional remove somente manual arquivado; automáticas e
    // manuais preservados continuam no controle.
    let operational = (await db.query('select public.carregar_lavagem_programacoes() as value')).rows[0].value;
    assert.equal(operational.some((row) => row.observacao === 'DUP F1 ANTIGO'), false);
    assert.equal(operational.some((row) => row.observacao === 'DUP F1 FUTURO'), false);
    assert.equal(operational.some((row) => row.pcm_chave === 'F1::A-001'), true);
    assert.equal(operational.some((row) => row.observacao === 'MANUAL CONCLUIDO'), true);

    // A fila de revisão também para de avisar sobre o manual já arquivado.
    const review = (await db.query('select public.carregar_pcm_revisao() as value')).rows[0].value;
    const reviewA = review.rows.find((row) => row.chave === 'F1::A-001');
    assert.ok(reviewA);
    assert.doesNotMatch(reviewA.motivo_revisao || '', /Duplicidade com registro manual ativo/);

    // O desaparecimento fecha, mas não inventa data de execução.
    await apply(snapshot(secondSource, [lavagemF1A, lubrificacaoF2, lavagemF3, lavagemF9]));
    let closed = (await automaticRows()).find((row) => row.pcm_chave === 'F1::A-002');
    const closedId = closed.id;
    const detection = closed.pcm_encerrado_em;
    assert.equal(closed.status, 'ENCERRADO');
    assert.ok(detection);
    assert.equal(closed.data_realizada, null);
    assert.equal(closed.pcm_execucao_confirmada_em, null);
    assert.equal(await eventCount('F1::A-002', 'CLOSE'), 1);

    // Confirmação explícita válida: não altera status nem hora de detecção.
    await db.exec('set role anon;');
    const confirmed = (await db.query(
      "select public.registrar_execucao_pcm($1, $2::date, $3) as value",
      ['F1::A-002', '2026-11-03', 'Executada no turno da manhã'],
    )).rows[0].value;
    assert.equal(confirmed.ok, true);
    assert.equal(confirmed.row.pcm_chave, 'F1::A-002');
    await assert.rejects(
      db.query("select public.registrar_execucao_pcm('F1::A-001', '2026-11-03'::date, '')"),
      /ENCERRADO/i,
    );
    await assert.rejects(
      db.query("select public.registrar_execucao_pcm('F1::A-002', '2999-01-01'::date, '')"),
      /futuro/i,
    );
    await assert.rejects(
      db.query("select public.registrar_execucao_pcm('F1::A-002', null::date, '')"),
      /obrigatória/i,
    );
    await assert.rejects(
      db.query("select public.registrar_execucao_pcm('F1::MANUAL', '2026-11-03'::date, '')"),
      /não encontrada|automática/i,
    );
    await db.exec('reset role;');

    closed = (await automaticRows()).find((row) => row.pcm_chave === 'F1::A-002');
    assert.equal(dateText(closed.data_realizada), '2026-11-03');
    assert.ok(closed.pcm_execucao_confirmada_em);
    assert.equal(String(closed.pcm_encerrado_em), String(detection), 'detecção não é execução');
    assert.equal(closed.status, 'ENCERRADO');
    assert.match(closed.observacao, /Execução confirmada/);
    assert.equal(await eventCount('F1::A-002', 'EXECUTION_CONFIRM'), 1);

    // Histórico inclui a automática encerrada, os manuais arquivados e não
    // trunca em 1.000. O grupo vem do mesmo join da fotografia operacional.
    await db.query(`
      insert into public.lavagem_lubrificacao
        (frota, local, tipo, data_programada, status, observacao)
      select 'F3', 'CAMPO', 'Lavagem / Lubrificação', '2026-01-01', 'ENCERRADO', 'historico-' || g::text
        from generate_series(1, 1005) g
    `);
    let history = (await db.query('select public.carregar_pcm_historico() as value')).rows[0].value;
    assert.ok(Array.isArray(history));
    assert.ok(history.length >= 1008, 'histórico completo não pode ter cap de 1.000');
    assert.ok(history.some((row) => row.observacao === 'DUP F1 ANTIGO'));
    assert.ok(history.some((row) => row.pcm_chave === 'F1::A-002'));
    const archivedHistoryRow = history.find((row) => row.observacao === 'DUP F1 ANTIGO');
    assert.equal(archivedHistoryRow.pcm_grupo_nome, 'Grupo Norte');
    assert.equal(archivedHistoryRow.pcm_manual_automatico_id, autoA.id);
    assert.ok(history.find((row) => row.pcm_chave === 'F1::A-002').pcm_execucao_confirmada_em);
    assert.equal(history.find((row) => row.pcm_chave === 'F1::A-002').data_realizada, '2026-11-03');

    // Um automático suspenso continua histórico, mas não arquiva um manual
    // novo que só coincida com ele.
    await db.query(`
      insert into public.lavagem_lubrificacao
        (frota, local, tipo, status, observacao, pcm_chave, pcm_os, pcm_status, pcm_suspenso, pcm_ultima_sinc)
      values ('F10', 'LAVADOR', 'Lavagem / Lubrificação', 'PENDENTE', 'AUTO SUSPENSA',
              'F10::SUSP-ONLY', 'SUSP-ONLY', 'Programada', true, clock_timestamp())
    `);
    await db.query(`
      insert into public.lavagem_lubrificacao
        (frota, local, tipo, status, observacao)
      values ('F10', 'LAVADOR', ' lavagem / lubrificação ', 'PENDENTE', 'MANUAL SUSP ONLY')
    `);
    await db.query('select public.reconciliar_pcm()');
    const suspendedManual = await manualByObservation('MANUAL SUSP ONLY');
    assert.equal(suspendedManual.pcm_manual_arquivado_em, null);
    history = (await db.query('select public.carregar_pcm_historico() as value')).rows[0].value;
    assert.ok(history.some((row) => row.pcm_chave === 'F10::SUSP-ONLY'));

    // Reabertura apaga somente a execução corrente; o event log fica retido.
    await apply(snapshot(new Date(Date.now() - 8 * 60 * 1000).toISOString(), [
      lavagemF1A, lavagemF1B, lubrificacaoF2, lavagemF3, lavagemF9,
    ]));
    const reopened = (await automaticRows()).find((row) => row.pcm_chave === 'F1::A-002');
    assert.equal(reopened.id, closedId);
    assert.equal(reopened.status, 'PROGRAMADO');
    assert.equal(reopened.data_realizada, null);
    assert.equal(reopened.pcm_execucao_confirmada_em, null);
    assert.equal(reopened.pcm_encerrado_em, null);
    assert.equal(await eventCount('F1::A-002', 'CLOSE'), 1);
    assert.equal(await eventCount('F1::A-002', 'EXECUTION_CONFIRM'), 1);
    assert.equal(await eventCount('F1::A-002', 'REOPEN'), 1);

    // Os três campos novos não podem ser forjados por cliente, nem em manual
    // nem em automática; o helper privado também não possui EXECUTE público.
    await db.exec('set role anon;');
    await assert.rejects(
      db.query("update public.lavagem_lubrificacao set pcm_execucao_confirmada_em = clock_timestamp() where pcm_chave = 'F1::A-001'"),
      /automática|servidor/i,
    );
    await assert.rejects(
      db.query("update public.lavagem_lubrificacao set pcm_manual_arquivado_em = clock_timestamp() where observacao = 'TIPO DIFERENTE'"),
      /campos PCM|servidor/i,
    );
    await assert.rejects(
      db.query("insert into public.lavagem_lubrificacao (frota, pcm_execucao_confirmada_em) values ('F1', clock_timestamp())"),
      /automática|servidor/i,
    );
    await assert.rejects(
      db.query('select public.arquivar_pcm_manuais_duplicados()'),
      /permission denied/i,
    );
    await db.exec('reset role;');

    // Contagem e payload dos manuais continuam presentes após todo o ciclo.
    assert.equal((await allRows()).filter((row) => row.pcm_chave === null).length >= beforeManualCount, true);
    assert.equal(payloadHash((await manualRows()).filter((row) => [
      'DUP F1 ANTIGO', 'DUP F1 FUTURO', 'MANUAL CONCLUIDO', 'TIPO DIFERENTE',
      'FROTA DIFERENTE', 'DUP F2 TIPO',
    ].includes(row.observacao))), beforePayloadHash);

    console.log('OK: PCM_HISTORICO validou arquivo metadata-only determinístico, tipos/frotas/datas, revisão sem falso duplicado, encerramento sem inferência, confirmação e rejeições, histórico sem cap incluindo suspensos, reabertura com auditoria e proteção contra forja.');
  } finally {
    await db.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
