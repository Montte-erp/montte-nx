# Monorepo Infrastructure Overhaul

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Overhaul monorepo tooling and structure: migrate Biome → OXC, clean up TypeScript configs, restructure into `core/` + `packages/`, and upgrade Drizzle to v1 beta.

**Architecture:** Replace Biome with OXC (oxlint + oxfmt) in `tooling/oxc/`, consolidate TypeScript configs into 3 presets (core, package, app), move infrastructure packages to `core/` with `@core/*` imports, and upgrade Drizzle ORM to v1 beta with relations v2.

**Tech Stack:** Nx 22.5, Bun workspaces, OXC (oxlint + oxfmt), TypeScript 5.9, Drizzle ORM v1 beta

---

## Phase 0: Biome → OXC Migration

### Task 1: Install OXC and create tooling/oxc

**Files:**
- Create: `tooling/oxc/package.json`
- Create: `tooling/oxc/base.json` — shared oxlint rules
- Create: `tooling/oxc/core.json` — core boundary enforcement
- Create: `tooling/oxc/package.json` — packages boundary enforcement
- Create: `tooling/oxc/app.json` — apps boundary enforcement
- Create: `tooling/oxc/oxfmt.json` — formatter config
- Modify: `package.json` (root) — add oxc deps, update `check`/`format` scripts

**Step 1: Install OXC**

```bash
bun add -d oxlint oxfmt
```

**Step 2: Create `tooling/oxc/package.json`**

```json
{
   "name": "@tooling/oxc",
   "version": "0.0.0",
   "private": true
}
```

**Step 3: Create `tooling/oxc/base.json`**

Shared oxlint config — equivalent of current Biome recommended rules:

```json
{
   "rules": {
      "no-console": "warn",
      "no-debugger": "error",
      "no-unused-vars": "warn",
      "no-undef": "off"
   },
   "plugins": ["typescript", "react", "import"]
}
```

**Step 4: Create `tooling/oxc/core.json`**

Core packages cannot import from `@packages/*` or apps:

```json
{
   "extends": ["./base.json"],
   "rules": {
      "no-restricted-imports": ["error", {
         "patterns": [
            { "group": ["@packages/*"], "message": "core/ cannot depend on packages/" },
            { "group": ["@/*"], "message": "core/ cannot depend on app internals" }
         ]
      }]
   }
}
```

**Step 5: Create `tooling/oxc/packages.json`**

Packages cannot import from apps:

```json
{
   "extends": ["./base.json"],
   "rules": {
      "no-restricted-imports": ["error", {
         "patterns": [
            { "group": ["@/*"], "message": "packages/ cannot depend on app internals" }
         ]
      }]
   }
}
```

**Step 6: Create `tooling/oxc/apps.json`**

Apps can import from everything but have their own rules:

```json
{
   "extends": ["./base.json"]
}
```

**Step 7: Create `tooling/oxc/oxfmt.json`**

Formatter config matching current Biome settings:

```json
{
   "tabWidth": 3,
   "useTabs": false,
   "printWidth": 80,
   "endOfLine": "lf",
   "semi": true,
   "singleQuote": false,
   "trailingComma": "all",
   "bracketSpacing": true,
   "arrowParens": "always",
   "sortImports": {
      "groups": [
         "builtin",
         "external",
         "internal",
         "parent",
         "sibling",
         "index"
      ],
      "internalPattern": ["@core/*", "@packages/*", "@/*"],
      "newlinesBetween": "always"
   },
   "sortTailwindcss": true
}
```

**Step 8: Commit**

```bash
git add tooling/oxc
git commit -m "chore: add OXC tooling configs (oxlint + oxfmt)"
```

---

### Task 2: Add oxlint configs to each workspace

Place `.oxlintrc.json` in each workspace root that extends the appropriate preset.

**Step 1: Core packages**

