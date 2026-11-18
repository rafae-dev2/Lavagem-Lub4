// Requer npm install --no-save --no-package-lock @electric-sql/pglite.
// Todos os dados deste teste vivem em um PostgreSQL isolado em memória.
const { PGlite } = require('@electric-sql/pglite');
const fs = require('node:fs');
const assert = require('node:assert/strict');

const APOIO_SQL = fs.readFileSync('supabase/APOIO_SETUP.sql', 'utf8');
const PCM_SQL = fs.readFileSync('supabase/PCM_AUTOMACAO.sql', 'utf8');
const OIL_302_SQL = fs.readFileSync('supabase/PCM_OIL_302_PLAN.sql', 'utf8');
const OIL_LUB_PLANS_SQL = fs.readFileSync('supabase/PCM_OIL_LUB_PLANS.sql', 'utf8');

const SOURCE_BASE_MS = Date.now() - 10 * 60 * 1000;
const sourceAt = (minutes) => new Date(SOURCE_BASE_MS + minutes * 60 * 1000).toISOString();
const FIRST_SOURCE = sourceAt(0);
const SECOND_SOURCE = sourceAt(1);
const THIRD_SOURCE = sourceAt(2);
const FOURTH_SOURCE = sourceAt(3);
const STALE_SOURCE = sourceAt(-10);

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
    // Aplique as migrações na ordem histórica: a segunda substitui a função
    // legada sem alterar o arquivo histórico de 302LUB.
    await db.exec(OIL_302_SQL);
    await db.exec(OIL_LUB_PLANS_SQL);

    const parsedEntry = (await db.query(
      "select public.pcm_parse_entrada('2026-11-04T07:00:00-03:00') as value",
    )).rows[0].value;
    assert.equal(parsedEntry.valida, true);
    assert.equal(parsedEntry.data, '2026-11-04');
    assert.equal(parsedEntry.horario, '07:00', 'Entrada mantém horário de parede');
    assert.equal((await db.query("select public.pcm_parse_entrada('2026-02-31T07:00:00') as value")).rows[0].value.valida, false);
    assert.equal((await db.query("select public.pcm_classificar_fonte('Mecânica','Oficina interna','','','PREVENTIVA','','Troca de óleo durante revisão geral','21') as value")).rows[0].value.regra, 'fora_escopo');

    // O setup legado deixa esta tabela no contrato interno do aplicativo. O
    // teste concede DML ao papel público para provar que o trigger é a defesa,
    // não um mero efeito colateral de falta de privilégio.
    await db.exec(`
      grant select, insert, update, delete on public.lavagem_lubrificacao to anon, authenticated;
      grant usage, select on sequence public.lavagem_lubrificacao_id_seq to anon, authenticated;
    `);

    await db.query("insert into public.apoio_grupos (id, nome, cor) values ('g1', 'Grupo Norte', '#123456')");
    await db.query("insert into public.apoio_frotas (frota, grupo_id, nome) values ('4508', 'g1', ''), ('4588', 'g1', '')");

    const apply = (payload) => db.query(
      'select public.aplicar_apoio_snapshot($1::jsonb) as result',
      [JSON.stringify(payload)],
    );
    const rows = async () => (await db.query(`
      select id, frota, local, tipo, data_programada, horario, status,
             data_realizada, observacao, pcm_chave, pcm_os, pcm_grupo_id,
             pcm_grupo_nome, pcm_status, pcm_entrada, pcm_previsao,
             pcm_narrativa, pcm_encerrado_em, pcm_motivo_encerramento,
             pcm_suspenso
        from public.lavagem_lubrificacao
       order by id
    `)).rows;
    const autoRows = async () => (await db.query(
      "select * from public.lavagem_lubrificacao where pcm_chave is not null order by pcm_chave",
    )).rows;
    const supportOrder = async (chave) => (await db.query(
      'select * from public.apoio_ordens where chave = $1', [chave],
    )).rows[0];
    const review = async () => (await db.query(
      'select public.carregar_pcm_revisao() as value',
    )).rows[0].value;

    // Registro manual pré-existente: a automação não o altera nem o substitui.
    await db.query(`
      insert into public.lavagem_lubrificacao
        (frota, local, tipo, data_programada, horario, status, observacao)
      values ('4508', 'LAVADOR', 'Lavagem / Lubrificação', '2026-11-01', '06:00', 'PENDENTE', 'MANUAL PRESERVADO')
    `);

    const lavagem4508 = order('159329765', '4508');
    const lavagem4588 = order('159331192', '4588', { entrada: '2026-11-04T07:00:00' });
    const oleo604 = order('159330811', '4508', {
      motivo: 'PREVENTIVA',
      classe: 'MANUT PREVENTIVA',
      narrativa: 'Execução plano: Plano Manutencao Preventiva 604LUB Ordem de Serviço programada para o(s) Plano(s) de Manutenção: 604/302',
    });
    const unknownPlan = order('159330900', '4508', {
      narrativa: 'Execução plano de manutenção 605MAN.',
      classe: 'MANUT PREVENTIVA',
      motivo: 'PREVENTIVA',
    });
    const tampa = order('159330901', '4508', {
      narrativa: 'Trocar tampa do óleo da registradora.',
      setor: 'Oficina',
      ponto: 'Comboio',
      cdPonto: '12',
      motivo: '',
      classe: '',
    });
    const thirdParty = order('159330902', '9999');
    const noFleet = order('159330903', 'SEM-FROTA');

    await apply(snapshot(FIRST_SOURCE, [
      lavagem4508, lavagem4588, oleo604, unknownPlan, tampa, thirdParty, noFleet,
    ]));

    let automatic = await autoRows();
    assert.equal(automatic.length, 3, 'somente as três classificações conhecidas entram');
    assert.deepEqual(automatic.map((row) => row.pcm_chave), [
      '4508::159329765', '4508::159330811', '4588::159331192',
    ]);
    const first = automatic.find((row) => row.pcm_chave === '4508::159329765');
    const oil = automatic.find((row) => row.pcm_chave === '4508::159330811');
    const second = automatic.find((row) => row.pcm_chave === '4588::159331192');
    assert.equal(first.tipo, 'Lavagem / Lubrificação');
    assert.equal(first.local, 'LAVADOR');
    assert.equal(first.data_programada.toISOString().slice(0, 10), '2026-11-01');
    assert.equal(first.horario, '07:00');
    assert.equal(oil.tipo, 'Troca de Óleo', 'plano 604LUB no Lavador é óleo');
    assert.equal(second.tipo, 'Lavagem / Lubrificação');
    assert.equal(oil.status, 'PROGRAMADO');
    assert.equal(oil.pcm_status, 'Programada');
    assert.equal(oil.pcm_grupo_nome, 'Grupo Norte');

    const manual = (await rows()).find((row) => row.pcm_chave === null);
    assert.equal(manual.observacao, 'MANUAL PRESERVADO');
    assert.equal((await rows()).length, 4, 'a ordem manual continua sendo uma linha independente');

    let reviewValue = await review();
    assert.equal(reviewValue.rows.length, 5, 'fila inclui todos os candidatos ativos próprios');
    const tampaReview = reviewValue.rows.find((row) => row.os === '159330901');
    const unknownReview = reviewValue.rows.find((row) => row.os === '159330900');
    const knownReview = reviewValue.rows.find((row) => row.os === '159329765');
    assert.match(tampaReview.motivo_revisao, /ambígua|insuficiente/i);
    assert.match(unknownReview.motivo_revisao, /ambígua|insuficiente/i);
    assert.match(knownReview.motivo_revisao, /Duplicidade com registro manual ativo/);
    assert.equal(new Date(reviewValue.sync.fonte_atualizada).getTime(), new Date(FIRST_SOURCE).getTime());
    assert.equal(tampaReview.equipamento, 'Equipamento de teste');
    assert.equal(tampaReview.apoio, 'Grupo Norte');

    // Snapshot igual faz backfill estruturado, sem segunda linha nem mudança de
    // primeira/última vista ou de presença.
    await db.query("update public.apoio_ordens set motivo = '', classe = '' where chave = '4508::159329765'");
    const beforeEqual = await supportOrder('4508::159329765');
    const equalPayload = snapshot(FIRST_SOURCE, [
      { ...lavagem4508, motivo: 'Motivo backfill', classe: 'Classe backfill' },
      lavagem4588, oleo604, unknownPlan, tampa, thirdParty, noFleet,
    ]);
    const equalResult = (await apply(equalPayload)).rows[0].result;
    assert.equal(equalResult.aplicado, false);
    const afterEqual = await supportOrder('4508::159329765');
    assert.equal(afterEqual.motivo, 'Motivo backfill');
    assert.equal(afterEqual.classe, 'Classe backfill');
    assert.equal(new Date(afterEqual.primeira_vista).getTime(), new Date(beforeEqual.primeira_vista).getTime());
    assert.equal(new Date(afterEqual.ultima_vista).getTime(), new Date(beforeEqual.ultima_vista).getTime());
    assert.equal(afterEqual.ativo, true);
    assert.equal((await autoRows()).length, 3, 'snapshot igual não duplica');
    await apply(snapshot(FIRST_SOURCE, [{ ...lavagem4508, motivo: 'Não sobrescrever', classe: 'Não sobrescrever', status: 'Andamento', narrativa: 'Não sobrescrever', entrada: '2026-11-04T09:00:00' }, lavagem4588, oleo604, unknownPlan, tampa, thirdParty, noFleet]));
    const afterEqualAgain = await supportOrder('4508::159329765');
    assert.equal(afterEqualAgain.motivo, 'Motivo backfill');
    assert.equal(afterEqualAgain.classe, 'Classe backfill');
    assert.equal(afterEqualAgain.status, beforeEqual.status);
    assert.equal(afterEqualAgain.narrativa, beforeEqual.narrativa);
    assert.equal(afterEqualAgain.entrada, beforeEqual.entrada);

    // Payload inválido e payload antigo não alteram as ordens.
    await assert.rejects(
      apply({ ...snapshot(SECOND_SOURCE, [lavagem4508]), total: 2 }),
      /total difere/i,
    );
    const beforeStale = await supportOrder('4508::159329765');
    await apply(snapshot(STALE_SOURCE, [
      { ...lavagem4508, motivo: 'MOTIVO ANTIGO', narrativa: 'antigo' },
    ]));
    const afterStale = await supportOrder('4508::159329765');
    assert.equal(afterStale.motivo, beforeStale.motivo);
    assert.equal(afterStale.narrativa, beforeStale.narrativa);
    assert.equal((await autoRows()).find((row) => row.pcm_chave === '4508::159329765').pcm_narrativa, lavagem4508.narrativa);

    // Repetição de uma resposta válida não cria eventos de minuto a minuto.
    const beforeEvents = (await db.query(
      "select count(*)::int as count from public.pcm_eventos where chave = '4508::159329765'",
    )).rows[0].count;
    await apply(snapshot(SECOND_SOURCE, [
      lavagem4508, lavagem4588, oleo604, unknownPlan, tampa, thirdParty, noFleet,
    ]));
    const afterEvents = (await db.query(
      "select count(*)::int as count from public.pcm_eventos where chave = '4508::159329765'",
    )).rows[0].count;
    assert.equal(afterEvents, beforeEvents, 'snapshot repetido não gera auditoria vazia');

    // Desaparecimento fecha somente a automática; data_realizada nunca é falsa.
    await apply(snapshot(THIRD_SOURCE, [lavagem4508, lavagem4588, unknownPlan, tampa]));
    let closed = (await autoRows()).find((row) => row.pcm_chave === '4508::159330811');
    assert.equal(closed.status, 'ENCERRADO');
    assert.ok(closed.pcm_encerrado_em);
    assert.equal(closed.data_realizada, null);
    assert.match(closed.observacao, /encerrada por ausência/);
    assert.equal((await db.query(
      "select count(*)::int as count from public.pcm_eventos where chave = '4508::159330811' and evento = 'CLOSE'",
    )).rows[0].count, 1);

    // Reaparecimento reabre a mesma linha e preserva a chave/id.
    const closedId = closed.id;
    await apply(snapshot(FOURTH_SOURCE, [lavagem4508, lavagem4588, oleo604, unknownPlan, tampa]));
    let reopened = (await autoRows()).find((row) => row.pcm_chave === '4508::159330811');
    assert.equal(reopened.id, closedId);
    assert.equal(reopened.status, 'PROGRAMADO');
    assert.equal(reopened.pcm_encerrado_em, null);
    assert.equal(reopened.data_realizada, null);
    assert.equal((await db.query(
      "select count(*)::int as count from public.pcm_eventos where chave = '4508::159330811' and evento = 'REOPEN'",
    )).rows[0].count, 1);

    // Override público muda o tipo da linha existente, sem duplicar.
    await db.exec('set role anon;');
    await db.query("select public.classificar_ordem_pcm('4508::159329765', 'Troca de Óleo')");
    await db.exec('reset role;');
    automatic = await autoRows();
    assert.equal(automatic.filter((row) => row.pcm_chave === '4508::159329765').length, 1);
    assert.equal(automatic.find((row) => row.pcm_chave === '4508::159329765').tipo, 'Troca de Óleo');
    assert.equal((await db.query(
      "select count(*)::int as count from public.pcm_eventos where chave = '4508::159329765' and evento = 'RECLASSIFY'",
    )).rows[0].count, 1);

    // IGNORAR suspende e o leitor operacional esconde sem apagar histórico;
    // AUTO remove override e retorna à regra default.
    await db.exec('set role anon;');
    await db.query("select public.classificar_ordem_pcm('4508::159329765', 'IGNORAR')");
    await db.exec('reset role;');
    let ignored = (await autoRows()).find((row) => row.pcm_chave === '4508::159329765');
    assert.equal(ignored.pcm_suspenso, true);
    assert.equal((await db.query('select carregar_lavagem_programacoes() as value')).rows[0].value.some((row) => row.pcm_chave === '4508::159329765'), false);
    reviewValue = await review();
    assert.match(reviewValue.rows.find((row) => row.os === '159329765').motivo_revisao, /IGNORAR/);

    await db.exec('set role anon;');
    await db.query("select public.classificar_ordem_pcm('4508::159329765', 'AUTO')");
    await db.exec('reset role;');
    ignored = (await autoRows()).find((row) => row.pcm_chave === '4508::159329765');
    assert.equal(ignored.pcm_suspenso, false);
    assert.equal(ignored.tipo, 'Lavagem / Lubrificação');
    assert.equal((await db.query("select count(*)::int as count from public.pcm_classificacoes where chave = '4508::159329765'")).rows[0].count, 0);

    // Classificação rejeita ordem inativa e frota que não pertence ao Apoio.
    await db.exec('set role anon;');
    await assert.rejects(
      db.query("select public.classificar_ordem_pcm('9999::159330902', 'Lavagem / Lubrificação')"),
      /não é ativa|não pertence/i,
    );
    await db.exec('reset role;');

    // Remover frota suspende sem fechar/concluir; reintroduzir a frota reativa.
    await db.query("delete from public.apoio_frotas where frota = '4588'");
    let removedFleet = (await autoRows()).find((row) => row.pcm_chave === '4588::159331192');
    assert.equal(removedFleet.pcm_suspenso, true);
    assert.notEqual(removedFleet.status, 'ENCERRADO');
    assert.equal(removedFleet.pcm_encerrado_em, null);
    await db.query("insert into public.apoio_frotas (frota, grupo_id, nome) values ('4588', 'g1', '')");
    removedFleet = (await autoRows()).find((row) => row.pcm_chave === '4588::159331192');
    assert.equal(removedFleet.pcm_suspenso, false);

    // Registro manual permanece editável/excluível; automática não.
    await db.exec('set role anon;');
    await db.query("update public.lavagem_lubrificacao set observacao = 'MANUAL EDITADO' where pcm_chave is null");
    await assert.rejects(db.query("update public.lavagem_lubrificacao set pcm_chave = 'fraude' where pcm_chave is null"), /campos PCM|servidor/i);
    await assert.rejects(db.query("insert into public.lavagem_lubrificacao(frota,pcm_chave) values('4508','fraude')"), /servidor/i);
    await db.query("insert into public.lavagem_lubrificacao(frota,observacao) values('4508','manual para excluir')");
    await db.query("delete from public.lavagem_lubrificacao where observacao = 'manual para excluir'");
    await assert.rejects(
      db.query("update public.lavagem_lubrificacao set status = 'EDITADO' where pcm_chave = '4508::159329765'"),
      /automática/i,
    );
    await assert.rejects(
      db.query("delete from public.lavagem_lubrificacao where pcm_chave = '4508::159329765'"),
      /automática/i,
    );
    await db.exec('reset role;');
    assert.equal((await rows()).find((row) => row.pcm_chave === null).observacao, 'MANUAL EDITADO');

    // A fotografia operacional é completa e inclui o manual não suspenso.
    await db.query(`
      insert into public.lavagem_lubrificacao (frota, local, tipo, status, observacao)
      select '4508', 'CAMPO', 'Lavagem / Lubrificação', 'PENDENTE', 'bulk-' || g::text
        from generate_series(1, 1005) g
    `);
    const full = (await db.query('select carregar_lavagem_programacoes() as value')).rows[0].value;
    assert.equal(full.length, (await db.query(
      'select count(*)::int as count from public.lavagem_lubrificacao where not coalesce(pcm_suspenso, false)',
    )).rows[0].count);
    assert.ok(full.length > 1000, 'RPC operacional não trunca em 1.000 linhas');

    console.log('OK: PCM SQL validou importação própria, classificação dos três exemplos, revisão, backfill igual, stale/bad guards, manual preserve, fechamento/reabertura, suspensão de frota, overrides, proteção DML e fotografia completa.');
  } finally {
    await db.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
