-- Módulo de Integrações está "Em breve" (os 10 CRMs não conectam de verdade ainda).
-- Esta tabela registra quem clicou em "Avisar quando disponível" em cada integração.
-- Cada usuário só insere/vê o próprio registro (RLS). Dedupe por (user_id, integration_name).

create table if not exists public.integration_interest (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid references public.accounts(id) on delete cascade,
  integration_name text not null,
  created_at timestamptz not null default now(),
  unique (user_id, integration_name)
);

create index if not exists idx_integration_interest_name
  on public.integration_interest (integration_name);

alter table public.integration_interest enable row level security;

-- cada usuário só insere para si mesmo
drop policy if exists integration_interest_own_insert on public.integration_interest;
create policy integration_interest_own_insert
  on public.integration_interest for insert to authenticated
  with check (user_id = auth.uid());

-- cada usuário só enxerga os próprios registros
drop policy if exists integration_interest_own_select on public.integration_interest;
create policy integration_interest_own_select
  on public.integration_interest for select to authenticated
  using (user_id = auth.uid());
