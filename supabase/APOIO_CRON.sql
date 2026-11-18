-- APOIO_CRON.sql
-- Agendamento nativo Supabase: uma chamada por minuto, inclusive sem navegador
-- aberto. Não coloque valores secretos neste arquivo.
--
-- Antes de executar:
-- 1) habilite pg_cron, pg_net e Vault no Dashboard do Supabase;
-- 2) crie no Vault os secrets exatamente com os nomes:
--      APOIO_PROJECT_URL  = URL do projeto Supabase, sem barra final
--      APOIO_SYNC_SECRET  = o mesmo segredo configurado na Edge Function
-- 3) execute este arquivo no SQL Editor com privilégio de administrador.

-- Se as extensões já estiverem habilitadas pelo Dashboard, estes comandos são
-- idempotentes. Em projetos gerenciados, não force a criação se o Dashboard
-- for o único caminho permitido.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- Substitui um job anterior com o mesmo nome, sem criar duplicatas.
select cron.unschedule(jobid)
  from cron.job
 where jobname = 'apoio-sync-ordens';

select cron.schedule(
  'apoio-sync-ordens',
  '* * * * *',
  $apoio_job$
    select net.http_post(
      url := (
        select decrypted_secret
          from vault.decrypted_secrets
         where name = 'APOIO_PROJECT_URL'
      ) || '/functions/v1/sync-ordens',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-Sync-Secret', (
          select decrypted_secret
            from vault.decrypted_secrets
          where name = 'APOIO_SYNC_SECRET'
        )
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 30000
    );
  $apoio_job$
);

-- Verificação opcional depois de executar:
-- select jobid, jobname, schedule, active from cron.job
--  where jobname = 'apoio-sync-ordens';
-- select * from cron.job_run_details
--  where jobid = (select jobid from cron.job where jobname = 'apoio-sync-ordens')
--  order by start_time desc limit 10;
