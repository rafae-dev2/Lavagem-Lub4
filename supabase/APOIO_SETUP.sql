-- APOIO_SETUP.sql
-- Backend compartilhado da seção Controle de Equipamentos — Apoio.
--
-- Contrato de acesso deliberadamente público:
--   * anon/authenticated podem ler todas as tabelas de dados;
--   * anon/authenticated podem classificar grupos e frotas;
--   * anon/authenticated NÃO podem escrever ordens/status de sincronização;
--   * somente service_role executa os RPCs de sincronização.
--
-- Não há tabela de membros nem gate de login nesta versão do produto.
-- Execute este arquivo no SQL Editor do projeto Supabase.

create table if not exists public.apoio_grupos (
  id text primary key,
  nome text not null check (btrim(nome) <> ''),
  cor text not null check (btrim(cor) <> '')
);

create table if not exists public.apoio_frotas (
  frota text primary key check (frota <> 'SEM-FROTA'),
  grupo_id text not null references public.apoio_grupos(id) on delete restrict,
  nome text not null default ''
);

create table if not exists public.apoio_ordens (
  chave text primary key,
  os text not null,
  frota text not null,
  modelo text not null default '',
  grupo_fonte text not null default '',
  setor text not null default '',
  ponto text not null default '',
  origem text not null default '',
  prestador text not null default '',
  status text not null default '',
  entrada text not null default '',
  previsao text not null default '',
  narrativa text not null default '',
  ativo boolean not null default true,
  primeira_vista timestamptz not null,
  ultima_vista timestamptz not null,
  ausente_desde timestamptz,
  constraint apoio_ordens_chave_nao_vazia check (btrim(chave) <> ''),
  constraint apoio_ordens_os_nao_vazia check (btrim(os) <> ''),
  constraint apoio_ordens_frota_nao_vazia check (btrim(frota) <> '')
);

create table if not exists public.apoio_sync (
  id integer primary key check (id = 1),
  fonte_atualizada timestamptz,
  consultado_em timestamptz,
  consulta_iniciada_em timestamptz,
  consulta_em_andamento boolean not null default false,
  sincronizado_em timestamptz,
  total integer not null default 0 check (total >= 0),
  erro text
);

alter table public.apoio_sync add column if not exists consulta_iniciada_em timestamptz;
alter table public.apoio_sync add column if not exists consulta_em_andamento boolean not null default false;

insert into public.apoio_sync (id, total)
values (1, 0)
on conflict (id) do nothing;

create index if not exists apoio_frotas_grupo_idx on public.apoio_frotas (grupo_id);
create index if not exists apoio_ordens_ativo_idx on public.apoio_ordens (ativo, chave);
create index if not exists apoio_ordens_frota_idx on public.apoio_ordens (frota, ativo);

-- RLS permanece ligado em todas as tabelas. Não existe política para escrita
-- de ordens/sync, portanto anon/authenticated jamais conseguem alterá-las.
alter table public.apoio_grupos enable row level security;
alter table public.apoio_frotas enable row level security;
alter table public.apoio_ordens enable row level security;
alter table public.apoio_sync enable row level security;

-- Reexecução segura: recriar as políticas sem acumular versões antigas.
drop policy if exists apoio_grupos_public_read on public.apoio_grupos;
drop policy if exists apoio_grupos_public_insert on public.apoio_grupos;
drop policy if exists apoio_grupos_public_update on public.apoio_grupos;
drop policy if exists apoio_grupos_public_delete on public.apoio_grupos;
drop policy if exists apoio_frotas_public_read on public.apoio_frotas;
drop policy if exists apoio_frotas_public_insert on public.apoio_frotas;
drop policy if exists apoio_frotas_public_update on public.apoio_frotas;
drop policy if exists apoio_frotas_public_delete on public.apoio_frotas;
drop policy if exists apoio_ordens_public_read on public.apoio_ordens;
drop policy if exists apoio_sync_public_read on public.apoio_sync;

create policy apoio_grupos_public_read
  on public.apoio_grupos for select to anon, authenticated
  using (true);
create policy apoio_grupos_public_insert
  on public.apoio_grupos for insert to anon, authenticated
  with check (true);
create policy apoio_grupos_public_update
  on public.apoio_grupos for update to anon, authenticated
  using (true) with check (true);
create policy apoio_grupos_public_delete
  on public.apoio_grupos for delete to anon, authenticated
  using (true);

create policy apoio_frotas_public_read
  on public.apoio_frotas for select to anon, authenticated
  using (true);
create policy apoio_frotas_public_insert
  on public.apoio_frotas for insert to anon, authenticated
  with check (true);
create policy apoio_frotas_public_update
  on public.apoio_frotas for update to anon, authenticated
  using (true) with check (true);
