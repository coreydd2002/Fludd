-- Fludd MVP — initial schema.
--
-- Shape: a company owns customers (pools); techs belong to a company and run
-- visits. The MVP UI is single-operator, but every table is scoped by
-- company_id so adding a second employee later is a UI change, not a migration.
--
-- Every table is protected by row-level security keyed on current_company_id().
-- The public report page (/r/[token]) never touches these tables with the anon
-- key — it goes through the service role, which is why `anon` is granted
-- nothing here at all.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
-- current_company_id() lives further down, after public.techs exists: a
-- `language sql` body is parsed when the function is created, so it cannot
-- reference a table that has not been declared yet.

-- 43-character base64url string from 32 random bytes. Used as the only secret
-- protecting a pool owner's report, so it must come from a CSPRNG.
--
-- SECURITY DEFINER because this runs as a column default on public.visits,
-- i.e. as whichever role is inserting. That role is not guaranteed USAGE on
-- the extensions schema, and an insert that fails on a permissions error is a
-- tech unable to start a visit.
create or replace function public.generate_public_token()
returns text
language sql
volatile
security definer
set search_path = public, extensions, pg_temp
as $$
  select replace(
           replace(
             rtrim(encode(extensions.gen_random_bytes(32), 'base64'), '='),
             '+', '-'),
           '/', '_')
$$;

revoke all on function public.generate_public_token() from public;
grant execute on function public.generate_public_token() to authenticated;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  business_name text not null,
  -- IANA zone captured from the browser at signup; all owner-facing times render in it.
  timezone text not null default 'America/Los_Angeles',
  alert_email text not null,
  maps_pref text not null default 'google' check (maps_pref in ('google', 'apple'))
);

create table if not exists public.techs (
  id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  company_id uuid not null references public.companies (id) on delete cascade,
  display_name text not null,
  email text not null,
  phone text,
  role text not null default 'owner' check (role in ('owner', 'tech'))
);

create index if not exists techs_company_idx on public.techs (company_id);

create table if not exists public.default_checklist_items (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  company_id uuid not null references public.companies (id) on delete cascade,
  label text not null,
  position int not null default 0
);

create index if not exists default_checklist_items_company_idx
  on public.default_checklist_items (company_id, position);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  company_id uuid not null references public.companies (id) on delete cascade,
  assigned_tech_id uuid references public.techs (id) on delete set null,
  first_name text not null,
  last_name text,
  email text not null,
  address text not null,
  est_duration_minutes int not null default 30 check (est_duration_minutes > 0),
  start_email_enabled boolean not null default true,
  -- Tech-only: gate code, dog in the yard. Never leaves the authed app.
  internal_notes text,
  archived boolean not null default false
);

create index if not exists customers_company_idx on public.customers (company_id) where not archived;

create table if not exists public.customer_checklist_items (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  label text not null,
  position int not null default 0
);

create index if not exists customer_checklist_items_customer_idx
  on public.customer_checklist_items (customer_id, position);

create table if not exists public.visits (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  tech_id uuid not null references public.techs (id) on delete restrict,
  status text not null default 'on_the_way'
    check (status in ('on_the_way', 'in_progress', 'completed', 'cancelled')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  tech_notes text,
  chlorine_ppm numeric(4, 1) check (chlorine_ppm >= 0 and chlorine_ppm <= 100),
  ph numeric(3, 1) check (ph >= 0 and ph <= 14),
  alkalinity_ppm int check (alkalinity_ppm >= 0 and alkalinity_ppm <= 1000),
  public_token text not null unique default public.generate_public_token(),
  -- When the feedback form stops accepting submissions. The report itself stays
  -- readable after this — the owner keeps their service history either way.
  feedback_closes_at timestamptz
);

create index if not exists visits_customer_idx on public.visits (customer_id, started_at desc);
create index if not exists visits_company_status_idx on public.visits (company_id, status);

-- One open visit per pool. Enforced here rather than in app code because the
-- "On my way" button is exactly the thing a tech double-taps on a bad connection.
create unique index if not exists visits_one_open_per_customer
  on public.visits (customer_id)
  where status in ('on_the_way', 'in_progress');

-- A copy of the checklist as it stood during this visit, so editing a
-- customer's checklist next month never rewrites last month's report.
create table if not exists public.visit_items (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  visit_id uuid not null references public.visits (id) on delete cascade,
  label text not null,
  position int not null default 0,
  completed boolean not null default false
);

create index if not exists visit_items_visit_idx on public.visit_items (visit_id, position);

create table if not exists public.visit_photos (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  visit_id uuid not null references public.visits (id) on delete cascade,
  -- Path inside the private `visit-photos` bucket: {company_id}/{visit_id}/{uuid}.jpg
  storage_path text not null unique,
  position int not null default 0
);

create index if not exists visit_photos_visit_idx on public.visit_photos (visit_id, position);

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  visit_id uuid not null unique references public.visits (id) on delete cascade,
  rating int check (rating between 1 and 5),
  review text,
  next_visit_notes text,
  is_urgent boolean not null default false,
  read_by_tech_at timestamptz
);

