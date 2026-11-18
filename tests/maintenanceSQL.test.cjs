const assert=require('node:assert/strict');
const fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
(async()=>{
 const db=new PGlite();
 try{
  await db.exec('create role anon; create role authenticated; create role service_role;');
  await db.exec(fs.readFileSync('supabase/APOIO_SETUP.sql','utf8'));
  await db.exec("alter table public.apoio_ordens add column motivo text default '', add column classe text default '', add column cd_ponto text default ''; create function public.set_updated_at() returns trigger language plpgsql as $$begin return new; end$$;");
  await db.exec(fs.readFileSync('supabase/MANUTENCAO_ACOMPANHAMENTO.sql','utf8'));
  await db.exec(fs.readFileSync('supabase/MANUTENCAO_SNAPSHOT_GUARD.sql','utf8'));
  const order=id=>({os:id,eq:'23677',modelo:'Carreta Canavieira',grupo:'Cana',setor:'Mecânica',ponto:'Plano',origem:'Oficina',prestador:'',status:'Programada',entrada:'2026-11-08',prev:'2026-11-09',narrativa:'Preventiva'});
  const payload=(minutes,ids)=>({ok:true,total:ids.length,atualizado:new Date(Date.now()-minutes*60000).toISOString(),ordens:ids.map(order)});
  const apply=p=>db.query('select public.aplicar_apoio_snapshot($1::jsonb) as result',[JSON.stringify(p)]);
  await apply(payload(5,['T-1','T-2']));
  await db.exec("update public.apoio_ordens set motivo='Preventiva mecânica',classe='PREVENTIVA',cd_ponto='99' where os='T-1';");
  await apply(payload(4,['T-1']));
  const values=(await db.query('select os,status_acompanhamento,encerramento_origem,encerramento_detectado_em,classe from public.manutencao_acompanhamento_ordens order by os')).rows;
  assert.equal(values[0].status_acompanhamento,'programado');assert.equal(values[0].classe,'PREVENTIVA','classe opcional vazia preservada');
  assert.equal(values[1].status_acompanhamento,'encerrado');assert.equal(values[1].encerramento_origem,'ausencia');assert.ok(values[1].encerramento_detectado_em);
  await assert.rejects(apply({...payload(3,['T-1']),ordens:[{os:'T-1',eq:'23677'}]}),/campo obrigatório.*omitido/);
  assert.equal((await db.query('select count(*)::int as count from public.apoio_ordens')).rows[0].count,2);
  await apply(payload(2,['T-1','T-2']));
  assert.equal((await db.query("select status_acompanhamento,encerramento_origem from public.manutencao_acompanhamento_ordens where os='T-2'")).rows[0].status_acompanhamento,'programado');
  await db.exec('set role anon;');
  assert.equal((await db.query('select public.carregar_acompanhamento_manutencao() as payload')).rows[0].payload.orders.length,2);
  await assert.rejects(db.query('select public.aplicar_apoio_snapshot($1::jsonb)',[JSON.stringify(payload(1,[]))]),/permission denied/);
  await assert.rejects(db.query("update public.apoio_ordens set status='Encerrado'"),/permission denied/);
  console.log('OK: PostgreSQL isolado — guard incompleto, campos opcionais preservados, encerramento por saída, reaparecimento, leitura com RLS e escrita bloqueada.');
 }finally{await db.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