create policy apoio_frotas_public_delete
  on public.apoio_frotas for delete to anon, authenticated
  using (true);

create policy apoio_ordens_public_read
  on public.apoio_ordens for select to anon, authenticated
  using (true);

create policy apoio_sync_public_read
  on public.apoio_sync for select to anon, authenticated
  using (true);

-- Privilégios explícitos: o papel público não herda acesso por acidente. A
-- API só recebe DML de classificação nas duas tabelas de configuração.
revoke all on table public.apoio_grupos, public.apoio_frotas,
  public.apoio_ordens, public.apoio_sync from public;
revoke all on table public.apoio_grupos, public.apoio_frotas,
  public.apoio_ordens, public.apoio_sync from anon, authenticated;

grant select, insert, update, delete on table public.apoio_grupos, public.apoio_frotas
  to anon, authenticated;
grant select on table public.apoio_ordens, public.apoio_sync
  to anon, authenticated;

-- O service_role só precisa gravar ordens e status. A classificação pública é
-- mantida pela API com anon/authenticated; não conceder DML administrativo
-- nessas tabelas ao cliente de sincronização.
revoke all on table public.apoio_grupos, public.apoio_frotas from service_role;
grant select, insert, update, delete on table public.apoio_ordens, public.apoio_sync
  to service_role;

-- ---------------------------------------------------------------------------
-- RPCs de sincronização
-- ---------------------------------------------------------------------------
-- Todas as funções usam search_path fixo e nomes qualificados. Elas só podem
-- ser chamadas pelo service_role; anon/authenticated não têm EXECUTE.

create or replace function public.claim_apoio_sync()
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_last timestamptz;
  v_busy boolean;
begin
  -- Lock transacional único: concorrentes compartilham o minuto do relógio.
  -- Isso mantém o cron de minuto em minuto, sem pular execuções por pequenas
  -- variações de atraso; apenas o vencedor consulta a fonte nesse minuto.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('apoio:sync:claim'));

  select s.consulta_iniciada_em, s.consulta_em_andamento
    into v_last, v_busy
    from public.apoio_sync s
   where s.id = 1
   for update;

  if v_busy and v_last > v_now - interval '55 seconds' then
    return false;
  end if;

  if v_last is not null and v_last >= date_trunc('minute', v_now) then
    return false;
  end if;

  insert into public.apoio_sync (id, consultado_em, consulta_iniciada_em, consulta_em_andamento)
  values (1, v_now, v_now, true)
  on conflict (id) do update
    set consultado_em = excluded.consultado_em,
        consulta_iniciada_em = excluded.consulta_iniciada_em,
        consulta_em_andamento = true;

  return true;
end;
$$;

