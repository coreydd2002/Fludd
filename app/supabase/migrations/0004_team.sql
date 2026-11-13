-- Fludd — teams: invites, roles, and deactivation.
--
-- Until now a company could hold exactly one person. `techs` has read and
-- update policies but no insert policy, so the database refuses a second;
-- a second signup calls bootstrap_company() and gets its own company instead
-- of joining. The `role` column has existed since 0001 and is read nowhere.
--
-- Cycle-2 testers found this without being prompted: "I added an option to
-- assign a user to a pool, but there is still only one user per account."
--
-- Shape: the missing insert policy is NOT added. Its absence is the property
-- that stops anyone inserting themselves into an arbitrary company. Joining
-- goes through accept_invite(), a SECURITY DEFINER function gated on a
-- single-use token — the same shape as bootstrap_company() in 0001, which
-- creates a techs row for exactly the same reason.
--
-- People are deactivated, never deleted. visits.tech_id is
-- `on delete restrict`, so the schema already insists a tech who has worked
-- cannot be erased; a report has to keep saying who serviced the pool.

-- ---------------------------------------------------------------------------
-- Deactivation
-- ---------------------------------------------------------------------------

alter table public.techs
  add column if not exists active boolean not null default true;

-- Partial, because every roster query asks for the active ones.
create index if not exists techs_company_active_idx
  on public.techs (company_id) where active;

-- ---------------------------------------------------------------------------
-- Who is an owner
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER for the reason current_company_id() is: it reads
-- public.techs, whose own policy would otherwise recurse.

create or replace function public.current_is_owner()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.techs
    where id = auth.uid() and role = 'owner' and active
  )
$$;

revoke all on function public.current_is_owner() from public;
grant execute on function public.current_is_owner() to authenticated;

-- ---------------------------------------------------------------------------
-- Invites
-- ---------------------------------------------------------------------------

create table if not exists public.invites (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  company_id uuid not null references public.companies (id) on delete cascade,
  email text not null,
  role text not null default 'tech' check (role in ('owner', 'tech')),
  -- Same CSPRNG token as a report link. It is mailed to one address and is
  -- half of what accept_invite() requires; the other half is that the signed-in
  -- account's email matches.
  token text not null unique default public.generate_public_token(),
  invited_by uuid references public.techs (id) on delete set null,
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  accepted_by uuid references public.techs (id) on delete set null
);

-- One live invite per address per company. Re-inviting replaces rather than
-- accumulating, so revoking is unambiguous.
create unique index if not exists invites_company_email_pending_idx
  on public.invites (company_id, lower(email)) where accepted_at is null;

create index if not exists invites_token_idx on public.invites (token);

-- ---------------------------------------------------------------------------
-- Joining
-- ---------------------------------------------------------------------------

/*
 * Turns a valid invite into a techs row for the caller.
 *
 * SECURITY DEFINER so it can insert into techs, which has no insert policy on
 * purpose. Two things must both hold: the caller presents the token, and the
 * caller's own email matches the address it was sent to. The token alone is
 * not enough — a report token only exposes one visit, whereas this grants
 * standing access to a company's customers, so a forwarded link must not be
 * sufficient.
 */
create or replace function public.accept_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text;
  v_invite public.invites;
begin
  if v_user_id is null then
    raise exception 'Not signed in';
  end if;

  if exists (select 1 from public.techs where id = v_user_id) then
    raise exception 'This account already belongs to a company';
  end if;

  select email into v_email from auth.users where id = v_user_id;

  select * into v_invite
  from public.invites
  where token = p_token
    and accepted_at is null
    and expires_at > now();

  if v_invite.id is null then
    raise exception 'This invitation is no longer valid';
  end if;

  if lower(v_invite.email) <> lower(v_email) then
    raise exception 'This invitation was sent to a different email address';
  end if;

  insert into public.techs (id, company_id, display_name, email, role)
  values (v_user_id, v_invite.company_id, split_part(v_email, '@', 1), v_email, v_invite.role);

  update public.invites
  set accepted_at = now(), accepted_by = v_user_id
  where id = v_invite.id;

  return v_invite.company_id;
end;
$$;

revoke all on function public.accept_invite(text) from public;
grant execute on function public.accept_invite(text) to authenticated;

/*
 * Looks up a pending invite for display, without requiring a session.
 *
 * The invite page has to render the company's name before the recipient has
 * signed up, and at that point RLS can tell us nothing. Returns only what the
 * page shows — never the role or the inviter.
 */
