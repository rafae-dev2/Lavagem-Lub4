-- PCM_HISTORICO.sql
-- Migração incremental sobre APOIO_SETUP.sql + PCM_AUTOMACAO.sql.
-- Não remove linhas: histórico e duplicatas manuais usam somente metadados.

-- ---------------------------------------------------------------------------
-- Metadados de arquivo e de execução confirmada.
-- ---------------------------------------------------------------------------
alter table public.lavagem_lubrificacao
  add column if not exists pcm_manual_arquivado_em timestamptz;
alter table public.lavagem_lubrificacao
  add column if not exists pcm_manual_automatico_id bigint;
alter table public.lavagem_lubrificacao
  add column if not exists pcm_execucao_confirmada_em timestamptz;

create index if not exists lavagem_pcm_manual_arquivo_idx
  on public.lavagem_lubrificacao (pcm_manual_arquivado_em, id)
  where pcm_manual_arquivado_em is not null;
create index if not exists lavagem_pcm_execucao_idx
  on public.lavagem_lubrificacao (pcm_execucao_confirmada_em, id)
  where pcm_execucao_confirmada_em is not null;

-- ---------------------------------------------------------------------------
-- A auditoria aceita o evento explícito de confirmação de execução. O nome da
-- constraint é o gerado pelo schema original; somente essa constraint é
-- substituída, sem remover as demais constraints de pcm_eventos.
-- ---------------------------------------------------------------------------
alter table public.pcm_eventos
  drop constraint if exists pcm_eventos_evento_check;
alter table public.pcm_eventos
  add constraint pcm_eventos_evento_check check (evento in (
    'CREATE', 'STATUS', 'RECLASSIFY', 'REOPEN', 'CLOSE', 'SUSPEND',
    'EXECUTION_CONFIRM'
  ));

-- ---------------------------------------------------------------------------
-- Arquivamento privado, determinístico e somente por metadados.
-- Um manual ativo é arquivado quando existe qualquer automática não suspensa
-- na mesma frota e no mesmo tipo normalizado. A menor automática.id é gravada;
-- datas não participam do pareamento e OS diferentes continuam independentes.
-- ---------------------------------------------------------------------------
create or replace function public.arquivar_pcm_manuais_duplicados()
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_count integer := 0;
begin
  with candidatos as (
    select m.id as manual_id, min(a.id) as automatico_id
      from public.lavagem_lubrificacao m
      join public.lavagem_lubrificacao a
        on a.pcm_chave is not null
       and not coalesce(a.pcm_suspenso, false)
       and a.frota = m.frota
       and lower(btrim(coalesce(a.tipo, ''))) = lower(btrim(coalesce(m.tipo, '')))
     where m.pcm_chave is null
       and m.pcm_manual_arquivado_em is null
       and upper(btrim(coalesce(m.status, ''))) not in
           ('ENCERRADO', 'CONCLUIDO', 'REALIZADO')
     group by m.id
  )
  update public.lavagem_lubrificacao m
     set pcm_manual_arquivado_em = clock_timestamp(),
         pcm_manual_automatico_id = c.automatico_id
    from candidatos c
   where m.id = c.manual_id;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Proteção adicional: o cliente não pode forjar arquivo ou confirmação.
