-- Fludd — product event log.
--
-- Cycle-2 testing measured every metric by asking four testers. That does not
-- scale past a handful of people, and it cannot answer "why": daily use came in
-- at 2 of 4 against a target of 3 with nothing to explain the gap.
--
-- Shape: an append-only table in our own database rather than a hosted
-- analytics product. A report link is `/r/<token>` where the token *is* the
-- credential — next.config.ts already sets `Referrer-Policy: no-referrer` on
-- that route to stop it leaking. Any client-side analytics tag would hand those
-- URLs to a third party and undo that. Keeping events here also means they join
-- straight to visits and customers, so "pools scheduled" is one query, not an
-- export.
--
-- Event names are deliberately NOT a CHECK constraint. A log whose vocabulary
-- needs a migration to grow stops being written to.

-- ---------------------------------------------------------------------------
-- The log
-- ---------------------------------------------------------------------------

create table if not exists public.app_events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  company_id uuid not null references public.companies (id) on delete cascade,
  -- Null once a tech is removed: the event still happened, and the counts it
  -- feeds must not silently drop when someone leaves.
  tech_id uuid references public.techs (id) on delete set null,
  -- The pool an event is about, where there is one.
  customer_id uuid references public.customers (id) on delete set null,
  name text not null check (length(name) between 1 and 64),
  props jsonb not null default '{}'::jsonb
);

-- Every question asked of this table is "how many <name> for <company> since
-- <date>", so that is the index.
create index if not exists app_events_company_name_idx
  on public.app_events (company_id, name, created_at desc);

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.app_events enable row level security;

-- Split rather than `for all`, because this table is append-only by design:
-- there is no update or delete policy and no grant for either, so a log line
-- cannot be rewritten after the fact. That is the property that makes the
-- numbers worth trusting.

drop policy if exists "app_events: read company" on public.app_events;
create policy "app_events: read company"
  on public.app_events for select to authenticated
  using (company_id = public.current_company_id());

-- A tech may only log events as themselves, in their own company, so a
-- compromised session cannot forge another company's activity.
drop policy if exists "app_events: append own" on public.app_events;
create policy "app_events: append own"
  on public.app_events for insert to authenticated
  with check (
    company_id = public.current_company_id()
    and (tech_id is null or tech_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------
-- 0001's blanket grant was a one-time snapshot, so this table needs its own.
-- Note what is absent: no update, no delete. Append-only is enforced by the
-- grant as well as by the policies.

grant select, insert on public.app_events to authenticated;
revoke all on public.app_events from anon;

-- ---------------------------------------------------------------------------
-- Report
-- ---------------------------------------------------------------------------
-- Expect: 13 tables, 17 policies, and 2 policies on app_events.

select
  (select count(*) from pg_tables where schemaname = 'public') as public_tables,
  (select count(*) from pg_policies where schemaname = 'public') as rls_policies,
  (select count(*) from pg_policies
    where schemaname = 'public' and tablename = 'app_events') as app_events_policies;
