-- =====================================================================
-- maisLEAD — CRM Kanban + Agendamentos + Follow-up + Abas do Lead
-- Aplicar no projeto maislead (ddndpnibptrvurabacgi).
-- Aditivo e idempotente: só adiciona colunas/tabelas/policies; não dropa dados.
-- Escopo por account_id (RLS), no mesmo padrão da fase 1 multitenant.
-- =====================================================================

-- ---------- leads: estágio do CRM + próximo follow-up ----------
-- Estágios do funil (spec): base -> contacted -> scheduled -> followup -> won / lost
alter table public.leads add column if not exists crm_stage text not null default 'base';
alter table public.leads drop constraint if exists leads_crm_stage_check;
alter table public.leads add constraint leads_crm_stage_check
    check (crm_stage in ('base','contacted','scheduled','followup','won','lost'));
alter table public.leads add column if not exists next_follow_up_at date;  -- data-only evita bug de fuso no relógio
create index if not exists leads_crm_stage_idx on public.leads (account_id, crm_stage);

-- backfill inicial do crm_stage a partir do status legado (só linhas ainda no default)
update public.leads set crm_stage = case
    when status = 'converted' then 'won'
    when status = 'qualified' then 'contacted'
    else 'base' end
where crm_stage = 'base';

-- ---------- accounts: templates de WhatsApp editáveis (spec item 7) ----------
alter table public.accounts add column if not exists wa_template_first  text;
alter table public.accounts add column if not exists wa_template_follow text;

-- ---------- appointments (Agendamentos) ----------
create table if not exists public.appointments (
    id uuid primary key default gen_random_uuid(),
    account_id uuid not null references public.accounts(id) on delete cascade,
    lead_id uuid references public.leads(id) on delete set null,
    appt_date date not null,
    appt_time text,                                  -- 'HH:MM' (hora local; evita bug de fuso no calendário)
    notes text,
    status text not null default 'scheduled',        -- scheduled | done | canceled
    created_at timestamptz not null default now()
);
create index if not exists appointments_account_date_idx on public.appointments (account_id, appt_date);

-- ---------- lead_documents (aba Documentos) ----------
create table if not exists public.lead_documents (
    id uuid primary key default gen_random_uuid(),
    lead_id uuid not null references public.leads(id) on delete cascade,
    account_id uuid references public.accounts(id) on delete cascade,
    name text not null,
    size bigint,
    mime text,
    path text,                                       -- caminho do objeto no bucket lead-docs
    created_at timestamptz not null default now()
);
create index if not exists lead_documents_lead_idx on public.lead_documents (lead_id);

-- ---------- lead_links (aba Links) ----------
create table if not exists public.lead_links (
    id uuid primary key default gen_random_uuid(),
    lead_id uuid not null references public.leads(id) on delete cascade,
    account_id uuid references public.accounts(id) on delete cascade,
    url text not null,
    note text,
    created_at timestamptz not null default now()
);
create index if not exists lead_links_lead_idx on public.lead_links (lead_id);

-- ---------- lead_activities (aba Follow-up: histórico de contatos) ----------
create table if not exists public.lead_activities (
    id uuid primary key default gen_random_uuid(),
    lead_id uuid not null references public.leads(id) on delete cascade,
    account_id uuid references public.accounts(id) on delete cascade,
    channel text not null,                           -- whatsapp | call | email | meeting
    note text,
    created_at timestamptz not null default now()
);
create index if not exists lead_activities_lead_idx on public.lead_activities (lead_id, created_at desc);

-- ---------- RLS (escopo por account_id, mesmo padrão da fase 1) ----------
alter table public.appointments    enable row level security;
alter table public.lead_documents  enable row level security;
alter table public.lead_links      enable row level security;
alter table public.lead_activities enable row level security;

do $$
declare tbl text;
begin
    foreach tbl in array array['appointments','lead_documents','lead_links','lead_activities'] loop
        execute format('drop policy if exists "account scope" on public.%I;', tbl);
        execute format($f$create policy "account scope" on public.%I
            for all to authenticated
            using (account_id = public.current_account_id())
            with check (account_id = public.current_account_id());$f$, tbl);
    end loop;
end $$;

-- ---------- Storage: bucket privado lead-docs ----------
insert into storage.buckets (id, name, public)
values ('lead-docs', 'lead-docs', false)
on conflict (id) do nothing;

-- Objetos ficam em <account_id>/<lead_id>/<arquivo>; o 1º segmento do path é a conta.
drop policy if exists "lead-docs account read"   on storage.objects;
create policy "lead-docs account read" on storage.objects
    for select to authenticated
    using (bucket_id = 'lead-docs' and (storage.foldername(name))[1] = public.current_account_id()::text);

drop policy if exists "lead-docs account insert" on storage.objects;
create policy "lead-docs account insert" on storage.objects
    for insert to authenticated
    with check (bucket_id = 'lead-docs' and (storage.foldername(name))[1] = public.current_account_id()::text);

drop policy if exists "lead-docs account delete" on storage.objects;
create policy "lead-docs account delete" on storage.objects
    for delete to authenticated
    using (bucket_id = 'lead-docs' and (storage.foldername(name))[1] = public.current_account_id()::text);
