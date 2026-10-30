-- Fludd MVP 2 — scheduling and routing.
--
-- Until now a tech saw every non-archived pool, alphabetically, every day: the
-- "Today's route" screen had no concept of a date, a tech, or an order. This
-- migration adds all three.
--
-- Shape: a pool carries its own schedule (which tech, which weekday, how often)
-- rather than belonging to a separate "route group" table. With only weekly and
-- every-other-week cadence, a group *is* a query — pools where assigned_tech_id
-- and service_weekday match — so a join table would add a level of indirection
-- and buy nothing. If twice-weekly pools ever appear, that is the point to move
-- this into its own table with a backfill.
--
-- A `routes` row is then one tech's plan for one date, built from those pools,
-- so that skipping or reordering a single day never edits the weekly schedule.

-- ---------------------------------------------------------------------------
-- Scheduling, on the pool itself
-- ---------------------------------------------------------------------------

alter table public.customers
  -- Geocoded pin. Null until the address has been resolved; routing ignores
  -- any pool without one.
  add column if not exists lat double precision,
  add column if not exists lng double precision,
  -- What the geocoder actually matched, shown back to a human for confirmation.
  -- A geocoder will happily return a tidy, confident address for the wrong
  -- building, so the matched text is kept rather than discarded.
  add column if not exists geocoded_address text,
  add column if not exists geocode_status text not null default 'pending',
  add column if not exists geocoded_at timestamptz,
  -- 0 = Sunday, matching JavaScript's Date.getDay() and Intl output, so the
  -- app never has to re-base the number. Null means not scheduled yet.
  add column if not exists service_weekday smallint,
  add column if not exists service_cadence text not null default 'weekly',
  -- Only meaningful when cadence is 'biweekly': which of the two alternating
  -- weeks this pool falls in. Compared against the ISO week number mod 2.
  add column if not exists service_week_parity smallint;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'customers_geocode_status_check') then
    alter table public.customers add constraint customers_geocode_status_check
      check (geocode_status in ('pending', 'ok', 'failed', 'confirmed'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'customers_service_weekday_check') then
    alter table public.customers add constraint customers_service_weekday_check
      check (service_weekday is null or service_weekday between 0 and 6);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'customers_service_cadence_check') then
    alter table public.customers add constraint customers_service_cadence_check
      check (service_cadence in ('weekly', 'biweekly'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'customers_service_week_parity_check') then
    alter table public.customers add constraint customers_service_week_parity_check
      check (service_week_parity is null or service_week_parity in (0, 1));
  end if;

  -- A biweekly pool without a parity would be due every week or never,
  -- depending on how the comparison is written. Make it unrepresentable.
  if not exists (select 1 from pg_constraint where conname = 'customers_biweekly_needs_parity') then
    alter table public.customers add constraint customers_biweekly_needs_parity
      check (service_cadence <> 'biweekly' or service_week_parity is not null);
  end if;
end
$$;

-- The query behind the Today screen: this company's unarchived pools for one
-- tech on one weekday.
create index if not exists customers_schedule_idx
  on public.customers (company_id, assigned_tech_id, service_weekday)
  where not archived;

-- ---------------------------------------------------------------------------
-- A tech's day
-- ---------------------------------------------------------------------------

create table if not exists public.routes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  company_id uuid not null references public.companies (id) on delete cascade,
  tech_id uuid not null references public.techs (id) on delete cascade,
  -- A calendar date in the COMPANY's timezone, not UTC. Deriving it from a
  -- timestamp on the server would put a company in Phoenix on tomorrow's route
  -- for part of every evening.
  service_date date not null,
  status text not null default 'planned'
    check (status in ('planned', 'optimized', 'in_progress', 'done')),
  optimized_at timestamptz,
  total_drive_seconds int check (total_drive_seconds >= 0),
  total_meters int check (total_meters >= 0),
  -- Drive time of the order the tech would have driven, captured the first time
  -- this route is built and never recomputed. It is the denominator of the
  -- "10% less driving" metric, and there is no way to recover it afterwards.
  baseline_drive_seconds int check (baseline_drive_seconds >= 0),
  -- Billable Route Matrix elements this route consumed, so the cost model can
  -- be checked against reality rather than assumed.
  matrix_elements int not null default 0 check (matrix_elements >= 0),
  provider text
);