-- ---------------------------------------------------------------------------
-- Company scoping
-- ---------------------------------------------------------------------------

-- The caller's company. SECURITY DEFINER on purpose: it reads public.techs,
-- and techs' own RLS policy calls this function. Without DEFINER (which skips
-- RLS inside the function body) that pair recurses infinitely.
create or replace function public.current_company_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select company_id from public.techs where id = auth.uid()
$$;

revoke all on function public.current_company_id() from public;
grant execute on function public.current_company_id() to authenticated;

-- ---------------------------------------------------------------------------
-- Signup
-- ---------------------------------------------------------------------------

-- Creates the company, the tech row and the starter checklist in one
-- transaction. SECURITY DEFINER because a brand-new user has no company yet,
-- so current_company_id() is null and every RLS policy below would reject them.
create or replace function public.bootstrap_company(
  p_business_name text,
  p_display_name text,
  p_timezone text default 'America/Los_Angeles'
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text;
  v_company_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not signed in';
  end if;

  if exists (select 1 from public.techs where id = v_user_id) then
    raise exception 'This account has already completed onboarding';
  end if;

  select email into v_email from auth.users where id = v_user_id;

  insert into public.companies (business_name, timezone, alert_email)
  values (
    nullif(btrim(p_business_name), ''),
    coalesce(nullif(btrim(p_timezone), ''), 'America/Los_Angeles'),
    v_email
  )
  returning id into v_company_id;

  insert into public.techs (id, company_id, display_name, email, role)
  values (v_user_id, v_company_id, btrim(p_display_name), v_email, 'owner');

  insert into public.default_checklist_items (company_id, label, position)
  values
    (v_company_id, 'Skim surface', 0),
    (v_company_id, 'Brush walls', 1),
    (v_company_id, 'Vacuum', 2),
    (v_company_id, 'Test & balance chemicals', 3),
    (v_company_id, 'Empty baskets', 4);

  return v_company_id;
end;
$$;

revoke all on function public.bootstrap_company(text, text, text) from public;
grant execute on function public.bootstrap_company(text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.companies enable row level security;
alter table public.techs enable row level security;
alter table public.default_checklist_items enable row level security;
alter table public.customers enable row level security;
alter table public.customer_checklist_items enable row level security;
alter table public.visits enable row level security;
alter table public.visit_items enable row level security;
alter table public.visit_photos enable row level security;
alter table public.feedback enable row level security;

drop policy if exists "companies: read own" on public.companies;
create policy "companies: read own"
  on public.companies for select to authenticated
  using (id = public.current_company_id());

drop policy if exists "companies: update own" on public.companies;
create policy "companies: update own"
  on public.companies for update to authenticated
  using (id = public.current_company_id())
  with check (id = public.current_company_id());

drop policy if exists "techs: read company roster" on public.techs;
create policy "techs: read company roster"
  on public.techs for select to authenticated
  using (company_id = public.current_company_id());

-- A tech edits only their own profile; company_id is pinned so nobody can move
-- themselves into another company.
drop policy if exists "techs: update self" on public.techs;
create policy "techs: update self"
  on public.techs for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and company_id = public.current_company_id());

drop policy if exists "default_checklist_items: company" on public.default_checklist_items;
create policy "default_checklist_items: company"
  on public.default_checklist_items for all to authenticated
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

drop policy if exists "customers: company" on public.customers;
create policy "customers: company"
  on public.customers for all to authenticated
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

drop policy if exists "customer_checklist_items: company" on public.customer_checklist_items;
create policy "customer_checklist_items: company"
  on public.customer_checklist_items for all to authenticated
  using (
    exists (
      select 1 from public.customers c
      where c.id = customer_id and c.company_id = public.current_company_id()
    )
  )
  with check (
    exists (
      select 1 from public.customers c
      where c.id = customer_id and c.company_id = public.current_company_id()
    )
  );

drop policy if exists "visits: company" on public.visits;
create policy "visits: company"
  on public.visits for all to authenticated
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

drop policy if exists "visit_items: company" on public.visit_items;
create policy "visit_items: company"
  on public.visit_items for all to authenticated
  using (
    exists (
      select 1 from public.visits v
      where v.id = visit_id and v.company_id = public.current_company_id()
    )
  )
  with check (
    exists (
      select 1 from public.visits v
      where v.id = visit_id and v.company_id = public.current_company_id()
    )
  );

drop policy if exists "visit_photos: company" on public.visit_photos;
create policy "visit_photos: company"
  on public.visit_photos for all to authenticated
  using (
    exists (
      select 1 from public.visits v
      where v.id = visit_id and v.company_id = public.current_company_id()
    )
  )
  with check (
    exists (
      select 1 from public.visits v
      where v.id = visit_id and v.company_id = public.current_company_id()
    )
  );

-- Read and mark-as-read only. Feedback is written by pool owners, who have no
-- session — that insert goes through the service role from the report page.
drop policy if exists "feedback: read company" on public.feedback;
create policy "feedback: read company"
  on public.feedback for select to authenticated
  using (
    exists (
      select 1 from public.visits v
      where v.id = visit_id and v.company_id = public.current_company_id()
    )
  );

drop policy if exists "feedback: mark read" on public.feedback;
create policy "feedback: mark read"
  on public.feedback for update to authenticated
  using (
    exists (
      select 1 from public.visits v
      where v.id = visit_id and v.company_id = public.current_company_id()
    )
  )
  with check (
    exists (
      select 1 from public.visits v
      where v.id = visit_id and v.company_id = public.current_company_id()
    )
  );

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------
-- Defense in depth: `anon` has no privileges on these tables at all, so a
-- mistake in a policy still cannot expose customer data to a logged-out
-- request. The public report page uses the service role instead.

revoke all on all tables in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;

-- ---------------------------------------------------------------------------
-- Storage
-- ---------------------------------------------------------------------------
-- storage.objects is owned by supabase_storage_admin, and on some projects the
-- SQL Editor's role cannot create policies on it. That must not roll back the
-- schema above, so both statements are trapped. If they fail, the notice says
-- what to create by hand and everything else still commits.

do $$
declare
  v_found int := 0;
begin
  begin
    insert into storage.buckets (id, name, public)
    values ('visit-photos', 'visit-photos', false)
    on conflict (id) do nothing;

    execute 'select count(*) from storage.buckets'
         || ' where id = ''visit-photos'' and not public'
      into v_found;
  exception when others then
    raise notice 'Bucket NOT created (%). In the dashboard: Storage -> New bucket, name "visit-photos", Public OFF.', sqlerrm;
    v_found := 0;
  end;

  -- Carried out of the block so the report below never has to name
  -- storage.buckets, which would fail to parse if storage were unreachable.
  perform set_config('fludd.bucket_found', v_found::text, false);
end
$$;

do $$
begin
  execute 'drop policy if exists "visit-photos: company" on storage.objects';
  execute $p$
    create policy "visit-photos: company"
      on storage.objects for all to authenticated
      using (
        bucket_id = 'visit-photos'
        and (storage.foldername(name))[1] = public.current_company_id()::text
      )
      with check (
        bucket_id = 'visit-photos'
        and (storage.foldername(name))[1] = public.current_company_id()::text
      )
  $p$;
exception when others then
  raise notice 'Storage policy NOT created (%). Add it under Storage -> Policies.', sqlerrm;
end
$$;

-- ---------------------------------------------------------------------------
-- Report
-- ---------------------------------------------------------------------------
-- Expect: 3 functions, 1 private bucket, 9 tables, 12 policies.
-- Reads only pg_catalog, so it cannot itself abort the migration.

select
  (select count(*) from pg_proc pr
     join pg_namespace ns on ns.oid = pr.pronamespace
    where ns.nspname = 'public'
      and pr.proname in ('current_company_id', 'generate_public_token', 'bootstrap_company')
  ) as functions_found,
  coalesce(nullif(current_setting('fludd.bucket_found', true), '')::int, 0)
    as private_bucket_found,
  (select count(*) from pg_tables where schemaname = 'public'
  ) as public_tables,
  (select count(*) from pg_policies where schemaname = 'public'
  ) as rls_policies;
