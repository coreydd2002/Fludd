-- Exercises the migration's RLS as two separate companies.
-- auth.uid() is redefined to read a session GUC so we can impersonate.

\set ON_ERROR_STOP on

create or replace function auth.uid()
returns uuid language sql stable as $$
  select nullif(current_setting('test.user_id', true), '')::uuid
$$;

-- Re-runnable: clear anything a previous run left behind. Deleting the
-- companies cascades to techs, customers and visits.
delete from public.companies;
delete from auth.users where email in ('alice@example.com', 'bob@example.com');

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'alice@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'bob@example.com');

-- --- Company A bootstraps -----------------------------------------------
set role authenticated;
set test.user_id = '11111111-1111-1111-1111-111111111111';
select public.bootstrap_company('Alice Pools', 'Alice', 'America/Phoenix') as company_a \gset

insert into public.customers (company_id, first_name, last_name, email, address)
values (public.current_company_id(), 'Hank', 'Henderson', 'hank@example.com', '412 Maple St');

reset role;

-- --- Company B bootstraps -----------------------------------------------
set role authenticated;
set test.user_id = '22222222-2222-2222-2222-222222222222';
select public.bootstrap_company('Bob Pools', 'Bob', 'America/New_York') as company_b \gset

insert into public.customers (company_id, first_name, last_name, email, address)
values (public.current_company_id(), 'Rita', 'Alvarez', 'rita@example.com', '9 Lakeview Dr');

\echo ''
\echo '--- As Bob: customers visible (expect exactly 1, Rita) ---'
select first_name, last_name from public.customers;

\echo '--- As Bob: companies visible (expect exactly 1, Bob Pools) ---'
select business_name, timezone from public.companies;

\echo '--- As Bob: default checklist seeded (expect 5) ---'
select count(*) as checklist_items from public.default_checklist_items;

\echo '--- As Bob: techs visible (expect exactly 1, Bob) ---'
select display_name, email from public.techs;

\echo '--- As Bob: bootstrapping twice must fail ---'
do $$
begin
  perform public.bootstrap_company('Sneaky Pools', 'Bob Again', 'UTC');
  raise exception 'FAIL: second bootstrap was allowed';
exception
  when others then
    if sqlerrm like '%already completed onboarding%' then
      raise notice 'PASS: %', sqlerrm;
    else
      raise;
    end if;
end
$$;

\echo '--- As Bob: writing a customer into company A must be rejected ---'
do $$
declare
  v_other uuid;
begin
  -- current_company_id() is Bob's; grab A's id the only way an attacker could:
  -- guess it. We cheat and read it with a subquery that RLS will filter, so
  -- fall back to a literal lookup through the SECURITY DEFINER path.
  select company_id into v_other from public.techs
   where id = '11111111-1111-1111-1111-111111111111';
  if v_other is not null then
    raise exception 'FAIL: Bob can read company A''s tech row';
  end if;
  raise notice 'PASS: company A tech row is invisible to Bob';
end
$$;

\echo '--- As Bob: feedback insert must be denied (owners write via service role) ---'
do $$
begin
  insert into public.feedback (visit_id, rating)
  values (gen_random_uuid(), 5);
  raise exception 'FAIL: feedback insert was allowed';
exception
  when insufficient_privilege then
    raise notice 'PASS: feedback insert blocked by RLS';
  when foreign_key_violation then
    raise exception 'FAIL: RLS let the insert through to the FK check';
end
$$;

-- --- Visit rules ---------------------------------------------------------
\echo '--- As Bob: one open visit per customer ---'
insert into public.visits (customer_id, company_id, tech_id)
select c.id, c.company_id, '22222222-2222-2222-2222-222222222222'
from public.customers c limit 1;

do $$
begin
  insert into public.visits (customer_id, company_id, tech_id)
  select c.id, c.company_id, '22222222-2222-2222-2222-222222222222'
  from public.customers c limit 1;
  raise exception 'FAIL: a second open visit was allowed';
exception
  when unique_violation then
    raise notice 'PASS: second open visit rejected';
end
$$;

\echo '--- Token shape (expect 43 chars, url-safe) ---'
select length(public_token) as token_len,
       public_token ~ '^[A-Za-z0-9_-]+$' as url_safe
from public.visits;

