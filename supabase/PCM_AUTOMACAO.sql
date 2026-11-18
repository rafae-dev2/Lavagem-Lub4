-- PCM_AUTOMACAO.sql
-- Automação de Lavagem/Lubrificação integrada ao snapshot do Apoio.
--
-- Pré-requisito: executar APOIO_SETUP.sql e SUPABASE_SETUP.sql antes deste
-- arquivo. Este arquivo não cria cron, não cria eventos por ordem e não
-- altera o contrato público do setup do Apoio.
--
-- Princípios:
--   * apenas ordens ativas de frotas existentes em apoio_frotas entram;
--   * SEM-FROTA e frotas removidas nunca viram serviço executado;
--   * a chave automática é frota::OS e nunca duplica uma linha automática;
--   * ausência fecha com data de detecção, sem preencher data_realizada;
--   * registros manuais (pcm_chave IS NULL) permanecem intocados;
--   * escrita interna usa current_user (não auth.jwt()) e SECURITY DEFINER;
--   * snapshots antigos/iguais não alteram presença/heartbeat da ordem.

-- ---------------------------------------------------------------------------
-- Campos estruturados que a primeira versão do Apoio descartava.
-- ---------------------------------------------------------------------------
alter table public.apoio_ordens add column if not exists motivo text not null default '';
alter table public.apoio_ordens add column if not exists classe text not null default '';
alter table public.apoio_ordens add column if not exists cd_ponto text not null default '';

-- ---------------------------------------------------------------------------
-- Extensão da tabela operacional existente.
-- ---------------------------------------------------------------------------
alter table public.lavagem_lubrificacao add column if not exists pcm_chave text;
alter table public.lavagem_lubrificacao add column if not exists pcm_os text;
alter table public.lavagem_lubrificacao add column if not exists pcm_grupo_id text;
alter table public.lavagem_lubrificacao add column if not exists pcm_grupo_nome text;
alter table public.lavagem_lubrificacao add column if not exists pcm_status text;
alter table public.lavagem_lubrificacao add column if not exists pcm_entrada text;
alter table public.lavagem_lubrificacao add column if not exists pcm_previsao text;
alter table public.lavagem_lubrificacao add column if not exists pcm_narrativa text;
alter table public.lavagem_lubrificacao add column if not exists pcm_encerrado_em timestamptz;
alter table public.lavagem_lubrificacao add column if not exists pcm_motivo_encerramento text;
alter table public.lavagem_lubrificacao add column if not exists pcm_ultima_sinc timestamptz;
alter table public.lavagem_lubrificacao add column if not exists pcm_suspenso boolean not null default false;

create unique index if not exists lavagem_pcm_chave_uidx
  on public.lavagem_lubrificacao (pcm_chave)
  where pcm_chave is not null;
create index if not exists lavagem_pcm_frota_tipo_idx
  on public.lavagem_lubrificacao (frota, tipo);
create index if not exists lavagem_pcm_suspenso_idx
  on public.lavagem_lubrificacao (pcm_suspenso, pcm_chave);

-- ---------------------------------------------------------------------------
-- Override explícito e trilha de transições.
-- ---------------------------------------------------------------------------
create table if not exists public.pcm_classificacoes (
  chave text primary key,
  tipo text not null check (tipo in (
    'Lavagem / Lubrificação',
    'Lubrificação',
    'Troca de Óleo',
    'IGNORAR'
  )),
  atualizado_em timestamptz not null default clock_timestamp()
);

create table if not exists public.pcm_eventos (
  id bigserial primary key,
  chave text not null,
  evento text not null check (evento in (
    'CREATE', 'STATUS', 'RECLASSIFY', 'REOPEN', 'CLOSE', 'SUSPEND'
  )),
  de text,
  para text,
  detalhes jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default clock_timestamp()
);

create index if not exists pcm_eventos_chave_idx
  on public.pcm_eventos (chave, criado_em desc);