-- Manuais continuam editáveis nos campos de negócio e excluíveis; as colunas
-- PCM, inclusive as três novas, só mudam em funções SECURITY DEFINER internas.
-- ---------------------------------------------------------------------------
create or replace function public.pcm_proteger_lavagem()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  v_interno boolean := current_user in ('postgres', 'service_role', 'supabase_admin');
begin
  if TG_OP = 'INSERT' then
    if not v_interno and (
      new.pcm_chave is not null or new.pcm_os is not null
      or new.pcm_grupo_id is not null or new.pcm_grupo_nome is not null
      or new.pcm_status is not null or new.pcm_entrada is not null
      or new.pcm_previsao is not null or new.pcm_narrativa is not null
      or new.pcm_encerrado_em is not null or new.pcm_motivo_encerramento is not null
      or new.pcm_ultima_sinc is not null or coalesce(new.pcm_suspenso, false)
      or new.pcm_manual_arquivado_em is not null
      or new.pcm_manual_automatico_id is not null
      or new.pcm_execucao_confirmada_em is not null
    ) then
      raise exception 'ordem PCM automática só pode ser criada pelo servidor';
    end if;
    return new;
  end if;

  if old.pcm_chave is null then
    if TG_OP = 'UPDATE' and not v_interno and (
      new.pcm_chave is distinct from old.pcm_chave
      or new.pcm_os is distinct from old.pcm_os
      or new.pcm_grupo_id is distinct from old.pcm_grupo_id
      or new.pcm_grupo_nome is distinct from old.pcm_grupo_nome
      or new.pcm_status is distinct from old.pcm_status
      or new.pcm_entrada is distinct from old.pcm_entrada
      or new.pcm_previsao is distinct from old.pcm_previsao
      or new.pcm_narrativa is distinct from old.pcm_narrativa
      or new.pcm_encerrado_em is distinct from old.pcm_encerrado_em
      or new.pcm_motivo_encerramento is distinct from old.pcm_motivo_encerramento
      or new.pcm_ultima_sinc is distinct from old.pcm_ultima_sinc
      or coalesce(new.pcm_suspenso, false) is distinct from coalesce(old.pcm_suspenso, false)
      or new.pcm_manual_arquivado_em is distinct from old.pcm_manual_arquivado_em
      or new.pcm_manual_automatico_id is distinct from old.pcm_manual_automatico_id
      or new.pcm_execucao_confirmada_em is distinct from old.pcm_execucao_confirmada_em
    ) then
      raise exception 'campos PCM só podem ser definidos pelo servidor';
    end if;
    return case when TG_OP = 'DELETE' then old else new end;
  end if;

  if not v_interno then
    if TG_OP = 'DELETE' then
      raise exception 'ordem PCM automática não pode ser excluída';
    end if;
    raise exception 'ordem PCM automática não pode ser alterada diretamente';
  end if;
  return case when TG_OP = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists trg_pcm_proteger_lavagem on public.lavagem_lubrificacao;
create trigger trg_pcm_proteger_lavagem
  before insert or update or delete on public.lavagem_lubrificacao
  for each row execute function public.pcm_proteger_lavagem();

