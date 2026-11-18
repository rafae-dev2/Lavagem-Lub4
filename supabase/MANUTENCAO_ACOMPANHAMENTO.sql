-- Revisão 08/11/2026: acompanhamento de manutenção, somente leitura.
-- Não reexecutar APOIO_SETUP/PCM_AUTOMACAO para instalar esta revisão.
-- Preserva as ordens brutas, a sincronização e as políticas RLS existentes.

create or replace view public.manutencao_acompanhamento_ordens
with (security_invoker = true)
as
with base as (
  select o.chave, o.os, o.frota, o.modelo, o.grupo_fonte, o.setor,
         o.ponto, o.origem, o.prestador, o.status, o.entrada, o.previsao,
         o.narrativa, o.ativo, o.primeira_vista, o.ultima_vista,
         o.ausente_desde, o.motivo, o.classe, o.cd_ponto,
         regexp_replace(translate(lower(btrim(coalesce(o.status,''))),
           'áàâãéèêíìîóòôõúùûç', 'aaaaeeeiiioooouuuc'), '[^a-z0-9]+', ' ', 'g') as status_normalizado,
         (o.ativo is false and o.primeira_vista is not null and o.ultima_vista is not null
          and o.ausente_desde is not null and o.primeira_vista <= o.ultima_vista
          and o.ultima_vista <= o.ausente_desde) as saida_validada
    from public.apoio_ordens o
), classificada as (
  select b.*,
         (btrim(b.status_normalizado) in ('encerrado','encerrada','concluido','concluida',
            'realizado','realizada','fechado','fechada')) as encerrada_fonte
    from base b
)
select chave, os, frota, modelo, grupo_fonte, setor, ponto, origem, prestador,
       status, entrada, previsao, narrativa, ativo, primeira_vista, ultima_vista,
       ausente_desde, motivo, classe, cd_ponto,
       case
         when encerrada_fonte or saida_validada then 'encerrado'
         when ativo is false then 'ausente'
         when btrim(status_normalizado) in ('andamento','em andamento','em execucao') then 'andamento'
         when btrim(status_normalizado) in ('programado','programada','agendado','agendada') then 'programado'
         else 'outros'
       end as status_acompanhamento,
       case when encerrada_fonte then 'fonte'
            when saida_validada then 'ausencia'
            else null end as encerramento_origem,
       case when saida_validada then ausente_desde
            else null end as encerramento_detectado_em
  from classificada;

revoke all on public.manutencao_acompanhamento_ordens from public;
grant select on public.manutencao_acompanhamento_ordens to anon, authenticated, service_role;
comment on view public.manutencao_acompanhamento_ordens is
  'Leitura com RLS: saída comprovada de snapshot válido encerra operacionalmente; status bruto e execução real não são sobrescritos.';

create or replace function public.carregar_acompanhamento_manutencao()
returns jsonb
language sql stable security invoker
set search_path = pg_catalog, public
as $$
  select jsonb_build_object(
    'groups', coalesce((select jsonb_agg(to_jsonb(g) order by g.nome) from public.apoio_grupos g), '[]'::jsonb),
    'fleets', coalesce((select jsonb_agg(to_jsonb(f) order by f.frota) from public.apoio_frotas f), '[]'::jsonb),
    'orders', coalesce((select jsonb_agg(to_jsonb(o) order by o.chave) from public.manutencao_acompanhamento_ordens o), '[]'::jsonb),
    'sync', (select to_jsonb(s) from public.apoio_sync s where s.id=1),
    'role', 'admin',
    'tracking_rule', 'saida_fonte_encerrada_v1'
  );
$$;
revoke execute on function public.carregar_acompanhamento_manutencao() from public;
grant execute on function public.carregar_acompanhamento_manutencao() to anon, authenticated, service_role;
comment on function public.carregar_acompanhamento_manutencao() is
  'Fotografia atômica dos acompanhamentos; SECURITY INVOKER respeita permissões e RLS da fonte.';

-- Correção pontual do aviso function_search_path_mutable, sem mudar a função.
alter function public.set_updated_at() set search_path = pg_catalog, public;