create unique index if not exists routes_tech_date_idx
  on public.routes (tech_id, service_date);

create index if not exists routes_company_date_idx
  on public.routes (company_id, service_date desc);

create table if not exists public.route_stops (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  route_id uuid not null references public.routes (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  position int not null default 0,
  -- A stop the tech pinned to its slot; the optimizer must route around it
  -- rather than move it.
  locked boolean not null default false,
  status text not null default 'pending'
    check (status in ('pending', 'done', 'skipped', 'moved')),
  eta timestamptz,
  -- Set when the tech actually starts the visit, linking a planned stop to the
  -- existing visit, checklist and report flow. Null until then.
  visit_id uuid references public.visits (id) on delete set null
);

create unique index if not exists route_stops_unique_customer_idx
  on public.route_stops (route_id, customer_id);

create index if not exists route_stops_order_idx
  on public.route_stops (route_id, position);

-- ---------------------------------------------------------------------------
-- Travel-time cache
-- ---------------------------------------------------------------------------
-- The reason this feature is affordable. Pools do not move, so the driving time
-- between any two of them is stable: fetch each pair once and reuse it every
-- week. Without this, re-optimizing a 15-stop day twice daily across four techs
-- would run to roughly 41,000 billable matrix elements a month against a 10,000
-- free allowance; with it, a pilot costs well under a thousand, once.
--
-- The trade is that these are free-flow durations, not live traffic. For
-- choosing an order that is the right call: traffic moves the clock, rarely
-- the sequence.

create table if not exists public.travel_times (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  company_id uuid not null references public.companies (id) on delete cascade,
  from_customer_id uuid not null references public.customers (id) on delete cascade,
  to_customer_id uuid not null references public.customers (id) on delete cascade,
  seconds int not null check (seconds >= 0),
  meters int not null check (meters >= 0),
  fetched_at timestamptz not null default now()
);

create unique index if not exists travel_times_pair_idx
  on public.travel_times (from_customer_id, to_customer_id);

create index if not exists travel_times_company_idx
  on public.travel_times (company_id, fetched_at);

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.routes enable row level security;
alter table public.route_stops enable row level security;
alter table public.travel_times enable row level security;

drop policy if exists "routes: company" on public.routes;
create policy "routes: company"
  on public.routes for all to authenticated
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

-- route_stops carries no company_id, so it is scoped through its route, the
-- same way visit_items is scoped through its visit.
drop policy if exists "route_stops: company" on public.route_stops;
create policy "route_stops: company"
  on public.route_stops for all to authenticated
  using (
    exists (
      select 1 from public.routes r
      where r.id = route_id and r.company_id = public.current_company_id()
    )
  )
  with check (
    exists (
      select 1 from public.routes r
      where r.id = route_id and r.company_id = public.current_company_id()
    )
  );

drop policy if exists "travel_times: company" on public.travel_times;
create policy "travel_times: company"
  on public.travel_times for all to authenticated
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------
-- 0001's blanket `grant ... on all tables in schema public to authenticated`
-- was a one-time snapshot, not a standing default, so tables created here need
-- their own grant. Without it every query returns a permission error that looks
-- nothing like a policy problem.
--
-- `anon` is deliberately granted nothing, matching every other table.

grant select, insert, update, delete
  on public.routes, public.route_stops, public.travel_times
  to authenticated;

revoke all on public.routes, public.route_stops, public.travel_times from anon;

-- ---------------------------------------------------------------------------
-- Report
-- ---------------------------------------------------------------------------
-- Expect: 12 tables, 15 policies, and 8 new columns on customers.

select
  (select count(*) from pg_tables where schemaname = 'public') as public_tables,
  (select count(*) from pg_policies where schemaname = 'public') as rls_policies,
  (select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'customers'
      and column_name in ('lat', 'lng', 'geocoded_address', 'geocode_status',
                          'geocoded_at', 'service_weekday', 'service_cadence',
                          'service_week_parity')
  ) as new_customer_columns;
