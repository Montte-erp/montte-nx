# Contributing to Montte

## Prerequisites

- [Bun](https://bun.sh) >= 1.x
- [Node.js](https://nodejs.org) >= 20
- [Docker](https://www.docker.com) or [Podman](https://podman.io) with Compose
- [Git](https://git-scm.com)

## Getting Started

```bash
git clone https://github.com/Montte-erp/montte-nx.git
cd montte-nx
bun install
bun dev
```

That's it. `bun dev` is fully automatic on first run:

1. Creates `apps/web/.env.local` from `.env.example` if missing
2. Starts local containers (PostgreSQL on `5432`, Redis, MinIO) via Docker/Podman
3. Pushes the database schema
4. Seeds the event catalog
5. Starts the web app at `http://localhost:3000`

Placeholder values are pre-filled for external services (Stripe, PostHog, Google OAuth, Resend) so the app starts immediately. Replace them in `apps/web/.env.local` when you need those integrations to work.

## Dev Commands

```bash
bun dev           # Local dev — auto-setup on first run
bun dev:staging   # Dev against staging cloud services (needs apps/web/.env.staging.local)
bun dev:all       # Web + server + all packages
bun dev:server    # Server only (Elysia + DBOS workflows)
```

## Staging Environment

To run the local dev server against staging cloud services (no local containers needed):

```bash
cp apps/web/.env.staging.example apps/web/.env.staging.local
# fill in your staging values
bun dev:staging
```

## Database

```bash
bun run db:push          # Push schema changes to local DB
bun run db:push:prod     # Push schema changes to production DB
bun run db:studio:local  # Open Drizzle Studio for local DB
bun run db:studio:prod   # Open Drizzle Studio for production DB
```

## Seeding

```bash
bun run seed:events   # Seed event catalog (runs automatically on bun dev)
bun run seed:addons   # Seed addon subscriptions for an org
```

## Diagnostics

```bash
bun run doctor   # Check prerequisites and environment
bun setup        # Re-run first-time setup manually
```

## How to Contribute

### Bugs

- Report issues with steps to reproduce, expected vs. actual behavior, and your environment
- Test your changes thoroughly before submitting

### Features & Docs

- Open an issue describing the use case before starting significant work
- Keep user-facing content in Brazilian Portuguese (pt-BR)

## Project Structure

Nx monorepo — see [README.md](README.md) for the full structure.

**Apps:** `web/` (TanStack Start SSR), `server/` (Elysia + DBOS workflows)
**Core:** `authentication/`, `database/`, `environment/`, `files/`, `logging/`, `redis/`, `stripe/`, `transactional/`, `utils/`
**Packages:** `analytics/`, `events/`, `ui/`

## Code Standards

**Formatting:** [oxfmt](https://oxc.rs) — run `bun run format`
**Linting:** [oxlint](https://oxc.rs) — run `bun run check`
**TypeScript:** Strict, no type casting (`as`), no `any`
**React:** Function components, TanStack Router for routing
**Commits:** Conventional format: `type(scope): description`

Run all checks before opening a PR:

```bash
bun run format && bun run check && bun run typecheck && bun run test
```

## Workflow

1. **Branch:** `git checkout -b feat/name` or `fix/issue-description`
2. **Code:** Follow the standards in [CLAUDE.md](CLAUDE.md), write tests, update docs
3. **Check:** `bun run format && bun run typecheck`
4. **Commit:** `git commit -m "feat(scope): description"`
5. **Push & PR:** Open a PR against `master` with a descriptive title and summary

## Testing

```bash
bun run test                                                              # All tests
npx vitest run apps/web/__tests__/integrations/orpc/router/foo.test.ts   # Single file
```

Tests live in `apps/web/__tests__/integrations/orpc/router/`. Write integration tests for new oRPC procedures.

## Issues

**Bugs:** Include description, steps to reproduce, expected/actual behavior, environment
**Features:** Include description, use case, and implementation ideas
**Questions:** Check the docs and existing issues first

---

Thanks for contributing!
