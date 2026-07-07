-- =====================================================================
-- maisLEAD — Fase 1: fundação multi-tenant (README seções: Modelo de dados, #1)
-- Aditivo e idempotente. Aplicar no projeto novo (ddndpnibptrvurabacgi).
-- Não dropa nada: adiciona accounts + colunas em profiles/leads + tabelas
-- novas, faz backfill dos 160 leads existentes e liga RLS por account_id.
-- =====================================================================

-- ---------- accounts ----------
create table if not exists public.accounts (
    id uuid primary key default gen_random_uuid(),
    name text not null default 'Minha conta',
    plan text not null default 'starter',            -- starter | pro | business
    billing_cycle text not null default 'monthly',   -- monthly | yearly
    stripe_customer_id text,
    stripe_subscription_id text,
    extraction_count_month integer not null default 0,
    extraction_reset_at timestamptz not null default now(),
    created_at timestamptz not null default now(),
    constraint accounts_plan_check check (plan in ('starter','pro','business'))
);

-- ---------- profiles: vínculo com a conta + onboarding ----------
alter table public.profiles add column if not exists account_id uuid references public.accounts(id) on delete cascade;
alter table public.profiles add column if not exists account_role text not null default 'admin';  -- admin | member
alter table public.profiles add column if not exists onboarded_at timestamptz;

-- ---------- leads: campos do README (aditivo; colunas antigas preservadas) ----------
alter table public.leads add column if not exists account_id uuid references public.accounts(id) on delete cascade;
alter table public.leads add column if not exists score integer;
alter table public.leads add column if not exists source text;               -- google_maps | website | manual | import
alter table public.leads add column if not exists niche_quality integer not null default 0;  -- nq 0..10

-- ---------- searches (buscas recentes) ----------
create table if not exists public.searches (
    id uuid primary key default gen_random_uuid(),
    account_id uuid not null references public.accounts(id) on delete cascade,
    query text not null,
    location text,
    source text,                                     -- google_maps | website
    count integer not null default 0,
    created_at timestamptz not null default now()
);

-- ---------- lead_tags / lead_notes / lead_events ----------
create table if not exists public.lead_tags (
    id uuid primary key default gen_random_uuid(),
    lead_id uuid not null references public.leads(id) on delete cascade,
    tag text not null
);

create table if not exists public.lead_notes (
    id uuid primary key default gen_random_uuid(),
    lead_id uuid not null references public.leads(id) on delete cascade,
    user_id uuid references auth.users(id) on delete set null,
    body text not null,
    created_at timestamptz not null default now()
);

create table if not exists public.lead_events (
    id uuid primary key default gen_random_uuid(),
    lead_id uuid not null references public.leads(id) on delete cascade,
    account_id uuid references public.accounts(id) on delete cascade,
    type text not null,                              -- created | status_changed | tag_added | note_added | emailed | ...
    payload jsonb,
    created_at timestamptz not null default now()
);

-- ---------- integrations ----------
create table if not exists public.integrations (
    id uuid primary key default gen_random_uuid(),
    account_id uuid not null references public.accounts(id) on delete cascade,
    provider text not null,                          -- hubspot | pipedrive | rd_station | webhook | ...
    credentials_encrypted text,
    webhook_url text,
    status text not null default 'disconnected',     -- connected | disconnected
    created_at timestamptz not null default now(),
    unique (account_id, provider)
);

-- ---------- email_templates / email_campaigns ----------
create table if not exists public.email_templates (
    id uuid primary key default gen_random_uuid(),
    account_id uuid not null references public.accounts(id) on delete cascade,
    name text not null,
    subject text,
    body text,
    created_at timestamptz not null default now()
);

create table if not exists public.email_campaigns (
    id uuid primary key default gen_random_uuid(),
    account_id uuid not null references public.accounts(id) on delete cascade,
    template_id uuid references public.email_templates(id) on delete set null,
    recipient_lead_ids uuid[] not null default '{}',
    subject text,
    body text,
    status text not null default 'draft',            -- draft | scheduled | sending | sent
    scheduled_at timestamptz,
    sent_at timestamptz,
    created_at timestamptz not null default now()
);

-- ---------- função de score (DEVE bater com o front: 30/15/25/20 + nq, cap 100) ----------
create or replace function public.lead_score(
    p_phone text, p_address text, p_email text, p_website text, p_niche_quality integer
) returns integer language sql immutable as $$
    select least(100,
        (case when coalesce(btrim(p_phone),   '') <> '' then 30 else 0 end) +
        (case when coalesce(btrim(p_address), '') <> '' then 15 else 0 end) +
        (case when coalesce(btrim(p_email),   '') <> '' then 25 else 0 end) +
        (case when coalesce(btrim(p_website), '') <> '' then 20 else 0 end) +
        greatest(0, least(10, coalesce(p_niche_quality, 0)))
    );
$$;

-- helper: account_id do usuário logado (para RLS)
create or replace function public.current_account_id() returns uuid
    language sql stable security definer set search_path = public as $$
    select account_id from public.profiles where id = auth.uid();
$$;

-- ---------- BACKFILL: 1 conta por perfil existente + vínculo + leads ----------
do $$
declare r record; a uuid;
begin
    for r in select id, full_name from public.profiles where account_id is null loop
        insert into public.accounts (name) values (coalesce(r.full_name, 'Minha conta')) returning id into a;
        update public.profiles set account_id = a where id = r.id;
        update public.leads set account_id = a where user_id = r.id and account_id is null;
    end loop;
end $$;

-- normaliza source a partir do type antigo; status legado -> {new,qualified,converted}
update public.leads set source = case type
    when 'place'   then 'google_maps'
    when 'website' then 'website'
    when 'manual'  then 'manual'
    else coalesce(source, 'manual') end
where source is null;

update public.leads set status = case
    when status in ('qualified') then 'qualified'
    when status in ('converted') then 'converted'
    else 'new' end
where status is null or status not in ('new','qualified','converted');

-- calcula score dos leads existentes
update public.leads
   set score = public.lead_score(phone, address, email, website, niche_quality)
 where score is null;

-- ---------- RLS das tabelas novas (escopo por account_id) ----------
alter table public.accounts        enable row level security;
alter table public.searches        enable row level security;
alter table public.lead_tags       enable row level security;
alter table public.lead_notes      enable row level security;
alter table public.lead_events     enable row level security;
alter table public.integrations    enable row level security;
alter table public.email_templates enable row level security;
alter table public.email_campaigns enable row level security;

drop policy if exists "own account" on public.accounts;
create policy "own account" on public.accounts
    for all to authenticated
    using (id = public.current_account_id())
    with check (id = public.current_account_id());

-- macro simples: tabelas com coluna account_id
do $$
declare tbl text;
begin
    foreach tbl in array array['searches','lead_events','integrations','email_templates','email_campaigns'] loop
        execute format('drop policy if exists "account scope" on public.%I;', tbl);
        execute format($f$create policy "account scope" on public.%I
            for all to authenticated
            using (account_id = public.current_account_id())
            with check (account_id = public.current_account_id());$f$, tbl);
    end loop;
end $$;

-- lead_tags / lead_notes: escopo via lead -> account
drop policy if exists "via lead account" on public.lead_tags;
create policy "via lead account" on public.lead_tags
    for all to authenticated
    using (exists (select 1 from public.leads l where l.id = lead_id and l.account_id = public.current_account_id()))
    with check (exists (select 1 from public.leads l where l.id = lead_id and l.account_id = public.current_account_id()));

drop policy if exists "via lead account" on public.lead_notes;
create policy "via lead account" on public.lead_notes
    for all to authenticated
    using (exists (select 1 from public.leads l where l.id = lead_id and l.account_id = public.current_account_id()))
    with check (exists (select 1 from public.leads l where l.id = lead_id and l.account_id = public.current_account_id()));

-- leads: adiciona política por conta (mantém as antigas por user_id sem conflito; policies são OR)
drop policy if exists "account can view leads" on public.leads;
create policy "account can view leads" on public.leads
    for select to authenticated using (account_id = public.current_account_id());
drop policy if exists "account can modify leads" on public.leads;
create policy "account can modify leads" on public.leads
    for all to authenticated
    using (account_id = public.current_account_id())
    with check (account_id = public.current_account_id());

-- ---------- signup: criar conta automaticamente + vincular perfil ----------
create or replace function public.handle_new_user() returns trigger
    language plpgsql security definer set search_path = public as $$
declare new_account uuid;
begin
    insert into public.accounts (name)
    values (coalesce(new.raw_user_meta_data->>'full_name', 'Minha conta'))
    returning id into new_account;

    insert into public.profiles (id, full_name, account_id, account_role, trial_start_date, trial_status, subscription_type)
    values (
        new.id,
        new.raw_user_meta_data->>'full_name',
        new_account,
        'admin',
        current_timestamp,
        'active',
        'trial'
    );
    return new;
end;
$$;