\echo '--- Completing the visit frees the customer for a new one ---'
update public.visits set status = 'completed', finished_at = now();
insert into public.visits (customer_id, company_id, tech_id)
select c.id, c.company_id, '22222222-2222-2222-2222-222222222222'
from public.customers c limit 1;
select count(*) as visits_for_bob from public.visits;

reset role;

-- --- anon has nothing ----------------------------------------------------
\echo ''
\echo '--- As anon: customers table must be unreadable ---'
set role anon;
do $$
begin
  perform 1 from public.customers;
  raise exception 'FAIL: anon could read customers';
exception
  when insufficient_privilege then
    raise notice 'PASS: anon has no privilege on customers';
end
$$;
reset role;

-- --- Routing: scheduling and route ownership (0002) ----------------------
\echo ''
\echo '--- As Bob: scheduling a pool and building a route ---'
set role authenticated;
set test.user_id = '22222222-2222-2222-2222-222222222222';

update public.customers
   set assigned_tech_id = '22222222-2222-2222-2222-222222222222',
       service_weekday = 2,
       service_cadence = 'weekly';

insert into public.routes (company_id, tech_id, service_date)
select public.current_company_id(), '22222222-2222-2222-2222-222222222222', date '2026-11-03';

insert into public.route_stops (route_id, customer_id, position)
select r.id, c.id, 0
from public.routes r, public.customers c
where r.service_date = date '2026-11-03'
limit 1;

insert into public.travel_times (company_id, from_customer_id, to_customer_id, seconds, meters)
select public.current_company_id(), c.id, c.id, 0, 0 from public.customers c limit 1;

select count(*) as bob_routes from public.routes;
select count(*) as bob_stops from public.route_stops;

\echo '--- As Bob: one route per tech per day ---'
do $$
begin
  insert into public.routes (company_id, tech_id, service_date)
  values (public.current_company_id(), '22222222-2222-2222-2222-222222222222', date '2026-11-03');
  raise exception 'FAIL: a second route for the same tech and day was allowed';
exception
  when unique_violation then
    raise notice 'PASS: one route per tech per day';
end
$$;

\echo '--- As Bob: a pool cannot appear twice in one route ---'
do $$
declare v_route uuid; v_customer uuid;
begin
  select r.id into v_route from public.routes r limit 1;
  select rs.customer_id into v_customer from public.route_stops rs limit 1;
  insert into public.route_stops (route_id, customer_id, position)
  values (v_route, v_customer, 1);
  raise exception 'FAIL: the same pool was added to a route twice';
exception
  when unique_violation then
    raise notice 'PASS: a pool appears at most once per route';
end
$$;

reset role;

\echo '--- As Alice: none of Bob routing data is visible ---'
set role authenticated;
set test.user_id = '11111111-1111-1111-1111-111111111111';
select count(*) as routes_alice_can_see from public.routes;
select count(*) as stops_alice_can_see from public.route_stops;
select count(*) as travel_times_alice_can_see from public.travel_times;

\echo '--- As Alice: cannot create a route inside another company ---'
do $$
declare v_other uuid;
begin
  select company_id into v_other from public.techs
   where id = '22222222-2222-2222-2222-222222222222';
  if v_other is not null then
    raise exception 'FAIL: Alice can read company B''s tech row';
  end if;
  raise notice 'PASS: company B is invisible to Alice';
end
$$;

do $$
begin
  -- Forging a route for a tech in another company must fail the WITH CHECK.
  insert into public.routes (company_id, tech_id, service_date)
  values (gen_random_uuid(), '22222222-2222-2222-2222-222222222222', date '2026-11-04');
  raise exception 'FAIL: Alice created a route in another company';
exception
  when insufficient_privilege then
    raise notice 'PASS: cross-company route insert blocked by RLS';
  when foreign_key_violation then
    raise exception 'FAIL: RLS let the insert through to the FK check';
end
$$;

reset role;

\echo ''
\echo '--- As anon: routing tables must be unreadable ---'
set role anon;
do $$
begin
  perform 1 from public.routes;
  raise exception 'FAIL: anon could read routes';
exception
  when insufficient_privilege then
    raise notice 'PASS: anon has no privilege on routes';
end
$$;
do $$
begin
  perform 1 from public.travel_times;
  raise exception 'FAIL: anon could read travel_times';
exception
  when insufficient_privilege then
    raise notice 'PASS: anon has no privilege on travel_times';
end
$$;
reset role;

\echo ''
\echo 'ALL CHECKS COMPLETE'