create or replace function public.invite_preview(p_token text)
returns table (email text, business_name text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select i.email, c.business_name
  from public.invites i
  join public.companies c on c.id = i.company_id
  where i.token = p_token
    and i.accepted_at is null
    and i.expires_at > now()
$$;

revoke all on function public.invite_preview(text) from public;
grant execute on function public.invite_preview(text) to anon, authenticated;

/*
 * Any pending invite addressed to the signed-in account.
 *
 * Signup does not carry a redirect, so somebody who follows an invitation,
 * creates an account and confirms their email arrives at onboarding with the
 * token long gone. Without this they would be offered the "name your business"
 * form and end up founding a company of their own — one person, alone, which
 * is the exact problem invitations exist to solve.
 *
 * Keyed on the account's own email, so it discloses nothing the recipient was
 * not already sent.
 */
create or replace function public.my_pending_invite()
returns table (token text, business_name text, role text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select i.token, c.business_name, i.role
  from public.invites i
  join public.companies c on c.id = i.company_id
  join auth.users u on lower(u.email) = lower(i.email)
  where u.id = auth.uid()
    and i.accepted_at is null
    and i.expires_at > now()
  order by i.created_at desc
  limit 1
$$;

revoke all on function public.my_pending_invite() from public;
grant execute on function public.my_pending_invite() to authenticated;

-- ---------------------------------------------------------------------------
-- Managing people
-- ---------------------------------------------------------------------------
-- Both are SECURITY DEFINER because "techs: update self" deliberately stops an
-- owner editing anybody else's row. Each re-checks that the caller is an owner
-- of the same company, since DEFINER means RLS is not doing it for us.

create or replace function public.set_tech_role(p_tech uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_company uuid := public.current_company_id();
begin
  if not public.current_is_owner() then
    raise exception 'Only an owner can change roles';
  end if;
  if p_role not in ('owner', 'tech') then
    raise exception 'Unknown role';
  end if;
  if not exists (select 1 from public.techs where id = p_tech and company_id = v_company) then
    raise exception 'That person is not in your company';
  end if;

  -- A company with no owner cannot invite, promote or deactivate anyone again:
  -- it would be permanently stuck.
  if p_role = 'tech' and (
    select count(*) from public.techs
    where company_id = v_company and role = 'owner' and active and id <> p_tech
  ) = 0 then
    raise exception 'A company must keep at least one owner';
  end if;

  update public.techs set role = p_role where id = p_tech;
end;
$$;

revoke all on function public.set_tech_role(uuid, text) from public;
grant execute on function public.set_tech_role(uuid, text) to authenticated;

create or replace function public.set_tech_active(p_tech uuid, p_active boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_company uuid := public.current_company_id();
begin
  if not public.current_is_owner() then
    raise exception 'Only an owner can deactivate or restore someone';
  end if;
  if p_tech = auth.uid() then
    raise exception 'You cannot deactivate yourself';
  end if;
  if not exists (select 1 from public.techs where id = p_tech and company_id = v_company) then
    raise exception 'That person is not in your company';
  end if;

  if not p_active and (
    select count(*) from public.techs
    where company_id = v_company and role = 'owner' and active and id <> p_tech
  ) = 0 then
    raise exception 'A company must keep at least one active owner';
  end if;

  update public.techs set active = p_active where id = p_tech;
end;
$$;

revoke all on function public.set_tech_active(uuid, boolean) from public;
grant execute on function public.set_tech_active(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.invites enable row level security;

-- Only owners deal with invites at all. A tech has no reason to see who else
-- has been asked to join, and an invite row carries a token that grants entry.
drop policy if exists "invites: owner manages" on public.invites;
create policy "invites: owner manages"
  on public.invites for all to authenticated
  using (company_id = public.current_company_id() and public.current_is_owner())
  with check (company_id = public.current_company_id() and public.current_is_owner());

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------
-- 0001's blanket grant was a one-time snapshot, so this table needs its own.

grant select, insert, update, delete on public.invites to authenticated;
revoke all on public.invites from anon;

-- ---------------------------------------------------------------------------
-- Report
-- ---------------------------------------------------------------------------
-- Expect: 14 tables, 18 policies, and 1 new column on techs.

select
  (select count(*) from pg_tables where schemaname = 'public') as public_tables,
  (select count(*) from pg_policies where schemaname = 'public') as rls_policies,
  (select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'techs'
      and column_name = 'active') as techs_active_column;