-- Classificação é pública somente por leitura/tela; a escrita passa pelo RPC.
alter table public.pcm_classificacoes enable row level security;
alter table public.pcm_eventos enable row level security;
drop policy if exists pcm_classificacoes_public_read on public.pcm_classificacoes;
drop policy if exists pcm_eventos_public_read on public.pcm_eventos;
create policy pcm_classificacoes_public_read
  on public.pcm_classificacoes for select to anon, authenticated using (true);
create policy pcm_eventos_public_read
  on public.pcm_eventos for select to anon, authenticated using (true);

revoke all on table public.pcm_classificacoes, public.pcm_eventos
  from public, anon, authenticated;
grant select on table public.pcm_classificacoes, public.pcm_eventos
  to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Helpers determinísticos da fonte.
-- ---------------------------------------------------------------------------
create or replace function public.pcm_fold(p_text text)
returns text
language sql immutable
set search_path = pg_catalog, public
as $$
  select translate(
    lower(btrim(coalesce($1, ''))),
    'áàâãäéèêëíìîïóòôõöúùûüç',
    'aaaaaeeeeiiiiooooouuuuc'
  );
$$;

create or replace function public.pcm_status(p_status text)
returns text
language sql immutable
set search_path = pg_catalog, public
as $$
  select case public.pcm_fold($1)
    when 'programada' then 'PROGRAMADO'
    when 'andamento' then 'ANDAMENTO'
    when 'aguardando peca' then 'PENDENTE'
    else upper(nullif(btrim(coalesce($1, '')), ''))
  end;
$$;

-- Entrada é horário de parede da fonte, não timestamptz. Exige calendário e
-- HH:MM; segundos e timezone opcional são aceitos, sem deslocar o horário.
create or replace function public.pcm_parse_entrada(p_text text)
returns jsonb
language plpgsql immutable
set search_path = pg_catalog, public
as $$
declare
  v_match text[];
  v_data date;
  v_hora integer;
  v_minuto integer;
  v_horario text;
  v_value text := btrim(coalesce(p_text, ''));
begin
  if v_value = '' then
    return jsonb_build_object('valida', false, 'motivo', 'Entrada ausente');
  end if;

  -- Grupos: ano, mês, dia, hora, minuto, trecho de segundos, segundos,
  -- timezone. A timezone é validada, mas deliberadamente não é aplicada:
  -- Entrada é o horário de parede informado pela fonte.
  v_match := regexp_match(
    v_value,
    '^([0-9]{4})-([0-9]{2})-([0-9]{2})[T ]([0-9]{2}):([0-9]{2})(:([0-9]{2}))?(Z|[+-][0-9]{2}:?[0-9]{2})?$'
  );
  if v_match is null then
    return jsonb_build_object('valida', false, 'motivo', 'Entrada fora de YYYY-MM-DDTHH:MM');
  end if;

  begin
    v_data := make_date(v_match[1]::integer, v_match[2]::integer, v_match[3]::integer);
  exception when others then
    return jsonb_build_object('valida', false, 'motivo', 'Data de Entrada inválida');
  end;

  v_hora := v_match[4]::integer;
  v_minuto := v_match[5]::integer;
  if v_hora not between 0 and 23 or v_minuto not between 0 and 59 then
    return jsonb_build_object('valida', false, 'motivo', 'Horário de Entrada inválido');
  end if;
  if v_match[8] is not null and v_match[8] <> 'Z'
     and v_match[8] !~ '^[+-]([01][0-9]|2[0-3]):?[0-5][0-9]$' then
    return jsonb_build_object('valida', false, 'motivo', 'Timezone de Entrada inválida');
  end if;
  if v_match[7] is not null and v_match[7]::integer not between 0 and 59 then
    return jsonb_build_object('valida', false, 'motivo', 'Segundos de Entrada inválidos');
  end if;
  v_horario := lpad(v_hora::text, 2, '0') || ':' || lpad(v_minuto::text, 2, '0');
  return jsonb_build_object(
    'valida', true,
    'data', v_data::text,
    'horario', v_horario,
    'motivo', null
  );
end;
$$;

