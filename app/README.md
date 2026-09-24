# Fludd — app

The mobile-first app a pool tech uses in the field, plus the public service
report each pool owner receives. Deployed separately from the marketing site:
this directory is its own Vercel project, destined for `app.fludd.com`.

The landing page lives in the repo root (`../index.html`, `../styles.css`,
`../api/subscribe.js`) and is **not** part of this project. Don't edit it from
here — it is a zero-build static site with its own strict CSP.

## Stack

Next.js 16 (App Router, Turbopack) · TypeScript · Tailwind v4 · Supabase
(Postgres, Auth, Storage) · Resend + React Email · Vercel.

## Setup

1. **Create a Supabase project** at <https://supabase.com/dashboard>.

2. **Run the migration.** Open the project's SQL Editor and paste the contents
   of [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql),
   then run it. It creates every table, all row-level security policies, the
   `bootstrap_company()` signup function and the private `visit-photos` bucket.

   With the Supabase CLI linked, `npx supabase db push` does the same thing.

3. **Configure the environment.**

   ```bash
   cp .env.example .env.local
   ```

   Fill in `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and
   `SUPABASE_SERVICE_ROLE_KEY` from Project Settings → API. The email variables
   are not needed until Phase 3.

4. **Turn off email confirmation** (development only).

   New Supabase projects require a clicked confirmation link before a new
   account can sign in, and the built-in sender is rate limited. In the
   dashboard go to **Authentication -> Sign In / Providers -> Email** and turn
   **Confirm email** off while building. Signup handles it either way — with it
   on, the form says to check your inbox instead of continuing to onboarding —
   but leaving it on makes testing slow.

   Turn it back on before real customers exist.

5. **Run it.**

   ```bash
   npm install
   npm run dev
   ```

   <http://localhost:3000> redirects to `/signup`. Create an account, complete
   onboarding, and you land on Today's route.

   `npm run check:phase1` verifies the same flow end to end against the live
   project without touching your own account.

## Commands

| Command              | What it does                                        |
| -------------------- | --------------------------------------------------- |
| `npm run dev`        | Dev server on :3000                                 |
| `npm run build`      | Production build                                    |
| `npm run lint`       | ESLint (`next lint` was removed in Next 16)         |
| `npx tsc --noEmit`   | Type-check without emitting                         |
| `npm run check:db`   | Confirms the migration is applied to the live project |
| `npm run check:anon` | Confirms logged-out requests cannot read customer data |
| `npm run check:phase1` | End-to-end: signup, onboarding, customers, and two-account isolation. Creates two throwaway users and deletes them afterwards. |
| `npm run check:phase2` | End-to-end: a whole visit — one-open-visit-per-pool, the checklist snapshot, readings, private photos, and the feedback window. |
| `npm run check:phase3` | Renders both owner emails through the real template path and checks their content. Needs `npm run dev` running. |
| `npm run make:user`  | Creates a pre-confirmed dev login (`tech@fludd.test`). Re-run to reset it; `-- --delete` removes it. |

## Layout

```
src/
  app/                 App Router routes
  lib/
    env.ts             public config; never throws at import
    env.server.ts      server-only config, guarded by `server-only`
    supabase/
      client.ts        Client Components  (anon key, RLS applies)
      server.ts        Server Components / Actions (anon key, RLS applies)
      admin.ts         service role — BYPASSES RLS, see the warning in the file
      database.types.ts
supabase/
  migrations/          schema + RLS
  tests/               SQL checks that can run on a plain Postgres
```

## Security model

- Every table has row-level security scoped by `current_company_id()`, a
  `SECURITY DEFINER` function that reads the caller's `techs` row. Policies key
  on the **company**, not the tech, so adding a second employee later needs no
  policy changes.
- `anon` is granted **nothing** on these tables. The public report page at
  `/r/[token]` reaches the database only through the service role, which looks
  a visit up by its `public_token` and returns a narrowed projection — never
  last name, address, email, or internal notes.
- `visit-photos` is a private bucket. Photos reach the public report only as
  short-lived signed URLs.
- This project sets its own CSP in `next.config.ts`. It is intentionally not
  the landing page's policy: `script-src 'self'` cannot run a Next.js app.

## Testing the database rules

The RLS policies can be exercised on any local Postgres — no Supabase, no
Docker — by stubbing the handful of Supabase-managed objects the migration
touches:

```bash
createdb fludd_test
psql -d fludd_test -f supabase/tests/00_supabase_stub.sql
psql -d fludd_test -f supabase/migrations/0001_init.sql
psql -d fludd_test -f supabase/tests/01_rls_test.sql
```

`01_rls_test.sql` sets up two companies and asserts that neither can see the
other's customers, techs or company row; that onboarding cannot run twice; that
a pool owner's feedback cannot be inserted by a signed-in tech; that a customer
can only have one open visit at a time; and that `anon` is refused outright.
Every check prints `PASS`, and the script exits non-zero on failure.

## Deploying

This directory is a **second Vercel project** on the same repository, with
**Root Directory** set to `app`. The repo root has a `.vercelignore` containing
`/app` so the landing page's deployment does not publish this source tree.

Production needs the same variables as `.env.local`, plus
`NEXT_PUBLIC_APP_URL` once a domain exists.

## Email

Two emails go to pool owners: **on my way** when a visit starts (skippable per
customer) and **service complete** when it finishes, carrying the link to their
report. Both are React Email templates in `src/emails/`.

Preview them at **`/dev/emails`** — sample data, nothing sent, and a button to
send either one to yourself. The route returns 404 when `NODE_ENV` is
production.

### Turning sending on locally

Add to `.env.local`:

```
RESEND_API_KEY=re_...                       # resend.com/api-keys
EMAIL_FROM=Fludd <onboarding@resend.dev>
DEV_EMAIL_OVERRIDE=coreydd2002@gmail.com
```

`DEV_EMAIL_OVERRIDE` reroutes **every** customer email to that one address and
prefixes the subject with the intended recipient. Keep it set until a domain is
verified, because the shared `onboarding@resend.dev` sender can only deliver to
the Resend account's own address — mail to anyone else is silently dropped, not
bounced.

With no key configured at all, sending is skipped and the app says so. It never
blocks a tech: the visit is written to the database *before* the send is
attempted, and `sendOwnerEmail` returns an outcome rather than throwing.

### Email deliverability (blocks production)

`RESEND_API_KEY` can be shared with the landing page's early-access form, but
the shared sender `onboarding@resend.dev` **only delivers to the Resend
account's own address**. Until a domain is verified in Resend, keep
`DEV_EMAIL_OVERRIDE` set so every customer-facing email is redirected to that
inbox instead of being silently dropped on a real pool owner.

To verify a domain: Resend → Domains → Add Domain, then add the DKIM `TXT`
record and the SPF/return-path records it prints to that domain's DNS. Once it
shows *Verified*, set `EMAIL_FROM` to an address on it and clear
`DEV_EMAIL_OVERRIDE` in production.
