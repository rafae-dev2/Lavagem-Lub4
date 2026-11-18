-- TV_MONITOR.sql
-- Extensão incremental e não destrutiva para o monitor TV de ordens Apoio.
--
-- Pré-condições: APOIO_SETUP.sql, PCM_AUTOMACAO.sql e a publicação
-- supabase_realtime habilitada no projeto. Este arquivo não executa sync, não
-- altera linhas existentes e não substitui aplicar_apoio_snapshot().

do $$
begin
  if to_regclass('public.apoio_ordens') is null
     or to_regclass('public.apoio_sync') is null
     or to_regclass('public.apoio_grupos') is null
     or to_regclass('public.apoio_frotas') is null then
    raise exception 'TV_MONITOR requer APOIO_SETUP.sql aplicado antes';
  end if;
  if to_regclass('public.pcm_classificacoes') is null
     or to_regprocedure('public.reconciliar_pcm()') is null then
    raise exception 'TV_MONITOR requer PCM_AUTOMACAO.sql aplicado antes; não execute somente este arquivo';
  end if;
end;
$$;

alter table public.apoio_ordens add column if not exists classe text not null default '';
alter table public.apoio_ordens add column if not exists motivo text not null default '';
alter table public.apoio_ordens add column if not exists cd_ponto text not null default '';

-- carregar_apoio_controle() já usa to_jsonb(o), portanto as colunas novas
-- integram automaticamente o snapshot. A versão do aplicador continua sendo
-- a instalada por PCM_AUTOMACAO.sql e não é redefinida aqui.

do $$
declare
  publication_name constant text := 'supabase_realtime';
  table_name text;
begin
  if not exists (select 1 from pg_catalog.pg_publication where pubname = publication_name) then
    raise exception 'A publicação supabase_realtime não existe; habilite Realtime antes de TV_MONITOR.sql';
  end if;

  foreach table_name in array array['apoio_ordens', 'apoio_sync', 'apoio_grupos', 'apoio_frotas']::text[]
  loop
    if not exists (
      select 1
        from pg_catalog.pg_publication p
        join pg_catalog.pg_publication_rel pr on pr.prpubid = p.oid
       where p.pubname = publication_name
         and pr.prrelid = format('public.%s', table_name)::regclass
    ) then
      execute format('alter publication %I add table public.%I', publication_name, table_name);
    end if;
  end loop;
end;
$$;