-- O ponto 99/Lavador é LAVADOR; os demais pontos (inclusive Comboio) são
-- compatíveis com o valor legado CAMPO.
create or replace function public.pcm_local(p_ponto text, p_cd_ponto text)
returns text
language sql immutable
set search_path = pg_catalog, public
as $$
  select case
    when btrim(coalesce(p_cd_ponto, '')) in ('99', '099')
      or public.pcm_fold(p_ponto) like '%lavador%'
      then 'LAVADOR'
    else 'CAMPO'
  end;
$$;

-- Plano numérico terminado em LUB identifica troca de óleo conforme regra operacional.
-- Setor/ponto com Lubrificação isolado não classifica; preventiva sem LUB fica em revisão.
create or replace function public.pcm_classificar_fonte(
  p_setor text,
  p_ponto text,
  p_origem text,
  p_modelo text,
  p_motivo text,
  p_classe text,
  p_narrativa text,
  p_cd_ponto text
)
returns jsonb
language plpgsql immutable
set search_path = pg_catalog, public
as $$
declare
  -- Keywords só vêm de motivo/classe/narrativa. Setor e ponto são contexto;
  -- modelo/origem nunca podem transformar preventiva genérica em serviço.
  v_indicadores text := public.pcm_fold(concat_ws(' ', p_motivo, p_classe, p_narrativa));
  v_contexto text := public.pcm_fold(concat_ws(' ', p_setor, p_ponto, p_cd_ponto));
  v_lavador boolean := public.pcm_local(p_ponto, p_cd_ponto) = 'LAVADOR';
begin
  -- Plano explícito é evidência suficiente, independentemente do ponto.
  -- Somente campos de serviço; Lubrificação no setor não é código LUB.
  -- Exemplos: 302LUB, 1812LUB, 20.004LUB e 20004 LUB.
  if v_indicadores ~ '(^|[^[:alnum:]_.])[0-9]+([.][0-9]+)*[[:space:]]*lub\M' then
    return jsonb_build_object(
      'tipo', 'Troca de Óleo',
      'regra', 'plano_lub_troca_oleo',
      'motivo', null
    );
  end if;

  if not v_lavador and v_contexto !~ '\m(lubrifica|comboio)' then
    return jsonb_build_object('tipo', null, 'regra', 'fora_escopo', 'motivo', null);
  end if;

  -- A expressão exige "troca(r) ... óleo"; portanto não casa com
  -- "trocar tampa do óleo" nem com "trocarregistradora".
  if v_indicadores ~ '\m(troca|trocar)([[:space:]]+(de|do))?[[:space:]]+oleo\M' then
    return jsonb_build_object(
      'tipo', 'Troca de Óleo',
      'regra', 'troca_oleo_explicita',
      'motivo', null
    );
  end if;

  if v_lavador and v_indicadores ~ '604[[:space:]]*(lub|/302)' then
    return jsonb_build_object(
      'tipo', 'Troca de Óleo',
      'regra', 'plano_604_lub_lavador',
      'motivo', null
    );
  end if;

  if v_indicadores ~ '\m(lavagem|lavar)\M'
     or (
       v_contexto ~ '\mlavador\M'
       and v_indicadores ~ '\m(limpeza|higieniza)\M'
       and v_indicadores !~ '\m(conserto|regulagem|reparo|ajuste)\M'
     ) then
    return jsonb_build_object(
      'tipo', 'Lavagem / Lubrificação',
      'regra', 'lavagem_explicita',
      'motivo', null
    );
  end if;

  if v_indicadores ~ '\m(lubrifica|graxa|engrax)' then
    return jsonb_build_object(
      'tipo', 'Lubrificação',
      'regra', 'lubrificacao_explicita',
      'motivo', null
    );
  end if;

  return jsonb_build_object(
    'tipo', null,
    'regra', 'revisao_ambigua',
    'motivo', 'Classificação ambígua; preventiva sem plano conhecido ou texto insuficiente'
  );
end;
$$;

