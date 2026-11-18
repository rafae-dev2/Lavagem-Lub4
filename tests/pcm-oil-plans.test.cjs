// Requer @electric-sql/pglite. Tudo roda em PostgreSQL isolado em memória;
// nenhuma credencial ou Supabase remoto é consultado.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');

const ROOT = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const APOIO_SQL = read('supabase/APOIO_SETUP.sql');
const PCM_SQL = read('supabase/PCM_AUTOMACAO.sql');
const OIL_302_PLAN_MIGRATION = path.join(ROOT, 'supabase', 'PCM_OIL_302_PLAN.sql');
const OIL_LUB_PLANS_MIGRATION = path.join(ROOT, 'supabase', 'PCM_OIL_LUB_PLANS.sql');

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
    entrada: '2026-11-09T07:00:00',
    prev: '2026-11-10',
    narrativa: 'Lavagem e manutenção semanal.',
    motivo: 'Motivo de teste',
    classe: 'Rotina',
    cdPonto: '99',
    ...overrides,
  };
}

function snapshot(atualizado, ordens) {
  return { ok: true, atualizado, total: ordens.length, ordens };
}

function oilType(value) {
  assert.equal(value.tipo, 'Troca de Óleo');
  return value;
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
    // Reproduz a cronologia de produção: a regra legada entra primeiro e a
    // regra geral LUB a substitui depois, sem reescrever a migração histórica.
    await db.exec(fs.readFileSync(OIL_302_PLAN_MIGRATION, 'utf8'));
    await db.exec(fs.readFileSync(OIL_LUB_PLANS_MIGRATION, 'utf8'));

    const classify = async (overrides = {}) => {
      const value = (await db.query(
        `select public.pcm_classificar_fonte(
           $1, $2, $3, $4, $5, $6, $7, $8
         ) as value`,
        [
          overrides.setor ?? 'Lavador',
          overrides.ponto ?? 'Lub Lavador99BP',
          overrides.origem ?? 'PCM',
          overrides.modelo ?? 'Equipamento de teste',
          overrides.motivo ?? '',
          overrides.classe ?? '',
          overrides.narrativa ?? '',
          overrides.cdPonto ?? '99',
        ],
      )).rows[0].value;
      return value;
    };

    // Qualquer código numérico terminado em LUB é óleo, em qualquer campo de
    // serviço e independentemente do ponto. A lista inclui separador decimal,
    // espaço, caixa diferente e códigos que não existiam na whitelist legada.
    for (const [field, code] of [
      ['motivo', '20.004LUB'],
      ['classe', '20004LUB'],
      ['narrativa', '302lUb'],
      ['motivo', '605 LUB'],
      ['classe', '1302LUB'],
    ]) {
      oilType(await classify({
        motivo: 'PREVENTIVA',
        classe: 'MANUT PREVENTIVA',
        narrativa: 'Revisão programada sem plano destacado.',
        [field]: `Execução do plano ${code}.`,
      }));
    }

    // A evidência explícita prevalece sobre o escopo: 302LUB fora do Lavador
    // também é troca de óleo.
    const outsideScope = await classify({
      setor: 'Oficina',
      ponto: 'Oficina 100',
      cdPonto: '100',
      motivo: 'PREVENTIVA',
      classe: 'MANUT PREVENTIVA',
      narrativa: 'Execução do plano 302LUB.',
    });
    oilType(outsideScope);
    assert.equal(outsideScope.regra, 'plano_lub_troca_oleo');

    // Códigos em setor/modelo/origem não são campos de serviço e não podem
    // criar óleo; sem indicador válido, uma preventiva continua ambígua.
    for (const [field, code] of [
      ['setor', '20.004LUB'],
      ['modelo', '1302LUB'],
      ['origem', '302LUB'],
    ]) {
      const nonServiceCode = await classify({
        setor: 'Oficina',
        ponto: 'Oficina 100',
        cdPonto: '100',
        motivo: 'PREVENTIVA',
        classe: 'MANUT PREVENTIVA',
        narrativa: 'Rotina semanal sem plano.',
        [field]: code,
      });
      assert.equal(nonServiceCode.tipo, null, `campo não-serviço não deve classificar: ${field}`);
      assert.equal(nonServiceCode.regra, 'fora_escopo');
    }

    // O texto de contexto Lubrificação sozinho não é código de plano.
    const lubricationContext = await classify({
      setor: 'Lubrificação',
      ponto: 'Oficina 100',
      cdPonto: '100',
      motivo: 'PREVENTIVA',
      classe: 'MANUT PREVENTIVA',
      narrativa: 'Rotina semanal sem código numérico.',
    });
    assert.equal(lubricationContext.tipo, null);
    assert.equal(lubricationContext.regra, 'revisao_ambigua');

    // Não aceitar ausência de número, sufixo adicional, número solto ou
    // preventiva genérica como se fossem um plano LUB.
    for (const narrativa of [
      'Execução do plano 605MAN.',
      'Código LUB sem número.',
      'Execução do plano 302LUBX.',
      'Registro aleatório do número 302 durante inspeção.',
      'Plano de manutenção preventiva genérica de rotina.',
    ]) {
      const value = await classify({ motivo: 'PREVENTIVA', classe: 'MANUT PREVENTIVA', narrativa });
      assert.equal(value.tipo, null, `narrativa não deve classificar como óleo: ${narrativa}`);
    }

    // O legado 604/302 continua restrito ao Lavador. Já 604LUB, como todo
    // código numérico terminado em LUB, é reconhecido também fora dele.
    oilType(await classify({ narrativa: 'Execução do plano 302LUB.' }));
    oilType(await classify({ narrativa: 'Execução do plano 302 LUB.' }));
    oilType(await classify({ narrativa: 'Execução do plano 604LUB.' }));
    oilType(await classify({ narrativa: 'Execução do plano 604/302.' }));
    const legacyOutsideScope = await classify({
      setor: 'Oficina',
      ponto: 'Oficina 100',
      cdPonto: '100',
      motivo: 'PREVENTIVA',
      classe: 'MANUT PREVENTIVA',
      narrativa: 'Execução do plano 604/302.',
    });
    assert.equal(legacyOutsideScope.tipo, null);
    assert.equal(legacyOutsideScope.regra, 'fora_escopo');

    // O texto explícito também permanece aceito.
    oilType(await classify({ narrativa: 'Troca de óleo durante a revisão.' }));

    // -----------------------------------------------------------------------
    // Cenário mínimo de integração: OSs reais, manual preservado, ausência e
    // reaparecimento da mesma linha automática sem duplicação.
    // -----------------------------------------------------------------------
    await db.exec(`
      grant select, insert, update, delete on public.lavagem_lubrificacao to anon, authenticated;
      grant usage, select on sequence public.lavagem_lubrificacao_id_seq to anon, authenticated;
    `);
    await db.query("insert into public.apoio_grupos (id, nome, cor) values ('g1', 'Grupo Norte', '#123456')");
    await db.query("insert into public.apoio_frotas (frota, grupo_id, nome) values ('4585', 'g1', ''), ('4626', 'g1', ''), ('6597', 'g1', '')");

    // A linha manual com a mesma frota/data é uma linha independente e não
    // pode ser substituída pela importação automática.
    await db.query(`
      insert into public.lavagem_lubrificacao
        (frota, local, tipo, data_programada, horario, status, observacao)
      values ('4585', 'LAVADOR', 'Troca de Óleo', '2026-11-09', '06:00', 'PENDENTE', 'MANUAL PRESERVADO')
    `);

    const oil302 = order('159332724', '4585', {
      narrativa: 'Execução do plano 302LUB para Lavador.',
      motivo: 'PREVENTIVA',
      classe: 'MANUT PREVENTIVA',
    });
    const oil604302 = order('159332726', '4626', {
      narrativa: 'Execução do plano 604LUB/604/302.',
      motivo: 'PREVENTIVA',
      classe: 'MANUT PREVENTIVA',
    });
    const oil6597 = order('159330818', '6597', {
      narrativa: 'Execução do plano 20.004LUB.',
      motivo: 'PREVENTIVA',
      classe: 'MANUT PREVENTIVA',
    });
    const weeklyWash6597 = order('159330819', '6597', {
      narrativa: 'Lavagem e manutenção semanal.',
      motivo: 'ROTINA',
      classe: 'LAVAGEM',
    });
    const apply = (payload) => db.query(
      'select public.aplicar_apoio_snapshot($1::jsonb) as value',
      [JSON.stringify(payload)],
    );
    const automaticRows = async () => (await db.query(`
      select id, frota, tipo, observacao, pcm_chave, pcm_os, status,
             pcm_encerrado_em, pcm_suspenso
        from public.lavagem_lubrificacao
       where pcm_chave is not null
       order by pcm_chave
    `)).rows;
    const source = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    await apply(snapshot(source, [oil302, oil604302, oil6597, weeklyWash6597]));
    let automatic = await automaticRows();
    assert.equal(automatic.length, 4, 'as três OSs de óleo e a lavagem semanal devem criar linhas separadas');
    assert.deepEqual(automatic.map((row) => row.pcm_chave), [
      '4585::159332724',
      '4626::159332726',
      '6597::159330818',
      '6597::159330819',
    ]);
    assert.equal(automatic.filter((row) => row.tipo === 'Troca de Óleo').length, 3);
    assert.equal(automatic.find((row) => row.pcm_chave === '6597::159330819').tipo, 'Lavagem / Lubrificação');
    assert.equal(automatic.find((row) => row.pcm_chave === '4585::159332724').pcm_os, '159332724');
    assert.equal(automatic.find((row) => row.pcm_chave === '4626::159332726').pcm_os, '159332726');
    assert.equal(automatic.find((row) => row.pcm_chave === '6597::159330818').pcm_os, '159330818');
    assert.equal(automatic.find((row) => row.pcm_chave === '6597::159330819').pcm_os, '159330819');
    assert.equal(
      (await db.query("select count(*)::int as count from public.lavagem_lubrificacao where pcm_chave is null")).rows[0].count,
      1,
      'a programação manual continua separada',
    );
    assert.equal(
      (await db.query("select observacao from public.lavagem_lubrificacao where pcm_chave is null")).rows[0].observacao,
      'MANUAL PRESERVADO',
    );

    // Snapshot repetido não cria a segunda automática nem altera a manual.
    await apply(snapshot(new Date(Date.now() - 9 * 60 * 1000).toISOString(), [oil302, oil604302, oil6597, weeklyWash6597]));
    assert.equal((await automaticRows()).length, 4, 'snapshot repetido não duplica planos');
    assert.equal(
      (await db.query("select observacao from public.lavagem_lubrificacao where pcm_chave is null")).rows[0].observacao,
      'MANUAL PRESERVADO',
    );

    // Ausência fecha a linha automática, sem tocar no manual.
    await apply(snapshot(new Date(Date.now() - 8 * 60 * 1000).toISOString(), [oil604302, oil6597, weeklyWash6597]));
    let closed = (await automaticRows()).find((row) => row.pcm_chave === '4585::159332724');
    assert.equal(closed.status, 'ENCERRADO');
    assert.ok(closed.pcm_encerrado_em);
    assert.equal(closed.pcm_suspenso, false);
    assert.equal(
      (await db.query("select observacao from public.lavagem_lubrificacao where pcm_chave is null")).rows[0].observacao,
      'MANUAL PRESERVADO',
    );

    // Reaparecimento reabre a mesma linha/identidade, ainda sem duplicar.
    const closedId = closed.id;
    await apply(snapshot(new Date(Date.now() - 7 * 60 * 1000).toISOString(), [oil302, oil604302, oil6597, weeklyWash6597]));
    automatic = await automaticRows();
    const reopened = automatic.find((row) => row.pcm_chave === '4585::159332724');
    assert.equal(reopened.id, closedId);
    assert.equal(reopened.status, 'PROGRAMADO');
    assert.equal(reopened.pcm_encerrado_em, null);
    assert.equal(automatic.length, 4, 'reabertura reutiliza a linha existente');

    console.log('OK: códigos LUB gerais, campos/escopo, legado 604/302, OS 6597 com lavagem separada, manual preserve e close/reopen validados.');
  } finally {
    await db.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
