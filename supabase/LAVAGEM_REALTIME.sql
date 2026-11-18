-- Migração incremental: não altera registros, permissões ou RLS.
-- Aplicada em qcpnnyqzosnomvvytmfi em06/11/2026.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime'
      and schemaname='public'
      and tablename='lavagem_lubrificacao'
  ) then
    alter publication supabase_realtime add table public.lavagem_lubrificacao;
  end if;
end $$;
