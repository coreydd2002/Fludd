# Contributing to Fludd

The full onboarding guide is the **[team playbook](https://fludd.work/playbook)**.
This is the one-screen version.

1. Pick the top card in **Ready** on the [board](https://github.com/users/coreydd2002/projects) and assign yourself.
2. Branch from `main`: `git switch -c feat/12-photo-captions` (`feat|fix|chore|docs/<issue>-<slug>`).
3. Commit with [Conventional Commits](https://www.conventionalcommits.org/):
   `feat(app): add captions to visit photos`.
4. Before pushing, from `app/`:
   `npm run lint && npm run typecheck && npm run format:check && npm test`
5. Open a PR, fill in the template, write `Closes #12`. CI (`quality`, `e2e`,
   `db-rls`) and CodeQL must be green. Squash-merge.
6. Vercel builds a preview for every PR; merging to `main` deploys production.

Never commit secrets. `.env.example` holds names only. Push protection will block
known key formats, but it's no substitute for paying attention.
