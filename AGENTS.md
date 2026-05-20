# Montte — Agent Guidelines

AI-powered ERP. Nx monorepo, Bun, TanStack Start (SSR), oRPC, TanStack Query, Drizzle ORM, PostgreSQL (ParadeDB). Brazilian Portuguese (pt-BR).

---

## Commands

```bash
bun dev                  # dev-init (env.local, install, containers, db:push) then web + worker + landing
bun dev:all              # all apps + packages
bun run build            # Nx-cached build
bun run typecheck
bun run check            # oxlint
bun run format           # oxfmt
bun run test             # parallel
bun run db:push
bun run db:studio:local       # or db:studio:prod
bun run check-boundaries # enforce import layer rules
bun run clean[:cache]
bun run auth:generate    # regen Better Auth schema
bun run landing:build    # build Astro landing page
bun run landing:start    # preview landing on Railway-compatible host/port
```

First-time setup: `bun run setup`. After that, `bun dev` is the daily driver.

Gotchas:

- `bun dev` runs `scripts/dev-init.ts` before starting `web`, `worker`, and `landing`. If containers fail it warns but continues; verify with `bun run doctor`.
- "Module has no exported member" on typecheck usually means stale dist. Build the referenced `core/<pkg>`.
- Never bump `NODE_OPTIONS` memory; fix the root cause.
- `apps/web/src/routeTree.gen.ts` is generated; never edit.

---

## Skills

Skills live in `.agents/skills/<name>/SKILL.md`.

Before creating, migrating, refactoring, reviewing, or testing code in `apps/`, `modules/`, `core/`, `packages/`, or `tooling/`, open `.agents/skills/implementation/SKILL.md`. It contains the implementation rules and explains which domain reference to load for each kind of task.

Other operational skills:

- CI checks: `monitor-ci`
- Linear (`MON-*`): `linear-cli`
- UI/product design review: `montte-design` when the task is primarily visual/product polish

Skill content supersedes anything stale in this file.

---

## Workspace

```text
core/         # shared infrastructure packages
modules/      # domain modules
apps/         # web, worker, landing
packages/     # shared UI and package code
tooling/      # workspace tooling
```

`apps/landing` is the public Astro landing page and runs on port `3001` in development.

The product language is pt-BR. User-visible messages should stay in Brazilian Portuguese.

---

## Releases

Produto unico (`apps/web`) usa CalVer `YYYY.MM.DD` com tag `vYYYY.MM.DD`. Workflow `.github/workflows/release-weekly.yml` roda toda sexta 21:00 UTC: coleta commits + PRs mergeados desde a ultima tag, gera release notes em pt-BR, cria tag + GitHub Release + Linear Release. Manual via `workflow_dispatch` com `dry_run` opcional. Sem libraries publicadas; todo codigo vive no monorepo.
