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

Before working in any Montte area, open the skill for that area first. The skill is the source of truth for current rules, references, workflow, and validation.

| Area | Open this skill |
|------|-----------------|
| Implementation in `apps/`, `modules/`, `core/`, `packages/`, or `tooling/` | [implementation](.agents/skills/implementation/SKILL.md) |
| Review comments, PR findings, reported bugs, diffs, CI findings | [code-review](.agents/skills/code-review/SKILL.md) |
| UI, UX, product copy, layout, dashboards, forms, sheets, authenticated surfaces | [design](.agents/skills/design/SKILL.md) |
| Release workflows, release notes, tags, GitHub Releases, Linear Releases, recovery | [release](.agents/skills/release/SKILL.md) |
| Project documentation, `docs/project`, documentation automation | [docs](.agents/skills/docs/SKILL.md) |
| Blog, LinkedIn, X, release blog posts, marketing drafts | [marketing](.agents/skills/marketing/SKILL.md) |

When a task crosses areas, open each relevant skill. For example, a UI bug fix uses [code-review](.agents/skills/code-review/SKILL.md), [implementation](.agents/skills/implementation/SKILL.md), and [design](.agents/skills/design/SKILL.md); a release blog automation change uses [release](.agents/skills/release/SKILL.md), [marketing](.agents/skills/marketing/SKILL.md), and [implementation](.agents/skills/implementation/SKILL.md).

Other operational tools:

- CI checks: `monitor-ci`
- Linear (`MON-*`): `linear-cli`

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

Produto unico (`apps/web`) usa CalVer `YYYY.MM.DD` com tag `vYYYY.MM.DD`. Workflow [.github/workflows/release-weekly.yml](.github/workflows/release-weekly.yml) coleta commits + PRs mergeados desde a ultima tag, gera release notes em pt-BR via [release](.agents/skills/release/SKILL.md), cria tag + GitHub Release + Linear Release. Manual via `workflow_dispatch` com `dry_run` opcional. Sem libraries publicadas; todo codigo vive no monorepo.

Workflow [.github/workflows/blog-post-from-release.yml](.github/workflows/blog-post-from-release.yml) transforma releases publicadas em PR de post usando [marketing](.agents/skills/marketing/SKILL.md). Workflow [.github/workflows/project-documentation.yml](.github/workflows/project-documentation.yml) atualiza `docs/project` usando [docs](.agents/skills/docs/SKILL.md).
