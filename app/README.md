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

2. **Run the migrations.** There is more than one now, and they must be applied
   in order. Bundle them into a single paste:

   ```bash
   npm run migrations:bundle
   ```

   Open the project's SQL Editor, paste the contents of the generated
   `supabase/bundle.generated.sql`, and run it. Between them the migrations
   create every table, all row-level security policies, the
   `bootstrap_company()` signup function, the private `visit-photos` bucket,
   the routing tables and the `app_events` log.

   The last statement prints a count to check against — currently
   **13 tables, 17 policies**. If those numbers do not match, something did not
   apply; read up for the first error rather than re-running.

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

| Command                       | What it does                                                                                                                           |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`                 | Dev server on :3000                                                                                                                    |
| `npm run build`               | Production build                                                                                                                       |
| `npm run lint`                | ESLint (`next lint` was removed in Next 16)                                                                                            |
| `npx tsc --noEmit`            | Type-check without emitting                                                                                                            |
| `npm run check:db`            | Confirms the migration is applied to the live project                                                                                  |
| `npm run migrations:bundle`   | Writes every migration, in order, to one file to paste into a fresh project                                                            |
| `npm run check:anon`          | Confirms logged-out requests cannot read customer data                                                                                 |
| `npm run check:phase1`        | End-to-end: signup, onboarding, customers, and two-account isolation. Creates two throwaway users and deletes them afterwards.         |
| `npm run check:phase2`        | End-to-end: a whole visit — one-open-visit-per-pool, the checklist snapshot, readings, private photos, and the feedback window.        |
| `npm run check:phase3`        | Renders both owner emails through the real template path and checks their content. Needs `npm run dev` running.                        |
| `npm run check:phase4`        | The public report page: what it shows, and — asserted explicitly — that it never leaks last name, address, email or private notes.     |
| `npm run check:phase5`        | The feedback loop: inbox, unread badges, notes carried to the next visit.                                                              |
| `npm run check:phase6`        | Installability: manifest, icons, and that none of them are auth-gated.                                                                 |
| `npm run make:user`           | Creates a pre-confirmed dev login (`tech@fludd.test`) with a random password, printed once. Re-run to reset; `-- --delete` removes it. |
| `node scripts/make-icons.mjs` | Regenerates the PWA icons from `public/logo.jpg`.                                                                                      |

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

## Applying a migration

Schema changes are not deployed by CI. The code path is automated — merge to
`main` and Vercel ships it — but the database is applied by hand, so the two
can get out of step. The order below is what keeps them together.

1. **Write it as a new file.** `supabase/migrations/NNNN_name.sql`, never an
   edit to one that has shipped. Add RLS assertions to
   `supabase/tests/01_rls_test.sql` in the same change.

2. **Let CI prove it.** The `db-rls` job applies every migration to a real
   Postgres and runs the assertions. A green check means the SQL is valid and
   the policies hold; it does **not** mean anything was applied anywhere real.

3. **Apply to staging first**, through the SQL Editor. Open the migration file
   in your editor and copy its **contents** — pasting the file _path_ produces
   `syntax error at or near "app"`, which has happened.

4. **Apply to production, then merge.** In that order. Every migration here is
   additive, and the currently deployed code ignores columns it does not know
   about, so applying early is safe. Merging first is not: Vercel ships the new
   code within a minute, and it will query columns that do not exist yet.

5. **Check the report row.** Each migration ends with a count of tables and
   policies, and its header says what to expect. Mismatch means something did
   not apply.

6. **Confirm from outside.** `npm run check:db` reads every table through
   PostgREST and prints which project host it checked, so there is no doubt
   about which database you just looked at.

## Installing on a phone

The app is a PWA: `src/app/manifest.ts` is served at `/manifest.webmanifest`,
and the icons come from `public/icon-*.png`, generated from the logo by
`scripts/make-icons.mjs`.

- **iOS** — open the site in Safari, Share → Add to Home Screen. Safari ignores
  the manifest's display mode and reads the `appleWebApp` metadata in
  `src/app/layout.tsx` instead.
- **Android** — Chrome offers an install prompt once the manifest, a 192px and
  a 512px icon all load.

The trap worth knowing: the auth proxy must not intercept the manifest or the
icons. If it redirects them to `/login`, the install prompt simply never
appears, with nothing logged. `src/proxy.ts` excludes static files by
extension for that reason, and `npm run check:phase6` asserts it.

## Deploying

This directory is the **`fludd-app`** Vercel project, deployed from the same
repository as the landing page (`fludd-landing`) with **Root Directory** set to
`app`. It serves `app.fludd.work`; the landing page serves `fludd.work`.

Environment variables are scoped per project and do **not** cross between the
two — a key set on `fludd-landing` is invisible to `fludd-app`. The landing
page's [`vercel.json`](../vercel.json) redirects `/app/*` to `/` so its own
deployment does not try to serve this source tree.

> A repo-root `.vercelignore` listing `/app` was tried first and removed: Vercel
> applies that file to **every** project built from the repo, before descending
> into each one's Root Directory, so it deleted the app from its own build.

Production needs the same variables as `.env.local`, plus
`NEXT_PUBLIC_APP_URL` once a domain exists.

### Environments

Vercel scopes each variable to Production, Preview and Development separately.
That matters most for `NEXT_PUBLIC_SUPABASE_URL` and its keys: set to a single
shared value, **every preview deployment reads and writes the live database**,
so an unfinished branch can corrupt real customer records.

| Environment | Supabase project            | Used by                       |
| ----------- | --------------------------- | ----------------------------- |
| Production  | the live project            | `app.fludd.work`, from `main` |
| Preview     | a separate staging project  | every pull request            |
| Development | whatever is in `.env.local` | local `npm run dev`           |

Previews sit behind Vercel SSO, so they are not reachable by the public — the
risk is a branch the team opens itself, not the open internet. That lowers the
severity; it does not remove it.

When creating the staging project, apply the schema with
`npm run migrations:bundle` exactly as in Setup above, and give it its own
`SUPABASE_SERVICE_ROLE_KEY` in Vercel's Preview scope.

⚠️ `NEXT_PUBLIC_` variables are inlined into the browser bundle at **build**
time, so changing one has no effect until the project is redeployed. The
quickest way to confirm a change took is the Content-Security-Policy header on
a response: [`next.config.ts`](next.config.ts) builds `connect-src` from the
Supabase and Sentry values present at build time, so the header names whichever
project the deployment was actually built against.

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
blocks a tech: the visit is written to the database _before_ the send is
attempted, and `sendOwnerEmail` returns an outcome rather than throwing.

### Email deliverability (blocks production)

`RESEND_API_KEY` can be shared with the landing page's early-access form, but
the shared sender `onboarding@resend.dev` **only delivers to the Resend
account's own address**. Until a domain is verified in Resend, keep
`DEV_EMAIL_OVERRIDE` set so every customer-facing email is redirected to that
inbox instead of being silently dropped on a real pool owner.

`fludd.work` is verified in Resend, so production sends from
`Fludd <visits@fludd.work>` with `DEV_EMAIL_OVERRIDE` unset.

Its DNS lives at Namecheap. Resend's current setup is two CNAMEs (`send` and
`rsend`, both to `forge.rmta.net`) plus a DKIM `TXT` on `resend._domainkey`.
Do **not** add an `MX` record on `send`: the CNAME already supplies one, and a
name carrying a CNAME may not carry other record types. That conflict makes
bounce notifications resolve inconsistently — sometimes to Resend, sometimes
elsewhere — so failures stop being reported while the app still shows "sent".
