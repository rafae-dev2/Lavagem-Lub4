-- PCM_EDICAO_PREMIUM.sql
--
-- Migração incremental: executar somente depois de
-- PCM_AUTOMACAO.sql e PCM_HISTORICO.sql.
-- Não altera os arquivos SQL anteriores.
--
-- Contrato desta camada:
--   * edição pública somente pela RPC editar_programacao_pcm;
--   * identidade PCM (frota, OS, pcm_chave, grupo e metadados de fonte) é
--     somente leitura para o cliente;
--   * overrides de negócio ficam em pcm_edicao_campos e sobrevivem ao sync;
--   * ausência em snapshot válido encerra e grava a data local da detecção;
--   * erro de sync e frota removida nunca são tratados como encerramento;
--   * pcm_execucao_confirmada_em continua reservado à confirmação humana
--     explícita e nunca é preenchido por esta camada.

-- ---------------------------------------------------------------------------
-- Metadados de edição. A coluna JSON guarda somente os campos de negócio
-- fornecidos pela RPC; NULL em data_realizada é um override explícito.
-- ---------------------------------------------------------------------------
alter table public.lavagem_lubrificacao
  add column if not exists pcm_edicao_campos jsonb not null default '{}'::jsonb;
alter table public.lavagem_lubrificacao
  add column if not exists pcm_editado_em timestamptz;

alter table public.lavagem_lubrificacao
  alter column pcm_edicao_campos set default '{}'::jsonb;

update public.lavagem_lubrificacao
   set pcm_edicao_campos = '{}'::jsonb
 where pcm_edicao_campos is null;

alter table public.lavagem_lubrificacao
  alter column pcm_edicao_campos set not null;

create index if not exists lavagem_pcm_editado_idx
  on public.lavagem_lubrificacao (pcm_editado_em, id)
  where pcm_editado_em is not null;

comment on column public.lavagem_lubrificacao.pcm_edicao_campos is
  'Overrides de negócio editados pela RPC premium; não contém frota, OS, chave, grupo ou metadados de fonte.';
comment on column public.lavagem_lubrificacao.pcm_editado_em is
  'Instante da última edição premium aceita; não é instante de sincronização nem confirmação de execução.';

-- ---------------------------------------------------------------------------
-- Backfill conservador: somente PCM já encerradas pelo ciclo de ausência,
-- sem data realizada e sem override explícito (inclusive NULL) para a data.
-- Nenhuma confirmação humana é alterada.
-- ---------------------------------------------------------------------------
update public.lavagem_lubrificacao
   set data_realizada = (pcm_encerrado_em at time zone 'America/Sao_Paulo')::date
 where pcm_chave is not null
   and upper(btrim(coalesce(status, ''))) = 'ENCERRADO'
   and pcm_encerrado_em is not null
   and data_realizada is null
   and pcm_execucao_confirmada_em is null
   and not (coalesce(pcm_edicao_campos, '{}'::jsonb) ? 'data_realizada');

-- ---------------------------------------------------------------------------
-- A proteção anterior continua válida e passa a cobrir os dois metadados
-- novos. Manuais continuam editáveis nos campos de negócio, mas não podem
-- forjar metadata PCM por INSERT/UPDATE direto. Automáticas continuam sem
-- UPDATE/DELETE direto para anon/authenticated.
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
      or new.pcm_edicao_campos is distinct from '{}'::jsonb
      or new.pcm_editado_em is not null
    ) then
      raise exception 'campos PCM só podem ser definidos pelo servidor';
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
      or coalesce(new.pcm_edicao_campos, '{}'::jsonb)
           is distinct from coalesce(old.pcm_edicao_campos, '{}'::jsonb)
      or new.pcm_editado_em is distinct from old.pcm_editado_em
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

-- O trigger já existe desde PCM_AUTOMACAO/PCM_HISTORICO; a recriação explícita
-- torna a proteção idempotente mesmo em bases que foram instaladas parcialmente.
drop trigger if exists trg_pcm_proteger_lavagem on public.lavagem_lubrificacao;
create trigger trg_pcm_proteger_lavagem
  before insert or update or delete on public.lavagem_lubrificacao
  for each row execute function public.pcm_proteger_lavagem();