create or replace function public.aplicar_apoio_snapshot(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_now timestamptz;
  v_atualizado timestamptz;
  v_existing timestamptz;
  v_ordens jsonb;
  v_row jsonb;
  v_total integer;
  v_os text;
  v_frota text;
  v_chave text;
  v_keys text[] := array[]::text[];
  v_aplicado boolean;
begin
  -- A mesma trava impede que duas aplicações reconciliem presença/ausência
  -- simultaneamente, mesmo que a função seja chamada fora da Edge Function.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('apoio:sync:claim'));
  v_now := clock_timestamp();

  if p_payload is null or pg_catalog.jsonb_typeof(p_payload) <> 'object' then
    raise exception 'snapshot Apoio inválido: payload não é objeto';
  end if;
  if p_payload ->> 'ok' is distinct from 'true' then
    raise exception 'snapshot Apoio inválido: ok não é true';
  end if;
  if coalesce(p_payload ->> 'total', '') !~ '^[0-9]+$' then
    raise exception 'snapshot Apoio inválido: total não é inteiro não negativo';
  end if;
  v_total := (p_payload ->> 'total')::integer;
  v_ordens := p_payload -> 'ordens';
  if v_ordens is null or pg_catalog.jsonb_typeof(v_ordens) <> 'array' then
    raise exception 'snapshot Apoio inválido: ordens não é array';
  end if;
  if pg_catalog.jsonb_array_length(v_ordens) <> v_total then
    raise exception 'snapshot Apoio inválido: total difere do tamanho de ordens';
  end if;

  begin
    v_atualizado := (p_payload ->> 'atualizado')::timestamptz;
  exception when others then
    raise exception 'snapshot Apoio inválido: atualizado não é timestamp';
  end;
  if v_atualizado is null then
    raise exception 'snapshot Apoio inválido: atualizado vazio';
  end if;
  if v_atualizado > v_now + interval '5 minutes' then
    raise exception 'snapshot Apoio inválido: atualizado está no futuro';
  end if;
  if v_atualizado < v_now - interval '75 minutes' then
    raise exception 'snapshot Apoio inválido: fonte mais antiga que 75 minutos';
  end if;

  -- Validação defensiva no banco, inclusive quando a função for chamada por
  -- outra integração. A chave estável é frota + OS; duplicatas são rejeitadas.
  for v_row in select value from pg_catalog.jsonb_array_elements(v_ordens)
  loop
    if pg_catalog.jsonb_typeof(v_row) <> 'object' then
      raise exception 'snapshot Apoio inválido: item de ordens não é objeto';
    end if;
    v_os := nullif(pg_catalog.btrim(coalesce(v_row ->> 'os', '')), '');
    v_frota := nullif(pg_catalog.btrim(coalesce(v_row ->> 'eq', '')), '');
    if v_os is null then
      raise exception 'snapshot Apoio inválido: OS vazia';
    end if;
    if v_frota is null then
      raise exception 'snapshot Apoio inválido: frota vazia';
    end if;
    v_chave := v_frota || '::' || v_os;
    if v_chave = any(v_keys) then
      raise exception 'snapshot Apoio inválido: frota + OS duplicada (%).', v_chave;
    end if;
    v_keys := pg_catalog.array_append(v_keys, v_chave);
  end loop;

  select s.fonte_atualizada
    into v_existing
    from public.apoio_sync s
   where s.id = 1
   for update;

  -- Uma resposta válida, mas antiga/igual, atualiza somente o heartbeat da
  -- consulta. Não faz upsert nem remove ausentes.
  if v_existing is not null and v_atualizado <= v_existing then
    insert into public.apoio_sync (id, consultado_em, sincronizado_em, erro)
    values (1, v_now, v_now, null)
    on conflict (id) do update set
      consultado_em = excluded.consultado_em,
      sincronizado_em = excluded.sincronizado_em,
      consulta_em_andamento = false,
      erro = null;
    return pg_catalog.jsonb_build_object(
      'aplicado', false,
      'motivo', 'snapshot antigo ou igual',
      'total', v_total,
      'atualizado', v_atualizado
    );
  end if;

  for v_row in select value from pg_catalog.jsonb_array_elements(v_ordens)
  loop
    v_os := pg_catalog.btrim(coalesce(v_row ->> 'os', ''));
    v_frota := pg_catalog.btrim(coalesce(v_row ->> 'eq', ''));
    v_chave := v_frota || '::' || v_os;

    insert into public.apoio_ordens as existing (
      chave, os, frota, modelo, grupo_fonte, setor, ponto, origem,
      prestador, status, entrada, previsao, narrativa, ativo,
      primeira_vista, ultima_vista, ausente_desde
    ) values (
      v_chave,
      v_os,
      v_frota,
      coalesce(v_row ->> 'modelo', ''),
      coalesce(v_row ->> 'grupo', ''),
      coalesce(v_row ->> 'setor', ''),
      coalesce(v_row ->> 'ponto', ''),
      coalesce(v_row ->> 'origem', ''),
      coalesce(v_row ->> 'prestador', ''),
      coalesce(v_row ->> 'status', ''),
      coalesce(v_row ->> 'entrada', ''),
      coalesce(v_row ->> 'prev', ''),
      coalesce(v_row ->> 'narrativa', ''),
      true,
      v_now,
      v_now,
      null
    )
    on conflict (chave) do update set
      os = excluded.os,
      frota = excluded.frota,
      modelo = excluded.modelo,
      grupo_fonte = excluded.grupo_fonte,
      setor = excluded.setor,
      ponto = excluded.ponto,
      origem = excluded.origem,
      prestador = excluded.prestador,
      status = excluded.status,
      entrada = excluded.entrada,
      previsao = excluded.previsao,
      narrativa = excluded.narrativa,
      ativo = true,
      primeira_vista = coalesce(existing.primeira_vista, excluded.primeira_vista),
      ultima_vista = excluded.ultima_vista,
      ausente_desde = null;
  end loop;

  -- Ausência significa apenas que deixou de constar no último snapshot válido;
  -- nunca é uma alegação de encerramento/finalização.
  update public.apoio_ordens o
     set ativo = false,
         ausente_desde = coalesce(o.ausente_desde, v_now)
   where o.ativo is true
     and not (o.chave = any(v_keys))
     and not exists (select 1 from pg_catalog.jsonb_array_elements(v_ordens) incomplete
                     where incomplete ->> 'eq' = 'SEM-FROTA' and incomplete ->> 'os' = o.os);

  insert into public.apoio_sync (
    id, fonte_atualizada, consultado_em, sincronizado_em, total, erro
  ) values (
    1, v_atualizado, v_now, v_now, v_total, null
  )
  on conflict (id) do update set
    fonte_atualizada = excluded.fonte_atualizada,
    consultado_em = excluded.consultado_em,
    sincronizado_em = excluded.sincronizado_em,
    total = excluded.total,
    consulta_em_andamento = false,
    erro = null;

  return pg_catalog.jsonb_build_object(
    'aplicado', true,
    'total', v_total,
    'atualizado', v_atualizado
  );
