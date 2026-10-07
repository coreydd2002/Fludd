# Fludd — rules for AI agents

Read https://fludd.work/playbook (source: `playbook.html`) for the full picture. The
short version, which applies to every Claude Code session in this repo:

- Two deployables: the static landing page at the repo root (no build step) and the
  Next.js app in `app/` (see `app/AGENTS.md` — this Next.js version differs from
  your training data; read `app/node_modules/next/dist/docs/` before using an API).
- Work on a branch named `feat/…`, `fix/…`, `chore/…` or `docs/…`. Never commit or
  push to `main`; never force-push; never deploy. A human opens and merges the PR.
- Commit messages follow Conventional Commits (`feat(app): …`, `fix: …`).
- Never read, print or paste secrets. `.env*` files are off-limits except
  `.env.example`, which holds variable **names only**. Never put real customer data
  in prompts, tests or fixtures.
- Before saying a change is done, run from `app/`:
  `npm run lint && npm run typecheck && npm run format:check && npm test`
  and, for UI or routing changes, `npm run test:e2e`. Report failures as failures.
- A schema change is a **new** file in `app/supabase/migrations/`, plus RLS
  assertions in `app/supabase/tests/01_rls_test.sql`. Never edit a shipped migration.
- Match the surrounding code: comment density, naming, Tailwind tokens in
  `app/src/app/globals.css`, components in `app/src/components/ui.tsx`.