create or replace function public.pcm_log_event(
  p_chave text,
  p_evento text,
  p_de text default null,
  p_para text default null,
  p_detalhes jsonb default '{}'::jsonb
)
returns void
language plpgsql security definer
set search_path = pg_catalog, public
as $$
begin
  insert into public.pcm_eventos (chave, evento, de, para, detalhes)
  values (p_chave, p_evento, p_de, p_para, coalesce(p_detalhes, '{}'::jsonb));
end;
$$;

-- ---------------------------------------------------------------------------
-- Proteção da tabela operacional. Registros manuais continuam editáveis;
-- linhas pcm_chave só podem ser alteradas por service_role/owner interno.
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
    ) then
      raise exception 'ordem PCM automática só pode ser criada pelo servidor';
    end if;
    return new;
  end if;

  if old.pcm_chave is null then
    if not v_interno and (
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
-- Reconciliador. É chamado por triggers de snapshot/cadastro e também pelo
-- RPC de classificação. O lock é reentrante na mesma transação do snapshot.
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
end;
$$;

-- ---------------------------------------------------------------------------
-- Triggers: somente avanço de fonte dispara importação; cadastro de frota/
-- grupo dispara override de classificação/nome. Não há trigger por ordem.
-- ---------------------------------------------------------------------------
create or replace function public.pcm_trg_fonte_avancou()
returns trigger
language plpgsql security definer
set search_path = pg_catalog, public
as $$
begin
  if (old.fonte_atualizada is null and new.fonte_atualizada is not null)
     or (old.fonte_atualizada is not null and new.fonte_atualizada is not null
         and new.fonte_atualizada > old.fonte_atualizada) then
    perform public.reconciliar_pcm();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_pcm_fonte_avancou on public.apoio_sync;
create trigger trg_pcm_fonte_avancou
after update of fonte_atualizada on public.apoio_sync
for each row
when (
  (old.fonte_atualizada is null and new.fonte_atualizada is not null)
  or (old.fonte_atualizada is not null and new.fonte_atualizada is not null
      and new.fonte_atualizada > old.fonte_atualizada)
)
execute function public.pcm_trg_fonte_avancou();

create or replace function public.pcm_trg_cadastro_mudou()
returns trigger
language plpgsql security definer
set search_path = pg_catalog, public
as $$
begin
  perform public.reconciliar_pcm();
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_pcm_frotas_reconciliar on public.apoio_frotas;
create trigger trg_pcm_frotas_reconciliar
after insert or update or delete on public.apoio_frotas
for each row execute function public.pcm_trg_cadastro_mudou();

drop trigger if exists trg_pcm_grupos_reconciliar on public.apoio_grupos;
create trigger trg_pcm_grupos_reconciliar
after insert or update or delete on public.apoio_grupos
for each row execute function public.pcm_trg_cadastro_mudou();

-- ---------------------------------------------------------------------------
-- RPC de classificação. AUTO remove o override e recalcula a regra padrão.
-- A própria função valida frota cadastrada + ordem ativa; não confia em JWT.
-- ---------------------------------------------------------------------------
create or replace function public.classificar_ordem_pcm(p_chave text, p_tipo text)
returns jsonb
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  v_tipo text := nullif(btrim(coalesce(p_tipo, '')), '');
  v_exists boolean;
  v_saved text;
begin
  if btrim(coalesce(p_chave, '')) = '' then
    raise exception 'chave PCM vazia';
  end if;
  if v_tipo is not null and v_tipo not in (
    'AUTO', 'Lavagem / Lubrificação', 'Lubrificação', 'Troca de Óleo', 'IGNORAR'
  ) then
    raise exception 'tipo PCM inválido';
  end if;

  select exists (
    select 1
      from public.apoio_ordens o
      join public.apoio_frotas f on f.frota = o.frota
     where o.chave = btrim(p_chave)
       and o.ativo is true
       and o.frota <> 'SEM-FROTA'
  ) into v_exists;
  if not v_exists then
    raise exception 'ordem PCM não é ativa ou não pertence a frota do Apoio';
  end if;

  if v_tipo is null or v_tipo = 'AUTO' then
    delete from public.pcm_classificacoes where chave = btrim(p_chave);
    v_saved := null;
  else
    insert into public.pcm_classificacoes (chave, tipo, atualizado_em)
    values (btrim(p_chave), v_tipo, clock_timestamp())
    on conflict (chave) do update
      set tipo = excluded.tipo,
          atualizado_em = excluded.atualizado_em
      where public.pcm_classificacoes.tipo is distinct from excluded.tipo;
    v_saved := v_tipo;
  end if;

  perform public.reconciliar_pcm();
  return jsonb_build_object('ok', true, 'chave', btrim(p_chave), 'tipo', v_saved);
end;
$$;

-- ---------------------------------------------------------------------------
-- Leitura da fila: todos os candidatos próprios ativos, inclusive bons,
-- IGNORAR e classificados. O consumidor filtra motivo_revisao quando quiser.
-- ---------------------------------------------------------------------------
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

-- Fotografia completa para o leitor atual: manuais e automáticas não
-- suspensas, sem limite artificial de 1.000 linhas. Grupo manual é resolvido
-- pelo cadastro de frota quando disponível.
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
    ) q;