-- ---------------------------------------------------------------------------
-- Reconciliador completo da automação, com limpeza da confirmação ao reabrir
-- e arquivamento privado no final da transação.
-- ---------------------------------------------------------------------------
create or replace function public.reconciliar_pcm()
returns void
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_order record;
  v_existing public.lavagem_lubrificacao%rowtype;
  v_found boolean;
  v_class jsonb;
  v_entry jsonb;
  v_override text;
  v_tipo text;
  v_regra text;
  v_motivo text;
  v_status text;
  v_entry_valida boolean;
  v_local text;
  v_data date;
  v_horario text;
  v_was_closed boolean;
  v_was_suspended boolean;
  v_status_changed boolean;
  v_type_changed boolean;
  v_seen text[] := array[]::text[];
  v_fleet_exists boolean;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('apoio:sync:claim'));

  -- Somente ordens ativas de uma frota atualmente cadastrada passam por este
  -- laço. A ordem SEM-FROTA nunca satisfaz o join.
  for v_order in
    select o.chave, o.os, o.frota, o.modelo, o.grupo_fonte, o.setor, o.ponto,
           o.origem, o.prestador, o.status as fonte_status, o.entrada,
           o.previsao, o.narrativa, o.motivo, o.classe, o.cd_ponto,
           o.ativo, f.grupo_id, f.nome as equipamento_nome,
           coalesce(g.nome, '') as grupo_nome
      from public.apoio_ordens o
      join public.apoio_frotas f on f.frota = o.frota
      left join public.apoio_grupos g on g.id = f.grupo_id
     where o.ativo is true
       and o.frota <> 'SEM-FROTA'
     order by o.chave
  loop
    v_seen := array_append(v_seen, v_order.chave);
    v_override := null;
    select c.tipo into v_override
      from public.pcm_classificacoes c
     where c.chave = v_order.chave;

    v_class := public.pcm_classificar_fonte(
      v_order.setor, v_order.ponto, v_order.origem, v_order.modelo,
      v_order.motivo, v_order.classe, v_order.narrativa, v_order.cd_ponto
    );
    v_entry := public.pcm_parse_entrada(v_order.entrada);
    v_local := public.pcm_local(v_order.ponto, v_order.cd_ponto);
    v_tipo := case
      when v_override = 'IGNORAR' then null
      when v_override is not null then v_override
      else v_class ->> 'tipo'
    end;
    v_regra := case
      when v_override = 'IGNORAR' then 'ignorar_override'
      when v_override is not null then 'override_' || lower(replace(v_override, ' ', '_'))
      else v_class ->> 'regra'
    end;
    v_motivo := case
      when v_override = 'IGNORAR' then 'IGNORAR salvo; ordem histórica preservada e ocultada'
      when v_tipo is null then v_class ->> 'motivo'
      else null
    end;

    v_entry_valida := v_entry ->> 'valida' = 'true'
      and nullif(v_entry ->> 'data', '') is not null
      and nullif(v_entry ->> 'horario', '') is not null;
    if v_entry_valida then
      v_data := (v_entry ->> 'data')::date;
    else
      v_data := null;
    end if;
    v_horario := nullif(v_entry ->> 'horario', '');
    v_status := public.pcm_status(v_order.fonte_status);

    select l.* into v_existing
      from public.lavagem_lubrificacao l
     where l.pcm_chave = v_order.chave;
    v_found := found;

    -- IGNORAR/ambiguidade não cria uma programação nova. Se já existia uma
    -- automática, ela fica no histórico e é suspensa, não encerrada.
    if v_tipo is null then
      -- Um erro de Entrada não deve suspender/encerrar uma automática válida;
      -- a fila exibe o erro diretamente na ordem Apoio.
      if not v_entry_valida and v_found and v_override is distinct from 'IGNORAR' then
        continue;
      end if;
      if v_found and not coalesce(v_existing.pcm_suspenso, false) then
        update public.lavagem_lubrificacao
           set pcm_suspenso = true,
               pcm_motivo_encerramento = coalesce(v_motivo, 'Classificação requer revisão'),
               pcm_ultima_sinc = v_now
         where id = v_existing.id;
        perform public.pcm_log_event(v_order.chave, 'SUSPEND', v_existing.tipo, null,
          jsonb_build_object('regra', v_regra, 'motivo', v_motivo));
      end if;
      continue;
    end if;

    -- Não criar uma nova programação com data NULL. Se já existe uma linha,
    -- o update abaixo preserva sua última data/hora válidas.
    if not v_entry_valida and not v_found then
      continue;
    end if;

    if v_found then
      v_was_closed := v_existing.status = 'ENCERRADO'
        or v_existing.pcm_encerrado_em is not null;
      v_was_suspended := coalesce(v_existing.pcm_suspenso, false);
      v_status_changed := coalesce(v_existing.pcm_status, '') <> coalesce(v_order.fonte_status, '');
      v_type_changed := coalesce(v_existing.tipo, '') <> coalesce(v_tipo, '');

      update public.lavagem_lubrificacao
         set frota = v_order.frota,
             local = v_local,
             tipo = v_tipo,
             data_programada = case when v_entry_valida then v_data else v_existing.data_programada end,
             horario = case when v_entry_valida then v_horario else v_existing.horario end,
             status = v_status,
             data_realizada = null,
             pcm_execucao_confirmada_em = null,
             observacao = case when v_was_closed then 'OS ' || v_order.os
                               else coalesce(nullif(v_existing.observacao, ''), 'OS ' || v_order.os) end,
             pcm_os = v_order.os,
             pcm_grupo_id = v_order.grupo_id,
             pcm_grupo_nome = v_order.grupo_nome,
             pcm_status = v_order.fonte_status,
             pcm_entrada = v_order.entrada,
             pcm_previsao = v_order.previsao,
             pcm_narrativa = v_order.narrativa,
             pcm_encerrado_em = null,
             pcm_motivo_encerramento = null,
             pcm_ultima_sinc = v_now,
             pcm_suspenso = false
       where id = v_existing.id;

      if v_type_changed then
        perform public.pcm_log_event(v_order.chave, 'RECLASSIFY', v_existing.tipo, v_tipo,
          jsonb_build_object('regra', v_regra));
      end if;
      if v_status_changed then
        perform public.pcm_log_event(v_order.chave, 'STATUS', v_existing.pcm_status, v_order.fonte_status,
          jsonb_build_object('fonte', v_order.fonte_status));
      end if;
      if v_was_closed then
        perform public.pcm_log_event(v_order.chave, 'REOPEN', 'ENCERRADO', v_status,
          jsonb_build_object('detalhe', 'ordem reapareceu em snapshot válido'));
      end if;
      -- v_was_suspended=true e tipo válido implica resgate de IGNORAR/frota
      -- removida; a reativação não precisa de evento por minuto.
    else
      insert into public.lavagem_lubrificacao (
        frota, local, tipo, data_programada, horario, status, data_realizada,
        observacao, pcm_chave, pcm_os, pcm_grupo_id, pcm_grupo_nome, pcm_status,
        pcm_entrada, pcm_previsao, pcm_narrativa, pcm_encerrado_em,
        pcm_motivo_encerramento, pcm_ultima_sinc, pcm_suspenso
      ) values (
        v_order.frota, v_local, v_tipo, v_data, v_horario, v_status, null,
        'OS ' || v_order.os, v_order.chave, v_order.os, v_order.grupo_id,
        v_order.grupo_nome, v_order.fonte_status, v_order.entrada, v_order.previsao,
        v_order.narrativa, null, null, v_now, false
      );
      perform public.pcm_log_event(v_order.chave, 'CREATE', null, v_tipo,
        jsonb_build_object('os', v_order.os, 'frota', v_order.frota, 'regra', v_regra));
    end if;
  end loop;

  -- Tudo que deixou de estar entre as ordens ativas próprias é fechamento
  -- lógico, exceto quando a frota foi removida (suspensão, sem conclusão).
  for v_existing in
    select l.*
      from public.lavagem_lubrificacao l
     where l.pcm_chave is not null
  loop
    if v_existing.pcm_chave = any(v_seen)
       or v_existing.frota = 'SEM-FROTA' then
      continue;
    end if;

    select exists (
      select 1 from public.apoio_frotas f
       where f.frota = v_existing.frota and f.frota <> 'SEM-FROTA'
    ) into v_fleet_exists;

    if not v_fleet_exists then
      if not coalesce(v_existing.pcm_suspenso, false) then
        update public.lavagem_lubrificacao
           set pcm_suspenso = true,
               pcm_encerrado_em = null,
               data_realizada = null,
               pcm_motivo_encerramento = 'Frota removida do Apoio',
               pcm_ultima_sinc = v_now
         where id = v_existing.id;
        perform public.pcm_log_event(v_existing.pcm_chave, 'SUSPEND', v_existing.tipo, null,
          jsonb_build_object('motivo', 'Frota removida do Apoio'));
      end if;
    elsif not coalesce(v_existing.pcm_suspenso, false)
      and v_existing.status <> 'ENCERRADO' then
      update public.lavagem_lubrificacao
         set status = 'ENCERRADO',
             data_realizada = null,
             pcm_encerrado_em = v_now,
             pcm_motivo_encerramento = 'Ausente no snapshot Apoio',
             observacao = left(
               coalesce(nullif(v_existing.observacao, ''), 'OS ' || coalesce(v_existing.pcm_os, ''))
               || ' | encerrada por ausência em ' || to_char(v_now, 'YYYY-MM-DD HH24:MI'),
               1000
             ),
             pcm_ultima_sinc = v_now
       where id = v_existing.id;
      perform public.pcm_log_event(v_existing.pcm_chave, 'CLOSE', v_existing.status, 'ENCERRADO',
        jsonb_build_object('motivo', 'Ausente no snapshot Apoio'));
    end if;
  end loop;

  -- Duplicatas manuais são apenas arquivadas por metadados, depois de toda
  -- a reconciliação: nenhuma linha é apagada e nenhuma OS automática é fundida.
  perform public.arquivar_pcm_manuais_duplicados();