-- ---------------------------------------------------------------------------
-- Edição pública dos campos de negócio. A ordem das travas é deliberada:
-- advisory lock da sincronização primeiro, depois FOR UPDATE na linha PCM.
-- Assim edição e reconciliação não podem observar/aplicar estados cruzados.
-- ---------------------------------------------------------------------------
create or replace function public.editar_programacao_pcm(
  p_id bigint,
  p_campos jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_row public.lavagem_lubrificacao%rowtype;
  v_result jsonb;
  v_key text;
  v_norm jsonb := '{}'::jsonb;
  v_saved jsonb;
  v_local text;
  v_tipo text;
  v_data_programada date;
  v_horario text;
  v_status text;
  v_data_realizada date;
  v_observacao text;
  v_changed boolean := false;
  v_date_text text;
  v_time_text text;
begin
  if p_id is null or p_id <= 0 then
    raise exception 'id PCM inválido';
  end if;
  if p_campos is null or pg_catalog.jsonb_typeof(p_campos) <> 'object' then
    raise exception 'campos de edição devem ser um objeto JSON';
  end if;

  -- Whitelist fechada: qualquer tentativa de alterar identidade, grupo,
  -- metadata ou frota falha antes de tocar na linha.
  for v_key in select pg_catalog.jsonb_object_keys(p_campos)
  loop
    if v_key not in (
      'local', 'tipo', 'data_programada', 'horario', 'status',
      'data_realizada', 'observacao'
    ) then
      raise exception 'campo PCM não editável: %', v_key;
    end if;
  end loop;

  if p_campos ? 'local' then
    if pg_catalog.jsonb_typeof(p_campos -> 'local') <> 'string' then
      raise exception 'local deve ser texto';
    end if;
    v_local := upper(pg_catalog.btrim(p_campos ->> 'local'));
    if v_local not in ('LAVADOR', 'CAMPO') or pg_catalog.char_length(v_local) > 20 then
      raise exception 'local PCM inválido';
    end if;
    v_norm := v_norm || pg_catalog.jsonb_build_object('local', v_local);
  end if;

  if p_campos ? 'tipo' then
    if pg_catalog.jsonb_typeof(p_campos -> 'tipo') <> 'string' then
      raise exception 'tipo deve ser texto';
    end if;
    v_tipo := pg_catalog.btrim(p_campos ->> 'tipo');
    if pg_catalog.char_length(v_tipo) > 60
       or v_tipo not in (
         'Lavagem / Lubrificação', 'Lubrificação', 'Troca de Óleo'
       ) then
      raise exception 'tipo PCM inválido';
    end if;
    v_norm := v_norm || pg_catalog.jsonb_build_object('tipo', v_tipo);
  end if;

  if p_campos ? 'data_programada' then
    if pg_catalog.jsonb_typeof(p_campos -> 'data_programada') = 'null' then
      v_data_programada := null;
    elsif pg_catalog.jsonb_typeof(p_campos -> 'data_programada') <> 'string' then
      raise exception 'data_programada deve ser YYYY-MM-DD ou null';
    else
      v_date_text := pg_catalog.btrim(p_campos ->> 'data_programada');
      if v_date_text = '' then
        v_data_programada := null;
      elsif v_date_text !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
        raise exception 'data_programada deve ser YYYY-MM-DD';
      else
        begin
          v_data_programada := v_date_text::date;
        exception when others then
          raise exception 'data_programada inválida';
        end;
      end if;
    end if;
    v_norm := v_norm || pg_catalog.jsonb_build_object('data_programada', v_data_programada);
  end if;

  if p_campos ? 'horario' then
    if pg_catalog.jsonb_typeof(p_campos -> 'horario') = 'null' then
      v_horario := null;
    elsif pg_catalog.jsonb_typeof(p_campos -> 'horario') <> 'string' then
      raise exception 'horario deve ser HH:MM ou null';
    else
      v_time_text := pg_catalog.btrim(p_campos ->> 'horario');
      if v_time_text = '' then
        v_horario := null;
      elsif v_time_text !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then
        raise exception 'horario deve ser HH:MM';
      else
        v_horario := v_time_text;
      end if;
    end if;
    v_norm := v_norm || pg_catalog.jsonb_build_object('horario', v_horario);
  end if;

  if p_campos ? 'status' then
    if pg_catalog.jsonb_typeof(p_campos -> 'status') <> 'string' then
      raise exception 'status deve ser texto';
    end if;
    v_status := upper(pg_catalog.btrim(p_campos ->> 'status'));
    if pg_catalog.char_length(v_status) > 20
       or v_status not in ('PENDENTE', 'PROGRAMADO', 'ATRASADO', 'ANDAMENTO', 'ENCERRADO') then
      raise exception 'status PCM inválido';
    end if;
    v_norm := v_norm || pg_catalog.jsonb_build_object('status', v_status);
  end if;

  if p_campos ? 'data_realizada' then
    if pg_catalog.jsonb_typeof(p_campos -> 'data_realizada') = 'null' then
      v_data_realizada := null;
    elsif pg_catalog.jsonb_typeof(p_campos -> 'data_realizada') <> 'string' then
      raise exception 'data_realizada deve ser YYYY-MM-DD ou null';
    else
      v_date_text := pg_catalog.btrim(p_campos ->> 'data_realizada');
      if v_date_text = '' then
        v_data_realizada := null;
      elsif v_date_text !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
        raise exception 'data_realizada deve ser YYYY-MM-DD';
      else
        begin
          v_data_realizada := v_date_text::date;
        exception when others then
          raise exception 'data_realizada inválida';
        end;
      end if;
    end if;
    -- O JSON mantém a chave com null: isso é um pedido explícito para deixar
    -- a data vazia e não autoriza o reconciliador a preencher outra data.
    v_norm := v_norm || pg_catalog.jsonb_build_object('data_realizada', v_data_realizada);
  end if;

  if p_campos ? 'observacao' then
    if pg_catalog.jsonb_typeof(p_campos -> 'observacao') = 'null' then
      v_observacao := '';
    elsif pg_catalog.jsonb_typeof(p_campos -> 'observacao') <> 'string' then
      raise exception 'observacao deve ser texto ou null';
    else
      v_observacao := pg_catalog.btrim(p_campos ->> 'observacao');
    end if;
    if pg_catalog.char_length(v_observacao) > 1000 then
      raise exception 'observacao excede 1000 caracteres';
    end if;
    v_norm := v_norm || pg_catalog.jsonb_build_object('observacao', v_observacao);
  end if;

  -- Mesmo contrato de lock de reconciliar_pcm: nunca esperar a linha antes
  -- de serializar com o sync.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('apoio:sync:claim'));

  select l.*
    into v_row
    from public.lavagem_lubrificacao l
   where l.id = p_id
   for update;

  if not found then
    raise exception 'programação PCM não encontrada';
  end if;
  if v_row.pcm_chave is null then
    raise exception 'a programação informada não é uma ordem PCM automática';
  end if;
  if pg_catalog.jsonb_typeof(coalesce(v_row.pcm_edicao_campos, '{}'::jsonb)) <> 'object' then
    raise exception 'metadata de edição PCM inválida';
  end if;

  v_saved := coalesce(v_row.pcm_edicao_campos, '{}'::jsonb) || v_norm;

  if p_campos ? 'local' and v_local is distinct from v_row.local then v_changed := true; end if;
  if p_campos ? 'tipo' and v_tipo is distinct from v_row.tipo then v_changed := true; end if;
  if p_campos ? 'data_programada' and v_data_programada is distinct from v_row.data_programada then v_changed := true; end if;
  if p_campos ? 'horario' and v_horario is distinct from v_row.horario then v_changed := true; end if;
  if p_campos ? 'status' and v_status is distinct from v_row.status then v_changed := true; end if;
  if p_campos ? 'data_realizada' and v_data_realizada is distinct from v_row.data_realizada then v_changed := true; end if;
  if p_campos ? 'observacao' and v_observacao is distinct from coalesce(v_row.observacao, '') then v_changed := true; end if;

  update public.lavagem_lubrificacao
     set local = case when p_campos ? 'local' then v_local else local end,
         tipo = case when p_campos ? 'tipo' then v_tipo else tipo end,
         data_programada = case when p_campos ? 'data_programada' then v_data_programada else data_programada end,
         horario = case when p_campos ? 'horario' then v_horario else horario end,
         status = case when p_campos ? 'status' then v_status else status end,
         data_realizada = case when p_campos ? 'data_realizada' then v_data_realizada else data_realizada end,
         observacao = case when p_campos ? 'observacao' then v_observacao else observacao end,
         pcm_edicao_campos = v_saved,
         pcm_editado_em = case when v_changed then v_now else pcm_editado_em end
   where id = v_row.id;

  if v_changed then
    -- STATUS é o evento compatível já permitido pela constraint histórica;
    -- detalhes identificam que a mudança foi edição e listam somente os
    -- campos fornecidos (sem criar novo tipo de evento).
    perform public.pcm_log_event(
      v_row.pcm_chave,
      'STATUS',
      v_row.status,
      case when p_campos ? 'status' then v_status else v_row.status end,
      pg_catalog.jsonb_build_object(
        'detalhe', 'edição de programação PCM',
        'origem', 'editar_programacao_pcm',
        'id', v_row.id,
        'campos', v_norm,
        'editado_em', v_now
      )
    );
  end if;

  select pg_catalog.to_jsonb(l)
    into v_result
    from public.lavagem_lubrificacao l
   where l.id = v_row.id;

  return pg_catalog.jsonb_build_object('ok', true, 'row', v_result);