$$;

-- ---------------------------------------------------------------------------
-- Substituição do aplicador do Apoio. Mantém todos os guards originais e
-- acrescenta campos estruturados. Snapshot igual faz backfill somente das
-- linhas presentes/ativas, sem mexer em presença, primeira/última vista ou
-- ausências; snapshot antigo não toca nos dados.
-- ---------------------------------------------------------------------------
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
  v_motivo text;
  v_classe text;
  v_cd_ponto text;
begin
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

  select s.fonte_atualizada into v_existing
    from public.apoio_sync s where s.id = 1 for update;

  -- Igual: estrutura nova pode estar chegando pela primeira vez. Backfill
  -- somente a ordem ativa que aparece no payload; não aplica presença.
  if v_existing is not null and v_atualizado = v_existing then
    for v_row in select value from pg_catalog.jsonb_array_elements(v_ordens)
    loop
      v_os := pg_catalog.btrim(coalesce(v_row ->> 'os', ''));
      v_frota := pg_catalog.btrim(coalesce(v_row ->> 'eq', ''));
      v_chave := v_frota || '::' || v_os;
      v_motivo := coalesce(v_row ->> 'motivo', '');
      v_classe := coalesce(v_row ->> 'classe', '');
      v_cd_ponto := coalesce(v_row ->> 'cdPonto', v_row ->> 'cd_ponto', '');
      update public.apoio_ordens
         set motivo = case when btrim(v_motivo) <> '' and btrim(coalesce(motivo, '')) = ''
                           then v_motivo else motivo end,
             classe = case when btrim(v_classe) <> '' and btrim(coalesce(classe, '')) = ''
                           then v_classe else classe end,
             cd_ponto = case when btrim(v_cd_ponto) <> '' and btrim(coalesce(cd_ponto, '')) = ''
                             then v_cd_ponto else cd_ponto end
       where chave = v_chave and ativo is true;
    end loop;

    update public.apoio_sync
       set consultado_em = v_now,
           sincronizado_em = v_now,
           consulta_em_andamento = false,
           erro = null
     where id = 1;
    perform public.reconciliar_pcm();
    return pg_catalog.jsonb_build_object(
      'aplicado', false,
      'motivo', 'snapshot igual; campos estruturados atualizados',
      'total', v_total,
      'atualizado', v_atualizado
    );
  end if;

  -- Mais antigo: não há backfill nem alteração de ordens.
  if v_existing is not null and v_atualizado < v_existing then
    update public.apoio_sync
       set consultado_em = v_now,
           sincronizado_em = v_now,
           consulta_em_andamento = false,
           erro = null
     where id = 1;
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
    v_motivo := coalesce(v_row ->> 'motivo', '');
    v_classe := coalesce(v_row ->> 'classe', '');
    v_cd_ponto := coalesce(v_row ->> 'cdPonto', v_row ->> 'cd_ponto', '');

    insert into public.apoio_ordens as existing (
      chave, os, frota, modelo, grupo_fonte, setor, ponto, origem,
      prestador, status, entrada, previsao, narrativa, motivo, classe,
      cd_ponto, ativo, primeira_vista, ultima_vista, ausente_desde
    ) values (
      v_chave, v_os, v_frota, coalesce(v_row ->> 'modelo', ''),
      coalesce(v_row ->> 'grupo', ''), coalesce(v_row ->> 'setor', ''),
      coalesce(v_row ->> 'ponto', ''), coalesce(v_row ->> 'origem', ''),
      coalesce(v_row ->> 'prestador', ''), coalesce(v_row ->> 'status', ''),
      coalesce(v_row ->> 'entrada', ''), coalesce(v_row ->> 'prev', ''),
      coalesce(v_row ->> 'narrativa', ''), v_motivo, v_classe, v_cd_ponto,
      true, v_now, v_now, null
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
      motivo = excluded.motivo,
      classe = excluded.classe,
      cd_ponto = excluded.cd_ponto,
      ativo = true,
      primeira_vista = coalesce(existing.primeira_vista, excluded.primeira_vista),
      ultima_vista = excluded.ultima_vista,
      ausente_desde = null;
  end loop;

  update public.apoio_ordens o
     set ativo = false,
         ausente_desde = coalesce(o.ausente_desde, v_now)
   where o.ativo is true
     and not (o.chave = any(v_keys))
     and not exists (
       select 1 from pg_catalog.jsonb_array_elements(v_ordens) incomplete
        where incomplete ->> 'eq' = 'SEM-FROTA' and incomplete ->> 'os' = o.os
     );

  insert into public.apoio_sync (
    id, fonte_atualizada, consultado_em, sincronizado_em, total, erro
  ) values (1, v_atualizado, v_now, v_now, v_total, null)
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

-- Segurança e contrato dos RPCs. O replace acima preserva o nome usado por
-- concluir_apoio_sync, e o cron já existente continua sendo o único cron.
revoke execute on function public.reconciliar_pcm() from public, anon, authenticated;
revoke execute on function public.pcm_log_event(text,text,text,text,jsonb) from public, anon, authenticated;
revoke execute on function public.pcm_classificar_fonte(text,text,text,text,text,text,text,text) from public, anon, authenticated;
revoke execute on function public.pcm_parse_entrada(text) from public, anon, authenticated;
revoke execute on function public.pcm_local(text,text) from public, anon, authenticated;
revoke execute on function public.pcm_status(text) from public, anon, authenticated;
revoke execute on function public.pcm_fold(text) from public, anon, authenticated;
revoke execute on function public.pcm_proteger_lavagem() from public, anon, authenticated;
revoke execute on function public.pcm_trg_fonte_avancou() from public, anon, authenticated;
revoke execute on function public.pcm_trg_cadastro_mudou() from public, anon, authenticated;
revoke execute on function public.aplicar_apoio_snapshot(jsonb) from public, anon, authenticated;
revoke execute on function public.classificar_ordem_pcm(text,text) from public, anon, authenticated;
revoke execute on function public.carregar_pcm_revisao() from public, anon, authenticated;
revoke execute on function public.carregar_lavagem_programacoes() from public, anon, authenticated;

grant execute on function public.classificar_ordem_pcm(text,text) to anon, authenticated;
grant execute on function public.carregar_pcm_revisao() to anon, authenticated;
grant execute on function public.carregar_lavagem_programacoes() to anon, authenticated;
grant execute on function public.aplicar_apoio_snapshot(jsonb) to service_role;
grant execute on function public.reconciliar_pcm() to service_role;

comment on table public.pcm_classificacoes is 'Overrides públicos de classificação PCM, escritos somente pelo RPC validado.';
comment on table public.pcm_eventos is 'Auditoria de criação, status, reclassificação, reabertura, fechamento e suspensão PCM.';
comment on column public.lavagem_lubrificacao.pcm_chave is 'Chave automática frota::OS; NULL identifica registro manual.';
comment on column public.lavagem_lubrificacao.pcm_suspenso is 'Oculta da leitura PCM sem apagar histórico ou alegar conclusão.';