end;
$$;


-- A revisão não considera um manual já arquivado como duplicidade ativa.
create or replace function public.carregar_pcm_revisao()
returns jsonb
language sql security definer stable
set search_path = pg_catalog, public
as $$
with candidatos as (
  select o.chave, o.os, o.frota, o.modelo, o.setor, o.ponto, o.motivo,
         o.classe, o.narrativa, o.entrada, o.previsao, o.cd_ponto,
         coalesce(g.nome, '') as apoio,
         coalesce(c.tipo, '') as override_tipo,
         l.tipo as tipo_atual,
         public.pcm_classificar_fonte(
           o.setor, o.ponto, o.origem, o.modelo, o.motivo, o.classe,
           o.narrativa, o.cd_ponto
         ) as regra_json,
         public.pcm_parse_entrada(o.entrada) as entrada_json,
         exists (
           select 1 from public.lavagem_lubrificacao lm
            where lm.pcm_chave is null
              and lm.pcm_manual_arquivado_em is null
              and lm.frota = o.frota
              and lm.tipo = coalesce(c.tipo, public.pcm_classificar_fonte(
                o.setor, o.ponto, o.origem, o.modelo, o.motivo, o.classe,
                o.narrativa, o.cd_ponto
              ) ->> 'tipo')
              and lm.data_programada = case
                when (public.pcm_parse_entrada(o.entrada) ->> 'valida') = 'true'
                 and nullif(public.pcm_parse_entrada(o.entrada) ->> 'data', '') is not null
                then (public.pcm_parse_entrada(o.entrada) ->> 'data')::date
                else null::date
              end
              and coalesce(lm.status, '') not in ('ENCERRADO', 'CONCLUIDO', 'REALIZADO')
         ) as tem_manual
    from public.apoio_ordens o
    join public.apoio_frotas f on f.frota = o.frota and f.frota <> 'SEM-FROTA'
    left join public.apoio_grupos g on g.id = f.grupo_id
    left join public.pcm_classificacoes c on c.chave = o.chave
    left join public.lavagem_lubrificacao l on l.pcm_chave = o.chave
   where o.ativo is true
     and (c.chave is not null or public.pcm_classificar_fonte(
       o.setor, o.ponto, o.origem, o.modelo, o.motivo, o.classe, o.narrativa, o.cd_ponto
     ) ->> 'regra' <> 'fora_escopo')
), projetados as (
  select c.*,
         case
           when c.override_tipo = 'IGNORAR' then 'ignorar_override'
           when c.override_tipo <> '' then 'override_' || lower(replace(c.override_tipo, ' ', '_'))
           else c.regra_json ->> 'regra'
         end as regra,
         case
           when c.override_tipo = 'IGNORAR' then 'IGNORAR salvo; ordem pode ser resgatada'
           else nullif(concat_ws('; ',
             case when c.override_tipo = '' and c.regra_json ->> 'tipo' is null
                  then c.regra_json ->> 'motivo' end,
             case when (c.entrada_json ->> 'valida') <> 'true'
                  then c.entrada_json ->> 'motivo' end,
             case when c.tem_manual
                  then 'Duplicidade com registro manual ativo' end
           ), '')
         end as motivo_revisao
    from candidatos c
)
select jsonb_build_object(
  'rows', coalesce((
    select jsonb_agg(jsonb_build_object(
      'chave', p.chave,
      'os', p.os,
      'frota', p.frota,
      'apoio', p.apoio,
      'equipamento', p.modelo,
      'setor', p.setor,
      'ponto', p.ponto,
      'motivo', p.motivo,
      'classe', p.classe,
      'narrativa', p.narrativa,
      'entrada', p.entrada,
      'previsao', p.previsao,
      'tipo_atual', p.tipo_atual,
      'regra', p.regra,
      'motivo_revisao', p.motivo_revisao
    ) order by p.chave)
    from projetados p
  ), '[]'::jsonb),
  'sync', (
    select jsonb_build_object(
      'fonte_atualizada', s.fonte_atualizada,
      'sincronizado_em', s.sincronizado_em,
      'erro', s.erro
    ) from public.apoio_sync s where s.id = 1
  )
);
$$;


