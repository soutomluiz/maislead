-- Cadastro manual de clientes pelo admin (contas não-pagantes: tester/cortesia/parceiro/interno)
-- kind: tipo da conta manual (null = conta normal/pagante)
-- active: liga/desliga da conta pelo admin (toggle na lista de clientes)
-- created_by: user_id do admin que criou a conta manualmente
-- cnpj: CNPJ informado no cadastro manual
alter table public.accounts add column if not exists kind text;
alter table public.accounts add column if not exists active boolean not null default true;
alter table public.accounts add column if not exists created_by uuid;
alter table public.accounts add column if not exists cnpj text;

do $$ begin
  alter table public.accounts add constraint accounts_kind_check
    check (kind is null or kind in ('tester','cortesia','parceiro','interno'));
exception when duplicate_object then null; end $$;