end;
$$;

-- ---------------------------------------------------------------------------
-- Reconciliação premium. É uma cópia incremental da última
-- reconciliar_pcm de PCM_HISTORICO.sql, com preservação dos overrides e
-- fechamento por ausência válida. Não é executada durante a instalação.
-- ---------------------------------------------------------------------------
create or replace function public.reconciliar_pcm()
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_sync_error text;
  v_sync_source timestamptz;
  v_order record;
  v_existing public.lavagem_lubrificacao%rowtype;
  v_found boolean;
  v_class jsonb;
  v_entry jsonb;
  v_override text;
  v_edits jsonb;
  v_tipo text;
  v_regra text;
  v_motivo text;
  v_status text;
  v_fonte_status text;
  v_entry_valida boolean;
  v_local text;
  v_data date;
  v_horario text;
  v_data_realizada date;
  v_observacao text;
  v_was_suspended boolean;
  v_source_status_changed boolean;
  v_type_changed boolean;
  v_has_type_override boolean;
  v_reopened boolean;
  v_fleet_exists boolean;
  v_seen text[] := array[]::text[];
begin
  -- Mesma trava usada por claim/aplicar snapshot e pela RPC de edição.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('apoio:sync:claim'));

  -- Só uma fotografia válida pode alterar presença. Um erro ou a ausência de
  -- heartbeat não pode transformar uma falha operacional em encerramento.
  select s.erro, s.fonte_atualizada
    into v_sync_error, v_sync_source
    from public.apoio_sync s
   where s.id = 1;
  if v_sync_error is not null or v_sync_source is null then
    return;
  end if;

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
    v_seen := pg_catalog.array_append(v_seen, v_order.chave);

    select l.*
      into v_existing
      from public.lavagem_lubrificacao l
     where l.pcm_chave = v_order.chave;
    v_found := found;
    v_edits := case
      when v_found and pg_catalog.jsonb_typeof(coalesce(v_existing.pcm_edicao_campos, '{}'::jsonb)) = 'object'
        then coalesce(v_existing.pcm_edicao_campos, '{}'::jsonb)
      else '{}'::jsonb
    end;
    v_has_type_override := v_edits ? 'tipo';

    v_override := null;
    select c.tipo
      into v_override
      from public.pcm_classificacoes c
     where c.chave = v_order.chave;

    v_class := public.pcm_classificar_fonte(
      v_order.setor, v_order.ponto, v_order.origem, v_order.modelo,
      v_order.motivo, v_order.classe, v_order.narrativa, v_order.cd_ponto
    );
    v_entry := public.pcm_parse_entrada(v_order.entrada);
    v_local := public.pcm_local(v_order.ponto, v_order.cd_ponto);
    v_tipo := case
      when v_has_type_override then v_edits ->> 'tipo'
      when v_override = 'IGNORAR' then null
      when v_override is not null then v_override
      else v_class ->> 'tipo'
    end;
    v_regra := case
      when v_has_type_override then 'edicao_tipo'
      when v_override = 'IGNORAR' then 'ignorar_override'
      when v_override is not null then 'override_' || lower(replace(v_override, ' ', '_'))
      else v_class ->> 'regra'
    end;
    v_motivo := case
      when v_override = 'IGNORAR' and not v_has_type_override then 'IGNORAR salvo; ordem histórica preservada e ocultada'
      when v_tipo is null then v_class ->> 'motivo'
      else null
    end;

    v_entry_valida := v_entry ->> 'valida' = 'true'
      and nullif(v_entry ->> 'data', '') is not null
      and nullif(v_entry ->> 'horario', '') is not null;
    if v_entry_valida then
      v_data := (v_entry ->> 'data')::date;
      v_horario := nullif(v_entry ->> 'horario', '');
    else
      v_data := null;
      v_horario := null;
    end if;
    v_fonte_status := public.pcm_status(v_order.fonte_status);

    -- Classificação/entrada inválida não apaga uma linha automática já válida.
    if v_tipo is null then
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
          pg_catalog.jsonb_build_object('regra', v_regra, 'motivo', v_motivo));
      end if;
      continue;
    end if;

    if not v_entry_valida and not v_found then
      continue;
    end if;

    if v_found then
      v_was_suspended := coalesce(v_existing.pcm_suspenso, false);
      v_source_status_changed := public.pcm_status(v_existing.pcm_status)
        is distinct from v_fonte_status;

      -- Somente uma linha fechada por ausência que reaparece reabre. Um status
      -- ENCERRADO editado enquanto a fonte ainda está ativa tem motivo distinto
      -- e não pode ser reaberto a cada sincronização.
      v_reopened := v_existing.pcm_encerrado_em is not null
        and v_existing.pcm_motivo_encerramento = 'Ausente no snapshot Apoio';

      if v_reopened then
        v_edits := v_edits - 'status' - 'data_realizada';
      elsif v_source_status_changed then
        -- O status manual vale apenas até a transição real da fonte.
        v_edits := v_edits - 'status';
      end if;

      if v_edits ? 'local' then
        v_local := v_edits ->> 'local';
      end if;
      if v_edits ? 'tipo' then
        v_tipo := v_edits ->> 'tipo';
      end if;
      if v_edits ? 'data_programada' then
        begin
          v_data := nullif(v_edits ->> 'data_programada', '')::date;
        exception when others then
          v_data := case when v_entry_valida then (v_entry ->> 'data')::date else v_existing.data_programada end;
        end;
      elsif not v_entry_valida then
        v_data := v_existing.data_programada;
      end if;
      if v_edits ? 'horario' then
        v_horario := nullif(v_edits ->> 'horario', '');
      elsif not v_entry_valida then
        v_horario := v_existing.horario;
      end if;

      if v_reopened or v_source_status_changed then
        v_status := v_fonte_status;
      elsif v_edits ? 'status' then
        v_status := v_edits ->> 'status';
      else
        v_status := v_fonte_status;
      end if;

      -- NULL em data_realizada dentro de pcm_edicao_campos é intencional:
      -- nunca cair para a data automática enquanto a chave existir.
      if v_reopened then
        v_data_realizada := null;
      elsif v_edits ? 'data_realizada' then
        begin
          v_data_realizada := nullif(v_edits ->> 'data_realizada', '')::date;
        exception when others then
          v_data_realizada := v_existing.data_realizada;
        end;
      else
        v_data_realizada := v_existing.data_realizada;
      end if;

      if v_edits ? 'observacao' then
        v_observacao := v_edits ->> 'observacao';
      else
        v_observacao := v_existing.observacao;
      end if;

      -- Um status manual não é detecção de ausência. Não materializar o
      -- timestamp de saída enquanto a ordem continua ativa na fonte.
      update public.lavagem_lubrificacao
         set frota = v_order.frota,
             local = v_local,
             tipo = v_tipo,
             data_programada = v_data,
             horario = v_horario,
             status = v_status,
             data_realizada = v_data_realizada,
             observacao = v_observacao,
             pcm_os = v_order.os,
             pcm_grupo_id = v_order.grupo_id,
             pcm_grupo_nome = v_order.grupo_nome,
             pcm_status = v_order.fonte_status,
             pcm_entrada = v_order.entrada,
             pcm_previsao = v_order.previsao,
             pcm_narrativa = v_order.narrativa,
             pcm_encerrado_em = case
               when v_reopened then null
               when v_status <> 'ENCERRADO' then null
               else v_existing.pcm_encerrado_em
             end,
             pcm_motivo_encerramento = case
               when v_reopened then null
               when v_status <> 'ENCERRADO' then null
               else v_existing.pcm_motivo_encerramento
             end,
             pcm_ultima_sinc = v_now,
             pcm_suspenso = false,
             pcm_edicao_campos = v_edits,
             pcm_execucao_confirmada_em = case when v_reopened then null else pcm_execucao_confirmada_em end
       where id = v_existing.id;

      v_type_changed := v_existing.tipo is distinct from v_tipo;
      if v_type_changed and not v_has_type_override then
        perform public.pcm_log_event(v_order.chave, 'RECLASSIFY', v_existing.tipo, v_tipo,
          pg_catalog.jsonb_build_object('regra', v_regra));
      end if;
      if v_source_status_changed then
        perform public.pcm_log_event(v_order.chave, 'STATUS', v_existing.pcm_status, v_order.fonte_status,
          pg_catalog.jsonb_build_object('fonte', v_order.fonte_status));
      end if;
      if v_reopened then
        perform public.pcm_log_event(v_order.chave, 'REOPEN', 'ENCERRADO', v_status,
          pg_catalog.jsonb_build_object(
            'detalhe', 'ordem reapareceu em snapshot válido',
            'overrides_removidos', pg_catalog.jsonb_build_array('status', 'data_realizada')
          ));
      end if;
      -- v_was_suspended=true e tipo válido implica resgate de IGNORAR/frota.
    else
      insert into public.lavagem_lubrificacao (
        frota, local, tipo, data_programada, horario, status, data_realizada,
        observacao, pcm_chave, pcm_os, pcm_grupo_id, pcm_grupo_nome, pcm_status,
        pcm_entrada, pcm_previsao, pcm_narrativa, pcm_encerrado_em,
        pcm_motivo_encerramento, pcm_ultima_sinc, pcm_suspenso,
        pcm_edicao_campos, pcm_editado_em
      ) values (
        v_order.frota, v_local, v_tipo, v_data, v_horario, v_fonte_status, null,
        'OS ' || v_order.os, v_order.chave, v_order.os, v_order.grupo_id,
        v_order.grupo_nome, v_order.fonte_status, v_order.entrada, v_order.previsao,
        v_order.narrativa, null, null, v_now, false, '{}'::jsonb, null
      );
      perform public.pcm_log_event(v_order.chave, 'CREATE', null, v_tipo,
        pg_catalog.jsonb_build_object('os', v_order.os, 'frota', v_order.frota, 'regra', v_regra));
    end if;
  end loop;

  -- Ausência só fecha quando o último snapshot foi válido e a frota ainda
  -- existe. O teste de lifecycle é pcm_encerrado_em, não status: uma edição
  -- manual para ENCERRADO sem marker também recebe fechamento aqui.
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
      -- Frota removida é suspensão, nunca conclusão/ausência. Overrides e
      -- data manual permanecem, porque não houve uma transição válida.
      if not coalesce(v_existing.pcm_suspenso, false) then
        update public.lavagem_lubrificacao
           set pcm_suspenso = true,
               pcm_motivo_encerramento = 'Frota removida do Apoio',
               pcm_ultima_sinc = v_now
         where id = v_existing.id;
        perform public.pcm_log_event(v_existing.pcm_chave, 'SUSPEND', v_existing.tipo, null,
          pg_catalog.jsonb_build_object('motivo', 'Frota removida do Apoio'));
      end if;
    elsif not coalesce(v_existing.pcm_suspenso, false) then
      -- Uma ausência real encerra uma única vez. Mesmo que o status já seja
      -- ENCERRADO por edição, o marker nulo identifica a primeira detecção.
      if v_existing.pcm_encerrado_em is null
         or v_existing.pcm_motivo_encerramento is distinct from 'Ausente no snapshot Apoio' then
        v_edits := coalesce(v_existing.pcm_edicao_campos, '{}'::jsonb) - 'status';
        if v_edits ? 'data_realizada' then
          begin
            v_data_realizada := nullif(v_edits ->> 'data_realizada', '')::date;
          exception when others then
            v_data_realizada := null;
          end;
        else
          v_data_realizada := (v_now at time zone 'America/Sao_Paulo')::date;
        end if;

        update public.lavagem_lubrificacao
           set status = 'ENCERRADO',
               data_realizada = v_data_realizada,
               pcm_encerrado_em = v_now,
               pcm_motivo_encerramento = 'Ausente no snapshot Apoio',
               pcm_ultima_sinc = v_now,
               pcm_edicao_campos = v_edits
         where id = v_existing.id;
        perform public.pcm_log_event(v_existing.pcm_chave, 'CLOSE', v_existing.status, 'ENCERRADO',
          pg_catalog.jsonb_build_object(
            'motivo', 'Ausente no snapshot Apoio',
            'detectado_em', v_now,
            'data_realizada', v_data_realizada,
            'fuso', 'America/Sao_Paulo'
          ));
      else
        -- Normaliza status e remove eventual override legado sem gerar evento
        -- repetido; a data e as marcas existentes são preservadas.
        v_edits := coalesce(v_existing.pcm_edicao_campos, '{}'::jsonb) - 'status';
        update public.lavagem_lubrificacao
           set status = 'ENCERRADO',
               pcm_ultima_sinc = v_now,
               pcm_edicao_campos = v_edits
         where id = v_existing.id
           and (v_existing.status is distinct from 'ENCERRADO'
                or coalesce(v_existing.pcm_edicao_campos, '{}'::jsonb) ? 'status');
      end if;
    end if;
  end loop;