-- A leitura operacional/dashboard/exportação omite somente manuais arquivados;
-- automáticas encerradas continuam visíveis enquanto não estiverem suspensas.
create or replace function public.carregar_lavagem_programacoes()
returns jsonb
language sql security definer stable
set search_path = pg_catalog, public
as $$
  select coalesce(jsonb_agg(q.row_json order by q.data_programada nulls last, q.id), '[]'::jsonb)
    from (
      select to_jsonb(l) || jsonb_build_object(
               'pcm_grupo_id', coalesce(nullif(l.pcm_grupo_id, ''), f.grupo_id),
               'pcm_grupo_nome', coalesce(nullif(l.pcm_grupo_nome, ''), g.nome, ''),
               'apoio', coalesce(g.nome, '')
             ) as row_json,
             l.data_programada, l.id
        from public.lavagem_lubrificacao l
        left join public.apoio_frotas f on f.frota = l.frota
        left join public.apoio_grupos g on g.id = f.grupo_id
       where not coalesce(l.pcm_suspenso, false)
         and l.pcm_manual_arquivado_em is null
    ) q;
$$;


-- ---------------------------------------------------------------------------
-- Histórico completo sem limite artificial: encerradas, arquivadas e
-- suspensas. A linha é RAW lavagem_lubrificacao com os mesmos overlays de grupo
-- da fotografia operacional.
-- ---------------------------------------------------------------------------
create or replace function public.carregar_pcm_historico()
returns jsonb
language sql
security definer stable
set search_path = pg_catalog, public
as $$
  select coalesce(jsonb_agg(q.row_json order by q.detectado_em desc nulls last, q.id desc), '[]'::jsonb)
    from (
      select to_jsonb(l) || jsonb_build_object(
               'pcm_grupo_id', coalesce(nullif(l.pcm_grupo_id, ''), f.grupo_id),
               'pcm_grupo_nome', coalesce(nullif(l.pcm_grupo_nome, ''), g.nome, ''),
               'apoio', coalesce(g.nome, '')
             ) as row_json,
             coalesce(l.pcm_encerrado_em, l.pcm_manual_arquivado_em, l.created_at) as detectado_em,
             l.id
        from public.lavagem_lubrificacao l
        left join public.apoio_frotas f on f.frota = l.frota
        left join public.apoio_grupos g on g.id = f.grupo_id
       where upper(btrim(coalesce(l.status, ''))) = 'ENCERRADO'
          or l.pcm_manual_arquivado_em is not null
          or coalesce(l.pcm_suspenso, false)
    ) q;