end;
$$;

create or replace function public.registrar_apoio_sync_erro(p_erro text)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_now timestamptz := clock_timestamp();
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('apoio:sync:claim'));
  insert into public.apoio_sync (id, consultado_em, erro)
  values (1, v_now, left(coalesce(nullif(p_erro, ''), 'erro de sincronização'), 2000))
  on conflict (id) do update set
    consultado_em = excluded.consultado_em,
    consulta_em_andamento = false,
    erro = excluded.erro;
end;
$$;

revoke execute on function public.claim_apoio_sync() from public, anon, authenticated;
revoke execute on function public.aplicar_apoio_snapshot(jsonb) from public, anon, authenticated;
revoke execute on function public.registrar_apoio_sync_erro(text) from public, anon, authenticated;
grant execute on function public.claim_apoio_sync() to service_role;
grant execute on function public.aplicar_apoio_snapshot(jsonb) to service_role;
grant execute on function public.registrar_apoio_sync_erro(text) to service_role;

comment on table public.apoio_grupos is 'Classificação pública deliberada da seção Apoio.';
comment on table public.apoio_frotas is 'Frotas classificadas publicamente; FK de grupo é RESTRICT.';
comment on table public.apoio_ordens is 'Último snapshot válido e histórico de ausências; escrita apenas pelo sync service_role.';
comment on table public.apoio_sync is 'Singleton de heartbeat e metadados do último snapshot válido.';


-- Um único SELECT fornece uma fotografia consistente, sem paginação por
-- offsets enquanto a sincronização insere novas ordens no histórico.
create or replace function public.carregar_apoio_controle()
returns jsonb
language sql stable security invoker
set search_path = pg_catalog, public
as $$
  select jsonb_build_object(
    'groups', coalesce((select jsonb_agg(to_jsonb(g) order by g.nome) from public.apoio_grupos g), '[]'::jsonb),
    'fleets', coalesce((select jsonb_agg(to_jsonb(f) order by f.frota) from public.apoio_frotas f), '[]'::jsonb),
    'orders', coalesce((select jsonb_agg(to_jsonb(o) order by o.chave) from public.apoio_ordens o), '[]'::jsonb),
    'sync', (select to_jsonb(s) from public.apoio_sync s where s.id=1),
    'role', 'admin'
  );
$$;
revoke execute on function public.carregar_apoio_controle() from public;
grant execute on function public.carregar_apoio_controle() to anon, authenticated;

-- Claim e token retornam na mesma transação. O token permite descartar o
-- resultado de uma consulta antiga caso a lease expire e outra a substitua.
create or replace function public.iniciar_apoio_sync()
returns timestamptz
language plpgsql security definer
set search_path = pg_catalog, public
as $$
begin
  if not public.claim_apoio_sync() then return null; end if;
  return (select consulta_iniciada_em from public.apoio_sync where id=1);
end;
$$;

create or replace function public.concluir_apoio_sync(p_payload jsonb, p_token timestamptz)
returns jsonb
language plpgsql security definer
set search_path = pg_catalog, public
as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('apoio:sync:claim'));
  if p_token is null or p_token is distinct from (select consulta_iniciada_em from public.apoio_sync where id=1) then
    return jsonb_build_object('aplicado',false,'motivo','consulta substituída');
  end if;
  return public.aplicar_apoio_snapshot(p_payload);
end;
$$;

create or replace function public.falhar_apoio_sync(p_erro text, p_token timestamptz)
returns void
language plpgsql security definer
set search_path = pg_catalog, public
as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('apoio:sync:claim'));
  if p_token is null or p_token is distinct from (select consulta_iniciada_em from public.apoio_sync where id=1) then return; end if;
  perform public.registrar_apoio_sync_erro(p_erro);
end;
$$;
revoke execute on function public.iniciar_apoio_sync() from public, anon, authenticated;
revoke execute on function public.concluir_apoio_sync(jsonb,timestamptz) from public, anon, authenticated;
revoke execute on function public.falhar_apoio_sync(text,timestamptz) from public, anon, authenticated;
grant execute on function public.iniciar_apoio_sync() to service_role;
grant execute on function public.concluir_apoio_sync(jsonb,timestamptz) to service_role;
grant execute on function public.falhar_apoio_sync(text,timestamptz) to service_role;