end;
$$;

-- Confirmação no histórico compartilha a mesma trava e atualiza o override
-- de data. Assim uma confirmação posterior prevalece sobre data limpa/antiga.
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

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('apoio:sync:claim'));

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
         pcm_edicao_campos = coalesce(pcm_edicao_campos, '{}'::jsonb)
           || jsonb_build_object('data_realizada', p_data),
         pcm_editado_em = v_now,
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
-- Privilégios: a RPC é o único novo caminho público. Não há grant de DML,
-- DELETE ou acesso direto a metadata nesta migração.
-- ---------------------------------------------------------------------------
revoke execute on function public.editar_programacao_pcm(bigint, jsonb)
  from public, anon, authenticated;
grant execute on function public.editar_programacao_pcm(bigint, jsonb)
  to anon, authenticated;

revoke execute on function public.reconciliar_pcm() from public, anon, authenticated;
grant execute on function public.reconciliar_pcm() to service_role;

comment on function public.editar_programacao_pcm(bigint, jsonb) is
  'Edita somente local, tipo, datas, horário, status e observação de uma linha PCM automática; identidade e metadata de fonte permanecem protegidas.';

revoke execute on function public.registrar_execucao_pcm(text, date, text) from public;
grant execute on function public.registrar_execucao_pcm(text, date, text) to anon, authenticated;