$$;

-- ---------------------------------------------------------------------------
-- Confirmação explícita de execução. O desaparecimento da fonte nunca chama
-- esta função nem preenche data_realizada.
-- ---------------------------------------------------------------------------
create or replace function public.registrar_execucao_pcm(
  p_chave text,
  p_data date,
  p_observacao text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_chave text := nullif(btrim(coalesce(p_chave, '')), '');
  v_now timestamptz := clock_timestamp();
  v_row public.lavagem_lubrificacao%rowtype;
  v_obs text := nullif(btrim(coalesce(p_observacao, '')), '');
  v_result jsonb;
begin
  if v_chave is null then
    raise exception 'chave PCM vazia';
  end if;
  if p_data is null then
    raise exception 'data de execução obrigatória';
  end if;
  if p_data > (v_now at time zone 'America/Sao_Paulo')::date then
    raise exception 'data de execução não pode estar no futuro';
  end if;

  select l.*
    into v_row
    from public.lavagem_lubrificacao l
   where l.pcm_chave = v_chave
   for update;

  if not found then
    raise exception 'ordem PCM não encontrada';
  end if;
  if v_row.pcm_chave is null then
    raise exception 'ordem não é PCM automática';
  end if;
  if upper(btrim(coalesce(v_row.status, ''))) <> 'ENCERRADO' then
    raise exception 'ordem PCM precisa estar ENCERRADO';
  end if;

  update public.lavagem_lubrificacao
     set data_realizada = p_data,
         pcm_execucao_confirmada_em = v_now,
         observacao = case
           when v_obs is null then observacao
           else left(
             coalesce(nullif(btrim(observacao), ''), '')
             || case when btrim(coalesce(observacao, '')) = '' then '' else ' | ' end
             || 'Execução confirmada: ' || v_obs,
             1000
           )
         end
   where id = v_row.id;

  perform public.pcm_log_event(
    v_row.pcm_chave,
    'EXECUTION_CONFIRM',
    v_row.data_realizada::text,
    p_data::text,
    jsonb_build_object(
      'data', p_data,
      'observacao', coalesce(v_obs, ''),
      'confirmada_em', v_now
    )
  );

  select to_jsonb(l)
    into v_result
    from public.lavagem_lubrificacao l
   where l.id = v_row.id;

  return jsonb_build_object('ok', true, 'row', v_result);
end;
$$;

-- ---------------------------------------------------------------------------
-- Privilégios: helpers privados; somente os dois RPCs públicos novos/leitores
-- ficam disponíveis ao cliente.
-- ---------------------------------------------------------------------------
revoke execute on function public.arquivar_pcm_manuais_duplicados() from public, anon, authenticated;
revoke execute on function public.pcm_proteger_lavagem() from public, anon, authenticated;
revoke execute on function public.reconciliar_pcm() from public, anon, authenticated;
revoke execute on function public.carregar_pcm_historico() from public;
revoke execute on function public.registrar_execucao_pcm(text, date, text) from public, anon, authenticated;

grant execute on function public.carregar_pcm_historico() to anon, authenticated;
grant execute on function public.registrar_execucao_pcm(text, date, text) to anon, authenticated;
grant execute on function public.reconciliar_pcm() to service_role;

comment on column public.lavagem_lubrificacao.pcm_manual_arquivado_em is
  'Instante em que um manual ativo foi ocultado por duplicidade com automática; não é exclusão nem execução.';
comment on column public.lavagem_lubrificacao.pcm_manual_automatico_id is
  'ID determinístico da menor linha automática que justificou o arquivamento manual.';
comment on column public.lavagem_lubrificacao.pcm_execucao_confirmada_em is
  'Instante da confirmação humana explícita; pcm_encerrado_em permanece detecção de ausência.';
