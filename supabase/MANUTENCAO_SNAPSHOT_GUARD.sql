-- Migração incremental sobre a instalação PCM existente. Não apaga dados.
-- Guard explícito antes do aplicador: metadados obrigatórios omitidos não
-- podem ser interpretados como saída da fonte. Previsão pode ser null.
-- A função core mantém as proteções de token, timestamp, chave e SEM-FROTA.

alter function public.aplicar_apoio_snapshot(jsonb) rename to aplicar_apoio_snapshot_core_v20261108;
revoke execute on function public.aplicar_apoio_snapshot_core_v20261108(jsonb) from public, anon, authenticated;
grant execute on function public.aplicar_apoio_snapshot_core_v20261108(jsonb) to service_role;

create function public.aplicar_apoio_snapshot(p_payload jsonb)
returns jsonb
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  v_row jsonb;
  v_field text;
  v_payload jsonb;
  v_orders jsonb;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('apoio:sync:claim'));
  if p_payload is null or jsonb_typeof(p_payload)<>'object'
     or jsonb_typeof(p_payload->'ordens') is distinct from 'array' then
    raise exception 'snapshot Apoio inválido: payload/ordens incompleto';
  end if;
  for v_row in select value from jsonb_array_elements(p_payload->'ordens') loop
    if jsonb_typeof(v_row) is distinct from 'object' then
      raise exception 'snapshot Apoio inválido: ordem não é objeto';
    end if;
    foreach v_field in array array['os','eq','modelo','grupo','setor','ponto','origem','prestador','status','entrada','prev','narrativa'] loop
      if not (v_row ? v_field) then
        raise exception 'snapshot Apoio inválido: campo obrigatório % omitido', v_field;
      end if;
      if v_row->v_field = 'null'::jsonb and v_field not in ('eq','prev','prestador') then
        raise exception 'snapshot Apoio inválido: campo obrigatório % nulo', v_field;
      end if;
      if jsonb_typeof(v_row->v_field) not in ('string','number','boolean','null') then
        raise exception 'snapshot Apoio inválido: tipo inválido em %', v_field;
      end if;
    end loop;
  end loop;

  -- Campos estruturados são opcionais em fontes antigas. Se vierem vazios,
  -- preserve o último conteúdo conhecido; não apague a classificação.
  select coalesce(jsonb_agg(r.value || jsonb_build_object(
    'motivo', coalesce(nullif(btrim(r.value->>'motivo'),''), o.motivo,''),
    'classe', coalesce(nullif(btrim(r.value->>'classe'),''), o.classe,''),
    'cdPonto', coalesce(nullif(btrim(coalesce(r.value->>'cdPonto',r.value->>'cd_ponto')),''), o.cd_ponto,'')
  ) order by r.ordinality), '[]'::jsonb)
  into v_orders
  from jsonb_array_elements(p_payload->'ordens') with ordinality r(value,ordinality)
  left join public.apoio_ordens o on o.chave = coalesce(nullif(btrim(r.value->>'eq'),''),'SEM-FROTA') || '::' || btrim(r.value->>'os');
  v_payload := jsonb_set(p_payload, '{ordens}', v_orders);
  return public.aplicar_apoio_snapshot_core_v20261108(v_payload);
end;
$$;
revoke execute on function public.aplicar_apoio_snapshot(jsonb) from public, anon, authenticated;
grant execute on function public.aplicar_apoio_snapshot(jsonb) to service_role;
comment on function public.aplicar_apoio_snapshot(jsonb) is
  'Aplicador guardado: snapshot incompleto é rejeitado atomicamente; preserva último motivo/classe/ponto quando campos opcionais estão ausentes.';
