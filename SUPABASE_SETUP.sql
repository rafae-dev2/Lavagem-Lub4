-- ============================================================
-- BRANCO PERES — Setup Supabase para Lavagem e Lubrificação
-- ============================================================
-- Execute este SQL no SQL Editor do seu projeto Supabase:
-- https://app.supabase.com/project/qcpnnyqzosnomvvytmfi/sql
-- ============================================================

-- 1) Criar a tabela principal de programações
create table if not exists public.lavagem_lubrificacao (
  id             bigserial primary key,
  frota          text not null,
  local          text not null default 'LAVADOR',
  tipo           text not null default 'Lavagem / Lubrificação',
  data_programada date,
  horario        text,          -- "HH:MM"
  status         text not null default 'PENDENTE',
  data_realizada date,
  observacao     text default '',
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

-- 2) Índices úteis
create index if not exists idx_lavagem_frota          on public.lavagem_lubrificacao (frota);
create index if not exists idx_lavagem_status         on public.lavagem_lubrificacao (status);
create index if not exists idx_lavagem_data_prog      on public.lavagem_lubrificacao (data_programada);
create index if not exists idx_lavagem_created_at     on public.lavagem_lubrificacao (created_at);

-- 3) Trigger para atualizar updated_at automaticamente
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_lavagem_set_updated_at on public.lavagem_lubrificacao;
create trigger trg_lavagem_set_updated_at
  before update on public.lavagem_lubrificacao
  for each row execute function public.set_updated_at();

-- 4) Desativar RLS (app interno — sem segurança)
alter table public.lavagem_lubrificacao disable row level security;

-- 5) TEMPO REAL (Supabase Realtime) — atualização INSTANTÂNEA entre aparelhos
--    Sem esta linha, o app ainda atualiza sozinho a cada 15s (rede de
--    segurança). COM esta linha, a mudança de status aparece na hora em
--    todos os aparelhos abertos.
--    Alternativa pelo painel: Database → Replication → publicação
--    "supabase_realtime" → marcar a tabela lavagem_lubrificacao.
alter publication supabase_realtime add table public.lavagem_lubrificacao;

-- ============================================================
-- Pronto! Após rodar este script:
--   • A tabela public.lavagem_lubrificacao existe
--   • O app já se conecta usando a ANON KEY informada
--   • Sem restrições de segurança (RLS off)
--   • Tempo real LIGADO (status muda na hora em todos os aparelhos)
-- ============================================================