Create `.oxlintrc.json` in each core package directory (after Phase 2 moves them — for now create in `packages/` and they'll move with the package):

```json
{ "extends": ["../../tooling/oxc/core.json"] }
```

Apply to: `database`, `authentication`, `environment`, `redis`, `logging`, `utils`

**Step 2: Feature packages**

Create `.oxlintrc.json` in each remaining package:

```json
{ "extends": ["../../tooling/oxc/packages.json"] }
```

Apply to: `agents`, `analytics`, `arcjet`, `events`, `feedback`, `files`, `posthog`, `queue`, `search`, `stripe`, `transactional`, `ui`

**Step 3: Apps**

Create `.oxlintrc.json` in each app:

```json
{ "extends": ["../../tooling/oxc/apps.json"] }
```

Apply to: `web`, `server`, `worker`

**Step 4: Libraries**

Create `libraries/sdk/.oxlintrc.json`:

```json
{ "extends": ["../../tooling/oxc/packages.json"] }
```

**Step 5: Commit**

```bash
git add -A
git commit -m "chore: add per-workspace oxlint configs with boundary rules"
```

---

### Task 3: Update root scripts and remove Biome

**Files:**
- Modify: `package.json` (root) — replace `check`/`format` scripts
- Delete: `biome.json`

**Step 1: Update root package.json scripts**

Replace Biome commands with OXC:

```json
{
   "scripts": {
      "check": "oxlint",
      "format": "oxfmt --config tooling/oxc/oxfmt.json .",
      "format:check": "oxfmt --config tooling/oxc/oxfmt.json --check ."
   }
}
```

**Step 2: Remove Biome**

```bash
bun remove @biomejs/biome
rm biome.json
```

**Step 3: Run formatter to verify**

```bash
bun run format:check
```

**Step 4: Run linter to verify**

```bash
bun run check
```

Fix any new violations or adjust rules as needed.

**Step 5: Commit**

```bash
git add -A
git commit -m "chore: migrate from Biome to OXC (oxlint + oxfmt)"
```

---

## Phase 1: TypeScript Config Cleanup

### Task 4: Create new shared TypeScript presets

**Files:**
- Create: `tooling/typescript/core.json`
- Create: `tooling/typescript/package.json` (replace existing)
- Create: `tooling/typescript/app.json`
- Keep: `tooling/typescript/base.json`
- Delete: `tooling/typescript/internal-package.json`
- Delete: `tooling/typescript/internal-package-nocomposite.json`
- Delete: `tooling/typescript/typecheck.json`
- Delete: `tooling/typescript/vite.json`
- Delete: `tooling/typescript/astro.json`

**Step 1: Create `tooling/typescript/core.json`**

For `core/*` packages — strict, no emit, no DOM:

```json
{
   "extends": "./base.json",
   "compilerOptions": {
      "noEmit": true,
      "lib": ["ES2022"]
   },
   "exclude": ["node_modules", "dist", "**/*.test.ts", "**/__tests__/**"]
}
```

**Step 2: Create `tooling/typescript/package.json`**

For `packages/*` — typecheck only, includes DOM (some packages use React):

```json
{
   "extends": "./base.json",
   "compilerOptions": {
      "noEmit": true,
      "lib": ["ES2022", "DOM", "DOM.Iterable"]
   },
   "exclude": ["node_modules", "dist", "**/*.test.ts", "**/__tests__/**"]
}
```

**Step 3: Create `tooling/typescript/app.json`**

For `apps/*` — JSX, DOM, vite types:

```json
{
   "extends": "./base.json",
   "compilerOptions": {
      "noEmit": true,
      "jsx": "react-jsx",
      "lib": ["ES2022", "DOM", "DOM.Iterable"],
      "noUnusedLocals": true,
      "noUnusedParameters": true,
      "noFallthroughCasesInSwitch": true
   },
   "exclude": ["node_modules", "dist"]
}
```

**Step 4: Delete old presets**

```bash
rm tooling/typescript/internal-package.json
rm tooling/typescript/internal-package-nocomposite.json
rm tooling/typescript/typecheck.json
rm tooling/typescript/vite.json
rm tooling/typescript/astro.json
```

**Step 5: Commit**

```bash
git add -A
git commit -m "chore: consolidate TypeScript configs into 3 presets (core, package, app)"
```

---

### Task 5: Update all tsconfig.json files to use new presets

**Step 1: Update core packages (currently in packages/, will move later)**

Each gets a single `tsconfig.json` extending `@tooling/typescript/core.json`. Delete all `tsconfig.lib.json` files.

```jsonc
// packages/database/tsconfig.json
{
   "extends": "@tooling/typescript/core.json",
   "include": ["src"]
}

// packages/authentication/tsconfig.json
{
   "extends": "@tooling/typescript/core.json",
   "compilerOptions": { "jsx": "react-jsx" },
   "include": ["src"]
}

// packages/environment/tsconfig.json
{ "extends": "@tooling/typescript/core.json", "include": ["src"] }

// packages/redis/tsconfig.json
{ "extends": "@tooling/typescript/core.json", "include": ["src"] }

// packages/logging/tsconfig.json
{ "extends": "@tooling/typescript/core.json", "include": ["src"] }

// packages/utils/tsconfig.json
{ "extends": "@tooling/typescript/core.json", "include": ["src"] }
```

**Step 2: Update feature packages**

Each extends `@tooling/typescript/package.json`, adds JSX only if needed. Delete all `tsconfig.lib.json` files.

```jsonc
// packages/agents/tsconfig.json
{ "extends": "@tooling/typescript/package.json", "include": ["src"] }

// packages/analytics/tsconfig.json
{ "extends": "@tooling/typescript/package.json", "include": ["src"] }

// packages/arcjet/tsconfig.json
{
   "extends": "@tooling/typescript/package.json",
   "compilerOptions": { "jsx": "react-jsx" },
   "include": ["src"]
}

// packages/events/tsconfig.json
{ "extends": "@tooling/typescript/package.json", "include": ["src"] }

// packages/feedback/tsconfig.json
{ "extends": "@tooling/typescript/package.json", "include": ["src"] }

// packages/files/tsconfig.json
{ "extends": "@tooling/typescript/package.json", "include": ["src"] }

// packages/posthog/tsconfig.json
{
   "extends": "@tooling/typescript/package.json",
   "compilerOptions": { "jsx": "react-jsx" },
   "include": ["src"]
}

// packages/queue/tsconfig.json
{ "extends": "@tooling/typescript/package.json", "include": ["src"] }

// packages/search/tsconfig.json
{ "extends": "@tooling/typescript/package.json", "include": ["src"] }

// packages/stripe/tsconfig.json
{ "extends": "@tooling/typescript/package.json", "include": ["src"] }

// packages/transactional/tsconfig.json
{
   "extends": "@tooling/typescript/package.json",
   "compilerOptions": { "jsx": "react-jsx" },
   "include": ["src"]
}

// packages/ui/tsconfig.json
{
   "extends": "@tooling/typescript/package.json",
   "compilerOptions": {
      "jsx": "react-jsx",
      "paths": { "@packages/ui/*": ["./src/*"] }
   },
   "include": ["src"]
}
```

**Step 3: Update apps**

```jsonc
// apps/web/tsconfig.json
{
   "extends": "@tooling/typescript/app.json",
   "compilerOptions": {
      "types": ["vite/client"],
      "paths": {
         "@/*": ["./src/*"],
         "@packages/ui/*": ["../../packages/ui/src/*"]
      }
   },
   "include": ["src/**/*.ts", "src/**/*.tsx", "__tests__/**/*.ts", "__tests__/**/*.tsx"]
}

// apps/server/tsconfig.json
{
   "extends": "@tooling/typescript/app.json",
   "compilerOptions": {
      "paths": { "@api/*": ["./src/*"] }
   },
   "include": ["src"]
}

// apps/worker/tsconfig.json — extends app, removes DOM/JSX
{
   "extends": "@tooling/typescript/app.json",
   "compilerOptions": {
      "jsx": null,
      "lib": ["ES2022"]
   },
   "include": ["src"]
}
```

**Step 4: Update libraries/sdk**

SDK keeps its own config (publishable, unique needs):

```jsonc
// libraries/sdk/tsconfig.json — standalone, no preset
{
   "compilerOptions": {
      "target": "ES2022",
      "module": "Preserve",
      "moduleResolution": "bundler",
      "strict": true,
      "declaration": true,
      "noEmit": true,
      "verbatimModuleSyntax": true,
      "isolatedModules": true,
      "allowImportingTsExtensions": true,
      "noUncheckedIndexedAccess": true
   },
   "include": ["src"],
   "exclude": ["node_modules", "dist"]
}
```

**Step 5: Delete all tsconfig.lib.json files**

```bash
find packages -name "tsconfig.lib.json" -delete
```

**Step 6: Update root tsconfig.json**

Remove stale project references:

```json
{
   "extends": "@tooling/typescript/base.json",
   "files": [],
   "exclude": [".worktrees", "node_modules", "dist"]
}
```

**Step 7: Typecheck**

```bash
bun run typecheck
```

Fix any issues.

**Step 8: Commit**

```bash
git add -A
git commit -m "refactor: migrate all tsconfigs to 3 shared presets (core, package, app)"
```

---

## Phase 2: Monorepo Restructure

### Task 6: Create `core/` directory and update workspace config

**Files:**
- Create: `core/` directory
- Modify: `package.json` (root) — add `core/*` to workspaces
- Modify: `nx.json` — add `core/*` to release projects

**Step 1: Create core directory**

```bash
mkdir -p core
```

**Step 2: Update root package.json workspaces**

```json
"packages": [
   "core/*",
   "tooling/*",
   "libraries/*",
   "packages/*",
   "apps/*"
]
```

**Step 3: Update nx.json release projects**

```json
"release": {
   "projects": ["core/*", "apps/*", "packages/*"],
   "projectsRelationship": "independent"
}
```

**Step 4: Commit**

```bash
git add package.json nx.json
git commit -m "chore: add core/ workspace to monorepo config"
```

---

### Task 7: Move packages to `core/`

**Step 1: Move directories**

```bash
mv packages/database core/database
mv packages/authentication core/authentication
mv packages/environment core/environment
mv packages/redis core/redis
mv packages/logging core/logging
mv packages/utils core/utils
```

**Step 2: Update each package.json `name` field**

- `@packages/database` → `@core/database`
- `@packages/authentication` → `@core/authentication`
- `@packages/environment` → `@core/environment`
- `@packages/redis` → `@core/redis`
- `@packages/logging` → `@core/logging`
- `@packages/utils` → `@core/utils`

**Step 3: Update internal dependencies between core packages**

In each core package's `package.json`, update references to other core packages:
- `@core/database` → depends on `@core/utils`
- `@core/authentication` → depends on `@core/database`, `@core/environment`, `@core/redis`
- `@core/environment` → depends on `@core/utils`
- Check `@core/logging` for internal deps

**Step 4: Update oxlint config paths**

Each core package `.oxlintrc.json` path changes from `../../tooling/oxc/core.json` to `../../tooling/oxc/core.json` (same relative depth, no change needed).

**Step 5: Update tsconfig extends paths**

Each core package tsconfig stays the same — `@tooling/typescript/core.json` resolves via package name, not relative path.

**Step 6: Commit**

```bash
git add -A
git commit -m "chore: move infrastructure packages to core/"
```

---

### Task 8: Update all imports across the codebase

~349 import statements across ~108 files.

**Search and replace patterns:**

| Old | New |
|---|---|
| `@packages/database` | `@core/database` |
| `@packages/authentication` | `@core/authentication` |
| `@packages/environment` | `@core/environment` |
| `@packages/redis` | `@core/redis` |
| `@packages/logging` | `@core/logging` |
| `@packages/utils` | `@core/utils` |

**Step 1: Bulk find-and-replace in source files**

```bash
find apps packages libraries scripts core -type f \( -name "*.ts" -o -name "*.tsx" \) | \
  xargs sed -i \
    -e 's|@packages/database|@core/database|g' \
    -e 's|@packages/authentication|@core/authentication|g' \
    -e 's|@packages/environment|@core/environment|g' \
    -e 's|@packages/redis|@core/redis|g' \
    -e 's|@packages/logging|@core/logging|g' \
    -e 's|@packages/utils|@core/utils|g'
```

**Step 2: Update dependency references in all package.json files**

In every `package.json` under `apps/`, `packages/`, `libraries/`:
- `"@packages/database": "workspace:*"` → `"@core/database": "workspace:*"`
- Repeat for all 6 packages

Files to update:
- `apps/web/package.json`, `apps/server/package.json`, `apps/worker/package.json`
- `packages/agents/package.json`, `packages/analytics/package.json`, `packages/arcjet/package.json`
- `packages/events/package.json`, `packages/feedback/package.json`, `packages/files/package.json`
- `packages/posthog/package.json`, `packages/queue/package.json`, `packages/search/package.json`
- `packages/stripe/package.json`, `packages/transactional/package.json`, `packages/ui/package.json`
- `libraries/sdk/package.json`

**Step 3: Relink workspaces**

```bash
bun install
```

**Step 4: Typecheck**

```bash
bun run typecheck
```

**Step 5: Commit**

```bash
git add -A
git commit -m "refactor: update all imports from @packages/* to @core/* for core packages"
```

---

### Task 9: Cleanup and docs

**Step 1: Remove empty root `src/` directory**

```bash
rm -rf src
```

**Step 2: Update CLAUDE.md**

- Update monorepo structure diagram (add `core/`, remove moved packages from `packages/`)
- Update all import examples (`@packages/database` → `@core/database`, etc.)
- Update package exports section
- Add OXC reference (replace Biome mentions)
- Update TypeScript config references

**Step 3: Commit**

```bash
git add -A
git commit -m "docs: update CLAUDE.md for restructured monorepo"
```

---

## Phase 3: Drizzle v1 Upgrade

### Task 10: Update Drizzle dependencies

**Files:**
- Modify: `package.json` (root) — update catalog versions
- Modify: `core/database/package.json` — remove `drizzle-zod`

**Step 1: Update root catalog**

```json
"database": {
   "@types/pg": "^8.16.0",
   "drizzle-kit": "^1.0.0-beta",
   "drizzle-orm": "^1.0.0-beta",
   "pg": "^8.18.0"
}
```

Remove `"drizzle-zod"` from catalog.

**Step 2: Remove drizzle-zod from core/database/package.json**

**Step 3: Install and migrate**

```bash
bun install
cd core/database && npx drizzle-kit up
```

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: upgrade drizzle-orm and drizzle-kit to v1 beta"
```

---

### Task 11: Replace drizzle-zod imports

**Step 1: Find all drizzle-zod imports**

```bash
grep -r "drizzle-zod" --include="*.ts" --include="*.tsx" -l
```

**Step 2: Replace**

```typescript
// Old
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
// New
import { createInsertSchema, createSelectSchema } from "drizzle-orm/zod";
```

**Step 3: Typecheck**

```bash
bun run typecheck
```

**Step 4: Commit**

```bash
git add -A
git commit -m "refactor: migrate drizzle-zod imports to drizzle-orm/zod"
```

---

### Task 12: Migrate relational queries to v2 syntax

31 schema files with v1-style `relations()` → centralized `defineRelations()`.

**Files:**
- Create: `core/database/src/relations.ts`
- Modify: 31 schema files — remove `relations()` exports
- Modify: `core/database/src/schema.ts` — export relations
- Modify: `core/database/src/client.ts` — pass relations to drizzle client

**Step 1: Audit all existing relations**

Read every schema file that exports a `*Relations` variable. Document all relation definitions.

**Step 2: Create `core/database/src/relations.ts`**

```typescript
import { defineRelations } from "drizzle-orm";
import * as schema from "./schema";

export const relations = defineRelations(schema, (r) => ({
   // Migrate each table's relations using v2 syntax:
   // v1: one(targetTable, { fields: [x], references: [y], relationName: "z" })
   // v2: r.one.targetTable({ from: x, to: y, alias: "z" })
   //
   // v1: many(targetTable)
   // v2: r.many.targetTable()
   //
   // Example:
   transactions: {
      bankAccount: r.one.bankAccounts({
         from: r.transactions.bankAccountId,
         to: r.bankAccounts.id,
         alias: "sourceAccount",
      }),
      destinationBankAccount: r.one.bankAccounts({
         from: r.transactions.destinationBankAccountId,
         to: r.bankAccounts.id,
         alias: "destinationAccount",
      }),
      category: r.one.categories({
         from: r.transactions.categoryId,
         to: r.categories.id,
      }),
      subcategory: r.one.subcategories({
         from: r.transactions.subcategoryId,
         to: r.subcategories.id,
      }),
      creditCard: r.one.creditCards({
         from: r.transactions.creditCardId,
         to: r.creditCards.id,
      }),
      contact: r.one.contacts({
         from: r.transactions.contactId,
         to: r.contacts.id,
      }),
      transactionTags: r.many.transactionTags(),
      items: r.many.transactionItems(),
   },
   // ... all other tables with relations
}));
```

**Step 3: Remove v1 relation exports from schema files**

In each of the 31 schema files:
- Delete the `*Relations` export (e.g., `transactionsRelations`, `transactionTagsRelations`)
- Remove `relations` from the `drizzle-orm` import
- Keep table definitions and type exports

**Step 4: Update schema.ts**

Add at the end:

```typescript
export { relations } from "./relations";
```

**Step 5: Update client.ts**

Pass relations to drizzle client:

```typescript
import * as schema from "./schema";
import { relations } from "./relations";

const db = drizzle(client, { schema, relations });
```

**Step 6: Check `.query.*` usages for v2 API changes**

Search for `db.query.`, `.findFirst(`, `.findMany(` — verify filters/ordering still work. v2 may require object syntax instead of function callbacks.

**Step 7: Typecheck**

```bash
bun run typecheck
```

**Step 8: Commit**

```bash
git add -A
git commit -m "refactor: migrate drizzle relations to v2 defineRelations()"
```

---

### Task 13: Add drizzle-zod schema generation

**Step 1: Identify schemas used in oRPC router input validation**

Focus on: transactions, categories, contacts, bank-accounts, bills, services, etc.

**Step 2: Add generated schemas in schema files**

```typescript
import { createInsertSchema, createSelectSchema } from "drizzle-orm/zod";

export const insertTransactionSchema = createInsertSchema(transactions);
export const selectTransactionSchema = createSelectSchema(transactions);
```

**Step 3: Replace hand-written Zod schemas in routers where applicable**

Use `.pick()`, `.omit()`, `.extend()` on generated schemas instead of manual `z.object({})`.

**Step 4: Typecheck and test**

```bash
bun run typecheck
bun run test
```

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: add drizzle-zod schema generation for input validation"
```

---

## Phase 4: Verification

### Task 14: Full verification

**Step 1: Clean install**

```bash
rm -rf node_modules bun.lock
bun install
```

**Step 2: Typecheck**

```bash
bun run typecheck
```

**Step 3: Lint**

```bash
bun run check
```

**Step 4: Format check**

```bash
bun run format:check
```

**Step 5: Test**

```bash
bun run test
```

**Step 6: Build**

```bash
bun run build
```

**Step 7: Dev server smoke test**

```bash
bun dev
```

**Step 8: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: resolve issues from monorepo infrastructure overhaul"
```

---

## Summary

| Phase | Tasks | Impact |
|-------|-------|--------|
| **Phase 0: Biome → OXC** | Tasks 1-3 | Replace Biome with oxlint + oxfmt, add boundary enforcement |
| **Phase 1: TypeScript cleanup** | Tasks 4-5 | Consolidate ~36 tsconfigs into 3 presets, delete tsconfig.lib.json files |
| **Phase 2: Restructure** | Tasks 6-9 | Move 6 packages to `core/`, update ~349 imports, clean up |
| **Phase 3: Drizzle v1** | Tasks 10-13 | Upgrade deps, migrate drizzle-zod, rewrite 31 relation files, add schema generation |
| **Phase 4: Verify** | Task 14 | Full build/test/lint/format cycle |

### Risk notes
- **Relations v2 migration (Task 12)** is the highest-risk task — every `.query.*` call depends on correct relations. Test thoroughly.
- **Better Auth schema (auth.ts)** has relations managed by Better Auth — verify these still work after v2 migration or exclude them from `defineRelations()`.
- **Import renames (Task 8)** are mechanical but wide-reaching — typecheck catches misses.
- **OXC migration (Phase 0)** — run formatter once to normalize codebase, expect a large diff on first run.
- **TypeScript cleanup (Phase 1)** — removing `tsconfig.lib.json` may affect Nx `@nx/js/typescript` plugin build targets. Verify `bun run build` still works.
