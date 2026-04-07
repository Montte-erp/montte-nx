# Contributing to Montte

## Prerequisites

- [Bun](https://bun.sh) >= 1.x
- [Node.js](https://nodejs.org) >= 20
- [Docker](https://www.docker.com) (for PostgreSQL, Redis, MinIO)
- [Git](https://git-scm.com)

## Getting Started

1. **Clone & install:**

   ```bash
   git clone https://github.com/Montte-erp/montte-nx.git
   cd montte-nx
   bun install
   ```

2. **Set up environment:**

   ```bash
   bun run scripts/env-setup.ts run
   ```

   This generates the `.env` files under `apps/web/` from the template.

3. **Push the database schema:**

   ```bash
   bun run db:push
   ```

4. **Start development:**

   ```bash
   bun dev        # Web app only (seeds event catalog first)
   bun dev:all    # Web + server + worker
   bun dev:worker # Worker only
   ```

5. **Verify your setup:**
   ```bash
   bun run scripts/doctor.ts check
   ```

## How to Contribute

### Bugs

- Test your changes thoroughly before submitting
- Report issues with steps to reproduce, expected vs. actual behavior, and your environment

### Features & Docs

- Open an issue describing the use case before starting significant work
- Improve documentation and examples for the Brazilian Portuguese (pt-BR) audience

## Project Structure

Nx monorepo — see [README.md](README.md) for the full structure.

**Apps:** `web/` (React + Vite SPA), `server/` (Elysia), `worker/` (BullMQ)
**Core:** `authentication/`, `database/`, `environment/`, `files/`, `logging/`, `redis/`, `stripe/`, `transactional/`, `utils/`
**Packages:** `agents/`, `analytics/`, `events/`, `feedback/`, `ui/`

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
5. **Push & PR:** Open a PR against `master` with a descriptive title and summary of changes

## Testing

```bash
bun run test                                                          # All tests
npx vitest run apps/web/__tests__/integrations/orpc/router/foo.test.ts  # Single file
```

Tests live in `apps/web/__tests__/integrations/orpc/router/`. Write integration tests for new oRPC procedures.

## Issues

**Bugs:** Include description, steps to reproduce, expected/actual behavior, environment
**Features:** Include description, use case, and implementation ideas
**Questions:** Check the docs and existing issues first

---

Thanks for contributing!
