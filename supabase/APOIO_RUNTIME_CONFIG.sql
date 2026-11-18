-- Configuração da Edge Function no Vault existente.
-- Somente service_role pode consultar valores privados usados pelo servidor.
create or replace function public.obter_apoio_runtime_config()
returns jsonb
language sql stable security definer
set search_path = pg_catalog, public
as $$
  select jsonb_build_object(
    'sync_secret', (select decrypted_secret from vault.decrypted_secrets where name='APOIO_SYNC_SECRET' limit 1),
    'allowed_origins', (select decrypted_secret from vault.decrypted_secrets where name='APOIO_ALLOWED_ORIGINS' limit 1)
  );
$$;
revoke execute on function public.obter_apoio_runtime_config() from public, anon, authenticated;
grant execute on function public.obter_apoio_runtime_config() to service_role;
