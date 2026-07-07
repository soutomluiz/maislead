-- =====================================================================
-- maisLead — schema inicial (public + storage)
-- Recriado a partir do backup db_cluster-11-03-2025.
-- Rode isto em um projeto Supabase NOVO (SQL Editor ou `supabase db push`).
-- Idempotente: pode rodar mais de uma vez sem erro.
-- =====================================================================

-- ---------- Tipos (enums) ----------
do $$ begin
    create type public.pipeline_stage as enum (
        'novo', 'primeiro_contato', 'qualificacao', 'proposta',
        'negociacao', 'fechado_ganho', 'fechado_perdido'
    );
exception when duplicate_object then null; end $$;

do $$ begin
    create type public.user_role as enum ('admin', 'user');
exception when duplicate_object then null; end $$;

-- ---------- Tabelas ----------
create table if not exists public.profiles (
    id uuid not null,
    full_name text,
    avatar_url text,
    phone text,
    location text,
    bio text,
    updated_at timestamptz default timezone('utc'::text, now()),
    company_name text,
    email text,
    website text,
    industry text,
    webhook_url text,
    crm_type text,
    subscription_type text default 'free'::text,
    extracted_leads_count integer default 0,
    trial_start_date timestamptz,
    trial_status text default 'inactive'::text,
    constraint profiles_pkey primary key (id),
    constraint profiles_id_fkey foreign key (id) references auth.users(id) on delete cascade
);

create table if not exists public.leads (
    id uuid default gen_random_uuid() not null,
    company_name text not null,
    industry text,
    location text,
    contact_name text,
    email text,
    phone text,
    extraction_date timestamptz default now(),
    type text,
    rating numeric,
    user_ratings_total integer,
    opening_date text,
    website text,
    address text,
    created_at timestamptz default now(),
    user_id uuid not null,
    notes text,
    status text default 'new'::text,
    deal_value numeric default 0,
    tags text[] default '{}'::text[],
    last_exported_at timestamptz,
    stage public.pipeline_stage default 'novo'::public.pipeline_stage,
    kanban_order integer default 0,
    last_interaction_at timestamptz,
    constraint leads_pkey primary key (id),
    constraint leads_status_check check ((status = any (array['new'::text, 'qualified'::text, 'unqualified'::text, 'open'::text]))),
    constraint leads_type_check check ((type = any (array['manual'::text, 'place'::text, 'website'::text]))),
    constraint leads_user_id_fkey foreign key (user_id) references auth.users(id)
);
alter table public.leads replica identity full;

create table if not exists public.notifications (
    id uuid default gen_random_uuid() not null,
    user_id uuid not null,
    message text not null,
    type text,
    read boolean default false,
    created_at timestamptz default now(),
    action_type text,
    action_path text,
    action_tab text,
    constraint notifications_pkey primary key (id),
    constraint fk_user foreign key (user_id) references auth.users(id) on delete cascade
);

create table if not exists public.user_roles (
    id uuid default gen_random_uuid() not null,
    user_id uuid,
    role public.user_role default 'user'::public.user_role,
    created_at timestamptz default timezone('utc'::text, now()) not null,
    constraint user_roles_pkey primary key (id),
    constraint user_roles_user_id_key unique (user_id),
    constraint user_roles_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade
);

-- ---------- Índices ----------
create index if not exists leads_stage_idx on public.leads using btree (stage, kanban_order);
create index if not exists leads_tags_idx on public.leads using gin (tags);

-- ---------- Funções ----------
create or replace function public.handle_new_user() returns trigger
    language plpgsql security definer
    as $$
begin
    insert into public.profiles (id, full_name, trial_start_date, trial_status, subscription_type)
    values (
        new.id,
        new.raw_user_meta_data->>'full_name',
        current_timestamp,
        'active',
        'trial'
    );
    return new;
end;
$$;

create or replace function public.handle_new_user_role() returns trigger
    language plpgsql security definer
    as $$
begin
    insert into public.user_roles (user_id, role)
    values (new.id, 'user');
    return new;
end;
$$;

create or replace function public.is_valid_trial(user_profile_id uuid) returns boolean
    language plpgsql security definer
    as $$
declare
    trial_start timestamptz;
begin
    select trial_start_date into trial_start
    from public.profiles
    where id = user_profile_id;

    if trial_start is not null then
        return (
            current_timestamp < trial_start + interval '14 days'
            and trial_status = 'active'
        );
    end if;

    return false;
end;
$$;

-- ---------- Triggers em auth.users ----------
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();

drop trigger if exists on_auth_user_created_role on auth.users;
create trigger on_auth_user_created_role
    after insert on auth.users
    for each row execute function public.handle_new_user_role();

-- ---------- RLS ----------
alter table public.leads enable row level security;
alter table public.notifications enable row level security;
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;

-- leads
drop policy if exists "Users can view their own leads" on public.leads;
create policy "Users can view their own leads" on public.leads
    for select to authenticated using ((auth.uid() = user_id));
drop policy if exists "Users can insert their own leads" on public.leads;
create policy "Users can insert their own leads" on public.leads
    for insert to authenticated with check ((auth.uid() = user_id));
drop policy if exists "Users can update their own leads" on public.leads;
create policy "Users can update their own leads" on public.leads
    for update to authenticated using ((auth.uid() = user_id));
drop policy if exists "Users can update notes on their own leads" on public.leads;
create policy "Users can update notes on their own leads" on public.leads
    for update to authenticated using ((auth.uid() = user_id)) with check ((auth.uid() = user_id));
drop policy if exists "Users can delete their own leads" on public.leads;
create policy "Users can delete their own leads" on public.leads
    for delete to authenticated using ((auth.uid() = user_id));

-- profiles
drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile" on public.profiles
    for select using ((auth.uid() = id));
drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile" on public.profiles
    for insert with check ((auth.uid() = id));
drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles
    for update using ((auth.uid() = id));

-- notifications
drop policy if exists "Users can view their own notifications" on public.notifications;
create policy "Users can view their own notifications" on public.notifications
    for select to authenticated using ((auth.uid() = user_id));
drop policy if exists "Users can update their own notifications" on public.notifications;
create policy "Users can update their own notifications" on public.notifications
    for update to authenticated using ((auth.uid() = user_id));

-- user_roles
drop policy if exists "Users can view their own role" on public.user_roles;
create policy "Users can view their own role" on public.user_roles
    for select to authenticated using ((auth.uid() = user_id));

-- ---------- Storage: bucket avatars ----------
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "Public Access" on storage.objects;
create policy "Public Access" on storage.objects
    for select using ((bucket_id = 'avatars'::text));
drop policy if exists "Authenticated users can upload files" on storage.objects;
create policy "Authenticated users can upload files" on storage.objects
    for insert with check (((auth.role() = 'authenticated'::text) and (bucket_id = 'avatars'::text)));
