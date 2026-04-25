# Classification Module Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate categories + tags (Centro de Custo) from scattered locations into a single `@modules/classification` module mirroring `@modules/billing`. Consolidate 5 workflows → 2 (+ backfill cron). Consolidate 4 AI actions → 2. Centralize OpenRouter model selection in new `@core/ai` package. Delete repository layer + old AI actions.

**Architecture:**
- New `@core/ai` package owns OpenRouter adapter exports (`proModel` = `deepseek/deepseek-v4-pro`, `flashModel` = `deepseek/deepseek-v4-flash`) + posthog AI middleware. Two models, picked per action.
- New `@modules/classification` mirrors `@modules/billing`: `src/{constants,contracts,ai,router,workflows}` + `__tests__/{router,workflows,ai,integration,helpers}`. Owns category/tag Zod contracts, oRPC routers, AI actions, DBOS workflows.
- Routers query `context.db` directly via neverthrow (no repos). Ownership via middleware passing entity through `next({ context })`.
- Workflows use `classificationDataSource.runTransaction` (DBOS-typed Drizzle), never plain `db`. Notification publisher + posthog + stripe injected via context store.
- 2 workflows: `classificationWorkflow` (categorize + suggest tag in one LLM pass via `flashModel`) and `deriveKeywordsWorkflow` (entity-discriminated, `proModel`). 3rd thin `backfillKeywordsWorkflow` is a daily cron that enqueues `deriveKeywordsWorkflow`.
- Drizzle table defs **stay** in `core/database/src/schemas/{categories,tags}.ts` (pg schema namespace = physical layer). Only Zod + types move.

**Tech Stack:** Bun, Nx, TypeScript, oRPC, Drizzle, neverthrow, DBOS (`@dbos-inc/dbos-sdk` + `drizzle-datasource`), TanStack AI (`@tanstack/ai` + `@tanstack/ai-openrouter`), Vitest, pglite + pglite-socket for integration tests, posthog-node `promptsClient`.

---

## Skills To Use

- @postgres-drizzle — schema queries, transactions, joins
- @neverthrow — `Result`/`ResultAsync`/`fromPromise`/`safeTry`/`andThen` (no `try/catch`)
- @dbos-typescript — DBOS workflows, queues, `runTransaction`, `delaySeconds`, mocking
- @tanstack-ai — chat, openRouter adapter, output schemas, middleware
- @orpc-router — procedure definition, middleware, context types
- @nx-workspace-patterns — package scaffolding, deps catalog wiring
- @verification-before-completion — every task ends with concrete `bun run` proof, no shipping on theory

## Pre-flight

Operate from a worktree (per the worktree-execution rule). Confirm before starting:

```bash
git status                                         # clean working tree
git rev-parse --show-toplevel                      # /home/yorizel/Documents/montte-nx
ls modules/billing                                 # exists — template
ls core/ai 2>/dev/null && echo EXISTS || echo OK   # must print OK (we'll create it)
```

---

## Task 0 — Update TanStack AI + OpenRouter catalog versions

**Status:** ✅ Done. Bumped to `@tanstack/ai ^0.14.0`, `@tanstack/ai-react ^0.8.0`, `@tanstack/ai-openrouter ^0.8.2` (commit `18faa9b3`). A follow-up patch (commit `c6154656`) applies `bun patch @tanstack/ai-openrouter` to add `deepseek/deepseek-v4-pro` and `deepseek/deepseek-v4-flash` to `OPENROUTER_CHAT_MODELS` so `core/ai/src/models.ts` does not need `@ts-expect-error` directives. Patch file at `patches/@tanstack%2Fai-openrouter@0.8.2.patch`; auto-applied on `bun install` via `package.json` `patchedDependencies`. Self-heals — when upstream lands the IDs natively, the patch will fail to apply (signal to delete it).

**Files:**
- Modify: `package.json` — `pnpm.catalogs.tanstack-ai` block

**Step 0.1 — Check latest published versions**

```bash
bun pm view @tanstack/ai version
bun pm view @tanstack/ai-react version
bun pm view @tanstack/ai-openrouter version
```

Note the three latest versions. Current pinned values: `@tanstack/ai ^0.10.2`, `@tanstack/ai-react ^0.7.10`, `@tanstack/ai-openrouter ^0.7.4`.

**Step 0.2 — Edit `package.json`**

In the `pnpm.catalogs.tanstack-ai` block, bump all three to the latest reported versions (keep the `^` prefix):

```json
"tanstack-ai": {
   "@tanstack/ai": "^X.Y.Z",
   "@tanstack/ai-react": "^X.Y.Z",
   "@tanstack/ai-openrouter": "^X.Y.Z"
}
```

**Step 0.3 — Reinstall + verify**

```bash
bun install
bun run typecheck
bun run test
```

Expected: install succeeds, typecheck + tests pass against the new TanStack AI / OpenRouter API. If the new major version breaks `chat({ adapter, ... })` signature or `openRouterText(...)` options shape, fix call sites in `core/agents/src/actions/*.ts` (still present at this point — they get deleted in Task 16) before continuing. If breakage is wide, pin to the last working minor and document in the commit message.

**Step 0.4 — Commit**

```bash
git add package.json bun.lock
git commit -m "chore(deps): bump @tanstack/ai + @tanstack/ai-openrouter catalog versions"
```

---

## Task 1 — Scaffold `@core/ai` package

**Files:**
- Create: `core/ai/package.json`
- Create: `core/ai/tsconfig.json`
- Create: `core/ai/src/models.ts`
- Create: `core/ai/src/middleware.ts`
- Create: `core/ai/src/observability.ts`

**Step 1.1 — Write `core/ai/package.json`**

```json
{
   "name": "@core/ai",
   "version": "0.1.0",
   "private": true,
   "type": "module",
   "exports": {
      "./models": "./src/models.ts",
      "./middleware": "./src/middleware.ts",
      "./observability": "./src/observability.ts"
   },
   "scripts": {
      "check": "oxlint ./src",
      "format": "oxfmt --write ./src",
      "format:check": "oxfmt --check ./src",
      "typecheck": "tsgo"
   },
   "dependencies": {
      "@core/environment": "workspace:*",
      "@core/posthog": "workspace:*",
      "@tanstack/ai": "catalog:tanstack-ai",
      "@tanstack/ai-openrouter": "catalog:tanstack-ai"
   },
   "devDependencies": {
      "@tooling/typescript": "workspace:*",
      "typescript": "catalog:development"
   }
}
```

**Step 1.2 — Write `core/ai/tsconfig.json`**

```json
{
   "extends": "@tooling/typescript/library.json",
   "include": ["src/**/*.ts"]
}
```

**Step 1.3 — Write `core/ai/src/observability.ts`**

```ts
import type { PostHog } from "@core/posthog/server";

export type AiObservabilityContext = {
   posthog: PostHog;
   distinctId: string;
   promptName?: string;
   promptVersion?: number;
};
```

**Step 1.4 — Move middleware: write `core/ai/src/middleware.ts`**

Copy verbatim from `core/agents/src/middleware/posthog.ts`. Replace the inline `AiObservabilityContext` type with `import type { AiObservabilityContext } from "./observability";`.

**Step 1.5 — Write `core/ai/src/models.ts`**

```ts
import { openRouterText } from "@tanstack/ai-openrouter";

const serverURL = process.env.OPENROUTER_BASE_URL || undefined;
const baseConfig = serverURL ? { serverURL } : undefined;

export const proModel = openRouterText("deepseek/deepseek-v4-pro", baseConfig);
export const flashModel = openRouterText(
   "deepseek/deepseek-v4-flash",
   baseConfig,
);
```

Notes:
- The `@tanstack/ai-openrouter` SDK reads `OPENROUTER_API_KEY` from `process.env` directly (`getOpenRouterApiKeyFromEnv`), so do NOT pass `apiKey` as a config option — the second arg is `Omit<SDKOptions, 'apiKey'>`. `@core/environment` is therefore NOT needed in `@core/ai`'s `dependencies`.
- The `OPENROUTER_BASE_URL` env override exists so aimock-driven tests can point the SDK at a local mock server. Set the env BEFORE importing this module (e.g. via vitest `test.env` config) — the module reads `process.env` once at load time.
- The deepseek IDs require the `@tanstack/ai-openrouter` patch from Task 0 (committed at `c6154656`). Without that patch, replace the model literals with `as` casts, OR use `// @ts-expect-error` directives placed on the line immediately before the model string (formatters split the call across lines).

**Step 1.6 — Verify**

```bash
bun install
bun nx run @core/ai:typecheck
```

Expected: passes.

**Step 1.7 — Commit**

```bash
git add core/ai
git commit -m "feat(core/ai): scaffold central AI package with deepseek pro/flash adapters"
```

---

## Task 2 — Add `@core/ai` link from `web` + `worker` + `core/agents` consumers

**Files:**
- Modify: `apps/web/package.json` (add `"@core/ai": "workspace:*"` if not present)
- Modify: `apps/worker/package.json` (same)

Skip if not yet imported anywhere. Step 2.1 verifies.

**Step 2.1 — Detect needed link points**

```bash
grep -rln "@core/agents/middleware\|core/agents/src/middleware" apps core packages modules 2>/dev/null
```

Currently only `core/agents/src/actions/*.ts` references the middleware. We will rewrite those importers in later tasks — no link needed yet. Skip this task; commit nothing.

---

## Task 3 — Add `POSTHOG_PROMPTS.classifyTransaction` consolidating prompt

**Files:**
- Modify: `core/posthog/src/config.ts:1-5`

**Step 3.1 — Edit `POSTHOG_PROMPTS`**

Change from:
```ts
export const POSTHOG_PROMPTS = {
   categorizeTransaction: "montte-categorize-transaction",
   deriveKeywords: "montte-derive-keywords",
   suggestTag: "montte-suggest-tag",
} as const;
```

To:
```ts
export const POSTHOG_PROMPTS = {
   classifyTransaction: "montte-classify-transaction",
   deriveKeywords: "montte-derive-keywords",
} as const;
```

**Step 3.2 — Author the prompt in PostHog UI** (manual)

Create `montte-classify-transaction` with template variables: `category_list`, `tag_list`, `type` (income/expense). System prompt should ask the model to return both `categoryName` and `tagName` (either nullable). See `core/agents/src/actions/categorize.ts:14-104` for the pattern of the old separate prompts to merge.

`montte-derive-keywords` already exists (uses `entity_label`, `min_keywords`, `max_keywords`).

> NOTE FOR EXECUTOR: this is a manual step. Confirm with user that the new `montte-classify-transaction` prompt is published before merging the implementation tasks below.

**Step 3.3 — Verify typecheck**

```bash
bun nx run @core/posthog:typecheck
```

Expected: passes (no consumer of removed keys exists yet — `core/agents/src/actions/{categorize,suggest-tag}.ts` will be deleted in Task 16).

**Step 3.4 — Commit**

```bash
git add core/posthog/src/config.ts
git commit -m "feat(posthog): consolidate categorize+suggest-tag into classifyTransaction prompt"
```

---

## Task 4 — Scaffold `@modules/classification` package

**Files:**
- Create: `modules/classification/package.json`
- Create: `modules/classification/tsconfig.json`
- Create: `modules/classification/vitest.config.ts`
- Create: `modules/classification/src/constants.ts`

**Step 4.1 — Write `modules/classification/package.json`**

```json
{
   "name": "@modules/classification",
   "version": "0.1.0",
   "private": true,
   "license": "Apache-2.0",
   "type": "module",
   "exports": {
      "./router/*": "./src/router/*.ts",
      "./contracts/*": "./src/contracts/*.ts",
      "./workflows/*": "./src/workflows/*.ts",
      "./ai/*": "./src/ai/*.ts",
      "./*": "./src/*.ts"
   },
   "scripts": {
      "check": "oxlint ./src",
      "format": "oxfmt --write ./src",
      "format:check": "oxfmt --check ./src",
      "test": "vitest run --passWithNoTests",
      "typecheck": "tsgo"
   },
   "dependencies": {
      "@core/ai": "workspace:*",
      "@core/database": "workspace:*",
      "@core/dbos": "workspace:*",
      "@core/environment": "workspace:*",
      "@core/logging": "workspace:*",
      "@core/orpc": "workspace:*",
      "@core/posthog": "workspace:*",
      "@core/redis": "workspace:*",
      "@core/stripe": "workspace:*",
      "@dbos-inc/dbos-sdk": "catalog:workers",
      "@dbos-inc/drizzle-datasource": "catalog:workers",
      "@orpc/server": "catalog:orpc",
      "@packages/events": "workspace:*",
      "@packages/notifications": "workspace:*",
      "@tanstack/ai": "catalog:tanstack-ai",
      "@tanstack/ai-openrouter": "catalog:tanstack-ai",
      "@tanstack/store": "catalog:tanstack",
      "dayjs": "catalog:ui",
      "drizzle-orm": "catalog:database",
      "drizzle-zod": "catalog:database",
      "neverthrow": "catalog:validation",
      "zod": "catalog:validation"
   },
   "devDependencies": {
      "@electric-sql/pglite": "^0.3.15",
      "@electric-sql/pglite-socket": "^0.0.20",
      "@tooling/typescript": "workspace:*",
      "drizzle-kit": "catalog:database",
      "drizzle-seed": "catalog:database",
      "typescript": "catalog:development",
      "vitest": "catalog:testing"
   }
}
```

**Step 4.2 — Write `modules/classification/tsconfig.json`**

Copy `modules/billing/tsconfig.json`.

**Step 4.3 — Write `modules/classification/vitest.config.ts`**

Copy `modules/billing/vitest.config.ts`.

**Step 4.4 — Write `modules/classification/src/constants.ts`**

```ts
export const CLASSIFICATION_QUEUES = {
   classify: "classify",
   deriveKeywords: "derive-keywords",
   backfillKeywords: "backfill-keywords",
} as const;

export type ClassificationQueueName = keyof typeof CLASSIFICATION_QUEUES;
```

**Step 4.5 — Verify**

```bash
bun install
bun nx run @modules/classification:typecheck
```

Expected: passes (no source files yet beyond constants).

**Step 4.6 — Commit**

```bash
git add modules/classification
git commit -m "feat(modules/classification): scaffold package mirroring @modules/billing"
```

---

## Task 5 — Move Zod contracts (categories + tags)

**Status:** ✅ Done (commit `27d0b3a2`). Plan deviation: Option A — Zod schemas physically stay in `core/database/src/schemas/{categories,tags}.ts`; `modules/classification/src/contracts/{categories,tags}.ts` are pure re-exports. Avoids a circular dep (classification re-imports the Drizzle table from `@core/database`, so a back-compat re-export from `@core/database` to `@modules/classification` would close the cycle). Apps/web routers updated to canonical path `@modules/classification/contracts/*`. Validators test moved. Task 14 will physically relocate the Zod source once the repos in `core/database` are deleted.

**Files:**
- Create: `modules/classification/src/contracts/categories.ts`
- Create: `modules/classification/src/contracts/tags.ts`
- Modify: `core/database/src/schemas/categories.ts:65-153` (remove Zod, keep only table + types)
- Modify: `core/database/src/schemas/tags.ts:41-75` (same)

**Step 5.1 — Write `modules/classification/src/contracts/categories.ts`**

Move lines 65-153 of `core/database/src/schemas/categories.ts` (everything from `export type Category` onwards: types + Zod). Replace `import { financeSchema } ...` etc with:

```ts
import { z } from "zod";
import { createInsertSchema } from "drizzle-zod";
import { categories } from "@core/database/schemas/categories";

export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type CategoryType = "income" | "expense";

const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;
// ... rest as before, including refineDreGroup, createCategorySchema, updateCategorySchema
```

**Step 5.2 — Write `modules/classification/src/contracts/tags.ts`**

Move lines 41-75 of `core/database/src/schemas/tags.ts` analogously.

**Step 5.3 — Strip Zod from schemas**

Delete lines 65-153 of `core/database/src/schemas/categories.ts`. Delete lines 41-75 of `core/database/src/schemas/tags.ts`. Keep only Drizzle table + enum + raw `Category`/`Tag` types.

**Step 5.4 — Update imports across repo**

```bash
grep -rln '"@core/database/schemas/categories"\|"@core/database/schemas/tags"' apps core packages modules
```

For every file importing `createCategorySchema | updateCategorySchema | CreateCategoryInput | UpdateCategoryInput` from `@core/database/schemas/categories`, swap to `@modules/classification/contracts/categories`. Same for tags.

**Step 5.5 — Verify**

```bash
bun nx run @modules/classification:typecheck
bun nx run @core/database:typecheck
bun nx run @apps/web:typecheck     # will still fail later — track for Task 14
```

Expected: classification + database pass. web will still typecheck since router files in apps/web import from old path (we'll fix in Task 14 when we move routers — for now, restore back-compat in next sub-step).

**Step 5.5b — Back-compat re-exports during migration**

Append to `core/database/src/schemas/categories.ts`:
```ts
export {
   createCategorySchema,
   updateCategorySchema,
   type CreateCategoryInput,
   type UpdateCategoryInput,
} from "@modules/classification/contracts/categories";
```
Same for tags. Remove these re-exports in Task 14 once router migration completes.

**Step 5.6 — Commit**

```bash
git add modules/classification core/database
git commit -m "refactor(classification): move category+tag Zod contracts to @modules/classification/contracts"
```

---

## Task 6 — Add `classificationDataSource` + workflow context

**Files:**
- Create: `modules/classification/src/workflows/context.ts`

**Step 6.1 — Write `modules/classification/src/workflows/context.ts`**

```ts
import { DrizzleDataSource } from "@dbos-inc/drizzle-datasource";
import { WorkflowQueue } from "@dbos-inc/dbos-sdk";
import { createStore } from "@tanstack/store";
import type { DatabaseInstance } from "@core/database/client";
import * as schema from "@core/database/schema";
import { env } from "@core/environment/worker";
import type { Redis } from "@core/redis/connection";
import type { PostHog } from "@core/posthog/server";
import type { StripeClient } from "@core/stripe";
import { createJobPublisher } from "@packages/notifications/publisher";
import { CLASSIFICATION_QUEUES } from "../constants";

export { createEnqueuer } from "@core/dbos/factory";

export const classificationDataSource = new DrizzleDataSource<DatabaseInstance>(
   "classification",
   { connectionString: env.DATABASE_URL },
   schema,
);

type ClassificationWorkflowContext = {
   publisher: ReturnType<typeof createJobPublisher> | null;
   posthog: PostHog | null;
   redis: Redis | null;
   stripeClient: StripeClient | null;
};

const store = createStore<ClassificationWorkflowContext>({
   publisher: null,
   posthog: null,
   redis: null,
   stripeClient: null,
});

export function initClassificationWorkflowContext(deps: {
   redis: Redis;
   posthog: PostHog;
   stripeClient: StripeClient | null;
}) {
   store.setState(() => ({
      publisher: createJobPublisher(deps.redis),
      posthog: deps.posthog,
      redis: deps.redis,
      stripeClient: deps.stripeClient,
   }));
}

export function getClassificationPublisher() {
   const { publisher } = store.state;
   if (!publisher) throw new Error("Classification workflow context not initialized");
   return publisher;
}

export function getClassificationPosthog(): PostHog {
   const { posthog } = store.state;
   if (!posthog) throw new Error("Classification workflow context not initialized");
   return posthog;
}

export function getClassificationRedis(): Redis {
   const { redis } = store.state;
   if (!redis) throw new Error("Classification workflow context not initialized");
   return redis;
}

export function getClassificationStripe(): StripeClient | null {
   return store.state.stripeClient;
}

export function createClassificationQueues(options: { workerConcurrency: number }) {
   return Object.values(CLASSIFICATION_QUEUES).map(
      (name) => new WorkflowQueue(`workflow:${name}`, options),
   );
}
```

**Step 6.2 — Verify**

```bash
bun nx run @modules/classification:typecheck
```

Expected: passes.

**Step 6.3 — Commit**

```bash
git add modules/classification/src/workflows/context.ts
git commit -m "feat(classification): add classificationDataSource + workflow context store"
```

---

## Task 7 — Move AI middleware imports + write `ai/classify.ts`

**Files:**
- Create: `modules/classification/src/ai/classify.ts`
- Create: `modules/classification/__tests__/ai/classify.test.ts`

**Testing AI actions (applies to Tasks 7, 8):** use [aimock](https://github.com/CopilotKit/aimock) (live demo: https://aimock.copilotkit.dev/) to fake OpenRouter responses. Prefer mocking the LLM at the HTTP boundary via aimock over `vi.mock("@tanstack/ai", ...)` where practical — gives realistic streaming + tool-call shapes. The `vi.mock` snippets below remain valid as a fallback for unit tests that just need a stubbed `chat()` return.

**Step 7.1 — Write the failing test**

`modules/classification/__tests__/ai/classify.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/ai", () => ({
   chat: vi.fn().mockResolvedValue({ categoryName: "Food", tagName: "Operations" }),
}));
vi.mock("@core/posthog/server", () => ({
   promptsClient: {
      get: vi.fn().mockResolvedValue({ prompt: "system", name: "p", version: 1 }),
      compile: vi.fn((p: string) => p),
   },
}));

import { classifyTransaction } from "../../src/ai/classify";

describe("classifyTransaction", () => {
   it("returns categoryId + tagId resolved from names", async () => {
      const cats = [{ id: "cat-1", name: "Food", keywords: null }];
      const tags = [{ id: "tag-1", name: "Operations", keywords: null }];
      const result = await classifyTransaction(
         { name: "Burger", type: "expense" },
         cats,
         tags,
         { posthog: { capture: vi.fn() } as never, distinctId: "team-1" },
      );
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
         expect(result.value).toEqual({ categoryId: "cat-1", tagId: "tag-1" });
      }
   });

   it("returns null tagId when AI returns null tagName", async () => {
      const { chat } = await import("@tanstack/ai");
      vi.mocked(chat).mockResolvedValueOnce({ categoryName: "Food", tagName: null });
      const result = await classifyTransaction(
         { name: "X", type: "expense" },
         [{ id: "cat-1", name: "Food", keywords: null }],
         [],
         { posthog: { capture: vi.fn() } as never, distinctId: "team-1" },
      );
      expect(result.isOk()).toBe(true);
      if (result.isOk()) expect(result.value.tagId).toBeNull();
   });

   it("returns AppError when no match found", async () => {
      const { chat } = await import("@tanstack/ai");
      vi.mocked(chat).mockResolvedValueOnce({ categoryName: "Unknown", tagName: null });
      const result = await classifyTransaction(
         { name: "X", type: "expense" },
         [{ id: "cat-1", name: "Food", keywords: null }],
         [],
         { posthog: { capture: vi.fn() } as never, distinctId: "team-1" },
      );
      expect(result.isErr()).toBe(true);
   });
});
```

**Step 7.2 — Run test (must fail)**

```bash
bun nx run @modules/classification:test -- ai/classify
```

Expected: FAIL — `classifyTransaction` does not exist.

**Step 7.3 — Implement `modules/classification/src/ai/classify.ts`**

```ts
import { fromPromise, ok, err, safeTry } from "neverthrow";
import { chat } from "@tanstack/ai";
import { z } from "zod";
import { AppError } from "@core/logging/errors";
import { promptsClient } from "@core/posthog/server";
import { POSTHOG_PROMPTS } from "@core/posthog/config";
import { flashModel } from "@core/ai/models";
import { createPosthogAiMiddleware } from "@core/ai/middleware";
import type { AiObservabilityContext } from "@core/ai/observability";

export const classifyOptionSchema = z.object({
   id: z.string(),
   name: z.string(),
   keywords: z.array(z.string()).nullish(),
});

export const classifyInputSchema = z.object({
   name: z.string(),
   type: z.enum(["income", "expense"]),
   contactName: z.string().nullish(),
});

export const classifyResultSchema = z.object({
   categoryId: z.string(),
   tagId: z.string().nullable(),
});

export type ClassifyOption = z.infer<typeof classifyOptionSchema>;
export type ClassifyInput = z.infer<typeof classifyInputSchema>;
export type ClassifyResult = z.infer<typeof classifyResultSchema>;

const outputSchema = z.object({
   categoryName: z.string().nullable(),
   tagName: z.string().nullable(),
});

function formatList(items: ClassifyOption[]) {
   return items
      .map(
         (i) =>
            `- ${i.name}${i.keywords?.length ? ` (palavras: ${i.keywords.join(", ")})` : ""}`,
      )
      .join("\n");
}

export function classifyTransaction(
   input: ClassifyInput,
   categories: ClassifyOption[],
   tags: ClassifyOption[],
   observability: AiObservabilityContext,
) {
   const userContent = [
      `Nome: ${input.name}`,
      `Tipo: ${input.type === "income" ? "Receita" : "Despesa"}`,
      ...(input.contactName ? [`Contato: ${input.contactName}`] : []),
   ].join("\n");

   return safeTry(async function* () {
      const { prompt, name, version } = yield* fromPromise(
         promptsClient.get(POSTHOG_PROMPTS.classifyTransaction, {
            withMetadata: true,
         }),
         (e) => AppError.internal("Falha na classificação por IA.", { cause: e }),
      );

      const result = yield* fromPromise(
         chat({
            adapter: flashModel,
            systemPrompts: [
               promptsClient.compile(prompt, {
                  category_list: formatList(categories),
                  tag_list: formatList(tags),
                  type: input.type,
               }),
            ],
            messages: [
               { role: "user", content: [{ type: "text", content: userContent }] },
            ],
            outputSchema,
            stream: false,
            middleware: [
               createPosthogAiMiddleware({
                  ...observability,
                  promptName: name,
                  promptVersion: version,
               }),
            ],
         }),
         (e) => AppError.internal("Falha na classificação por IA.", { cause: e }),
      );

      if (!result.categoryName)
         return err(AppError.notFound("Nenhuma categoria sugerida pela IA."));

      const categoryMatch = categories.find((c) => c.name === result.categoryName);
      if (!categoryMatch)
         return err(AppError.notFound("Categoria sugerida não encontrada."));

      const tagMatch = result.tagName
         ? (tags.find((t) => t.name === result.tagName) ?? null)
         : null;

      return ok({ categoryId: categoryMatch.id, tagId: tagMatch?.id ?? null });
   });
}
```

**Step 7.4 — Run test (must pass)**

```bash
bun nx run @modules/classification:test -- ai/classify
```

Expected: PASS (3 tests).

**Step 7.5 — Commit**

```bash
git add modules/classification/src/ai/classify.ts modules/classification/__tests__/ai/classify.test.ts
git commit -m "feat(classification/ai): classifyTransaction (one-shot category+tag via flashModel)"
```

---

## Task 8 — Write `ai/derive-keywords.ts`

**Files:**
- Create: `modules/classification/src/ai/derive-keywords.ts`
- Create: `modules/classification/__tests__/ai/derive-keywords.test.ts`

**Step 8.1 — Write failing test**

```ts
import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/ai", () => ({
   chat: vi.fn().mockResolvedValue({ keywords: ["a", "b", "c", "d", "e"] }),
}));
vi.mock("@core/posthog/server", () => ({
   promptsClient: {
      get: vi.fn().mockResolvedValue({ prompt: "system", name: "p", version: 1 }),
      compile: vi.fn((p: string) => p),
   },
}));

import { deriveKeywords } from "../../src/ai/derive-keywords";

describe("deriveKeywords", () => {
   it("derives keywords for category entity", async () => {
      const result = await deriveKeywords(
         { entity: "category", name: "Food", description: null },
         { posthog: { capture: vi.fn() } as never, distinctId: "team-1" },
      );
      expect(result.isOk()).toBe(true);
      if (result.isOk()) expect(result.value).toEqual(["a", "b", "c", "d", "e"]);
   });

   it("derives keywords for tag entity", async () => {
      const result = await deriveKeywords(
         { entity: "tag", name: "Marketing", description: "promo activities" },
         { posthog: { capture: vi.fn() } as never, distinctId: "team-1" },
      );
      expect(result.isOk()).toBe(true);
   });
});
```

**Step 8.2 — Run test (must fail)**

```bash
bun nx run @modules/classification:test -- ai/derive-keywords
```

Expected: FAIL.

**Step 8.3 — Implement `modules/classification/src/ai/derive-keywords.ts`**

```ts
import { fromPromise, ok, safeTry } from "neverthrow";
import { chat } from "@tanstack/ai";
import { z } from "zod";
import { AppError } from "@core/logging/errors";
import { promptsClient } from "@core/posthog/server";
import { POSTHOG_PROMPTS } from "@core/posthog/config";
import { proModel } from "@core/ai/models";
import { createPosthogAiMiddleware } from "@core/ai/middleware";
import type { AiObservabilityContext } from "@core/ai/observability";

const KEYWORDS_MIN = 5;
const KEYWORDS_MAX = 15;

export const deriveKeywordsInputSchema = z.object({
   entity: z.enum(["category", "tag"]),
   name: z.string(),
   description: z.string().nullish(),
});

export type DeriveKeywordsInput = z.infer<typeof deriveKeywordsInputSchema>;

const outputSchema = z.object({
   keywords: z
      .array(z.string().min(1).max(60))
      .min(KEYWORDS_MIN)
      .max(KEYWORDS_MAX),
});

const ENTITY_LABEL: Record<DeriveKeywordsInput["entity"], string> = {
   category: "categoria financeira",
   tag: "centro de custo",
};

export function deriveKeywords(
   input: DeriveKeywordsInput,
   observability: AiObservabilityContext,
) {
   const userContent = [
      `${ENTITY_LABEL[input.entity]}: ${input.name}`,
      ...(input.description ? [`Descrição: ${input.description}`] : []),
   ].join("\n");

   return safeTry(async function* () {
      const { prompt, name, version } = yield* fromPromise(
         promptsClient.get(POSTHOG_PROMPTS.deriveKeywords, { withMetadata: true }),
         (e) =>
            AppError.internal("Falha na derivação de palavras-chave por IA.", {
               cause: e,
            }),
      );

      const result = yield* fromPromise(
         chat({
            adapter: proModel,
            systemPrompts: [
               promptsClient.compile(prompt, {
                  entity_label: ENTITY_LABEL[input.entity],
                  min_keywords: KEYWORDS_MIN,
                  max_keywords: KEYWORDS_MAX,
               }),
            ],
            messages: [
               { role: "user", content: [{ type: "text", content: userContent }] },
            ],
            outputSchema,
            stream: false,
            middleware: [
               createPosthogAiMiddleware({
                  ...observability,
                  promptName: name,
                  promptVersion: version,
               }),
            ],
         }),
         (e) =>
            AppError.internal("Falha na derivação de palavras-chave por IA.", {
               cause: e,
            }),
      );

      return ok(result.keywords);
   });
}
```

**Step 8.4 — Run test (must pass)**

```bash
bun nx run @modules/classification:test -- ai/derive-keywords
```

Expected: PASS.

**Step 8.5 — Commit**

```bash
git add modules/classification/src/ai
git commit -m "feat(classification/ai): deriveKeywords (entity-discriminated, proModel)"
```

---

## Task 9 — Add `notifications` types and helpers for new workflow shape

**Files:**
- Modify: `packages/notifications/src/types.ts` (add `AI_TRANSACTION_CLASSIFIED`, `AI_KEYWORDS_DERIVED`; keep `CRON_KEYWORDS_BACKFILL`)
- Remove later (Task 17): `AI_TRANSACTION_CATEGORIZED`, `AI_TAG_SUGGESTED`, `AI_KEYWORD_DERIVED`, `AI_TAG_KEYWORD_DERIVED`

**Step 9.1 — Read current types**

```bash
grep -n "AI_" packages/notifications/src/types.ts packages/notifications/src/schema.ts
```

**Step 9.2 — Append new constants** to `packages/notifications/src/types.ts` (don't delete old yet — still wired):

```ts
export const NOTIFICATION_TYPES = {
   // ... existing
   AI_TRANSACTION_CLASSIFIED: "ai.transaction_classified",
   AI_KEYWORDS_DERIVED: "ai.keywords_derived",
} as const;
```

If `schema.ts` validates payload union — extend with the same keys + `payload?: { transactionId?: string; categoryId?: string; tagId?: string; entity?: "category" | "tag"; count?: number }`.

**Step 9.3 — Verify**

```bash
bun nx run @packages/notifications:typecheck
```

Expected: passes.

**Step 9.4 — Commit**

```bash
git add packages/notifications
git commit -m "feat(notifications): add AI_TRANSACTION_CLASSIFIED + AI_KEYWORDS_DERIVED notification types"
```

---

## Task 10 — Implement `classification-workflow.ts` (TDD)

**Files:**
- Create: `modules/classification/src/workflows/classification-workflow.ts`
- Create: `modules/classification/__tests__/workflows/classification.test.ts`
- Create: `modules/classification/__tests__/helpers/classification-factories.ts`
- Create: `modules/classification/__tests__/helpers/mock-classification-context.ts`

Reference: `modules/billing/__tests__/helpers/mock-billing-context.ts` and `modules/billing/__tests__/workflows/period-end-invoice.test.ts`.

**Step 10.1 — Write helpers**

`modules/classification/__tests__/helpers/mock-classification-context.ts`:

```ts
import { vi } from "vitest";
import type { Redis } from "@core/redis/connection";
import type { PostHog } from "@core/posthog/server";

export const classificationPublisherSpy = { publish: vi.fn().mockResolvedValue(undefined) };
export const classificationPosthogSpy = { capture: vi.fn() };

vi.mock("../../src/workflows/context", async (importOriginal) => {
   const actual = await importOriginal<typeof import("../../src/workflows/context")>();
   return {
      ...actual,
      getClassificationPublisher: () => classificationPublisherSpy,
      getClassificationPosthog: () => classificationPosthogSpy as unknown as PostHog,
      getClassificationRedis: () =>
         ({
            multi: () => ({ exec: () => Promise.resolve([]) }),
            incr: () => Promise.resolve(1),
         }) as unknown as Redis,
      getClassificationStripe: () => null,
   };
});
```

`modules/classification/__tests__/helpers/classification-factories.ts`:

```ts
import { categories } from "@core/database/schemas/categories";
import { tags } from "@core/database/schemas/tags";
import { transactions } from "@core/database/schemas/transactions";
import type { DatabaseInstance } from "@core/database/client";

export async function makeCategory(
   db: DatabaseInstance,
   teamId: string,
   overrides: Partial<typeof categories.$inferInsert> = {},
) {
   const [row] = await db
      .insert(categories)
      .values({
         teamId,
         name: overrides.name ?? "Default Category",
         type: overrides.type ?? "expense",
         level: 1,
         ...overrides,
      })
      .returning();
   return row;
}

export async function makeTag(
   db: DatabaseInstance,
   teamId: string,
   overrides: Partial<typeof tags.$inferInsert> = {},
) {
   const [row] = await db
      .insert(tags)
      .values({ teamId, name: overrides.name ?? "Default Tag", ...overrides })
      .returning();
   return row;
}

export async function makeTransaction(
   db: DatabaseInstance,
   teamId: string,
   bankAccountId: string,
   overrides: Partial<typeof transactions.$inferInsert> = {},
) {
   const [row] = await db
      .insert(transactions)
      .values({
         teamId,
         bankAccountId,
         name: overrides.name ?? "Test tx",
         amount: "100.00",
         type: overrides.type ?? "expense",
         date: new Date(),
         ...overrides,
      })
      .returning();
   return row;
}
```

**Step 10.2 — Write failing classification workflow test**

`modules/classification/__tests__/workflows/classification.test.ts`. Mirror `period-end-invoice.test.ts:1-50` boilerplate (`vi.hoisted`, `dbosSdkMockFactory`, `drizzleDataSourceMockFactory`):

```ts
import {
   afterAll, beforeAll, beforeEach, describe, expect, it, vi,
} from "vitest";

const dbosMocks = vi.hoisted(async () => {
   const mod = await import("@core/dbos/testing/mock-dbos");
   return mod.createDbosMocks();
});

vi.mock("@dbos-inc/dbos-sdk", async () => {
   const mod = await import("@core/dbos/testing/mock-dbos");
   return mod.dbosSdkMockFactory(await dbosMocks);
});
vi.mock("@dbos-inc/drizzle-datasource", async () => {
   const mod = await import("@core/dbos/testing/mock-dbos");
   return mod.drizzleDataSourceMockFactory(await dbosMocks);
});

vi.mock("../../src/ai/classify", () => ({
   classifyTransaction: vi.fn(),
}));

import { classificationPublisherSpy } from "../helpers/mock-classification-context";
import { setupTestDb } from "@core/database/testing/setup-test-db";
import { seedTeam } from "@core/database/testing/factories";
import { makeCategory, makeTag, makeTransaction } from "../helpers/classification-factories";
import { eq } from "drizzle-orm";
import { transactions } from "@core/database/schemas/transactions";
import { ok, err } from "neverthrow";
import { AppError } from "@core/logging/errors";

import { classificationWorkflow } from "../../src/workflows/classification-workflow";
import { classifyTransaction as mockClassify } from "../../src/ai/classify";

let testDb: Awaited<ReturnType<typeof setupTestDb>>;

beforeAll(async () => {
   testDb = await setupTestDb();
   const mocks = await dbosMocks;
   mocks.setActiveDb(testDb.db);
}, 30_000);

afterAll(async () => {
   await testDb.cleanup();
});

beforeEach(async () => {
   vi.clearAllMocks();
   const mocks = await dbosMocks;
   mocks.setActiveDb(testDb.db);
});

describe("classificationWorkflow", () => {
   it("matches by category keywords first (no AI call) then applies category", async () => {
      const { teamId, bankAccountId } = await seedTeam(testDb.db);
      const cat = await makeCategory(testDb.db, teamId, {
         name: "Food", keywords: ["uber eats"],
      });
      const tx = await makeTransaction(testDb.db, teamId, bankAccountId, {
         name: "Uber Eats Friday", type: "expense",
      });

      await classificationWorkflow({
         transactionId: tx.id, teamId, name: tx.name, type: "expense",
      });

      const [updated] = await testDb.db.select().from(transactions).where(eq(transactions.id, tx.id));
      expect(updated.categoryId).toBe(cat.id);
      expect(mockClassify).not.toHaveBeenCalled();
   });

   it("falls back to AI when no keyword match → writes suggestedCategoryId + suggestedTagId", async () => {
      const { teamId, bankAccountId } = await seedTeam(testDb.db);
      const cat = await makeCategory(testDb.db, teamId, { name: "Food" });
      const tag = await makeTag(testDb.db, teamId, { name: "Operations" });
      const tx = await makeTransaction(testDb.db, teamId, bankAccountId, {
         name: "Random merchant", type: "expense",
      });

      vi.mocked(mockClassify).mockResolvedValueOnce(
         ok({ categoryId: cat.id, tagId: tag.id }),
      );

      await classificationWorkflow({
         transactionId: tx.id, teamId, name: tx.name, type: "expense",
      });

      const [updated] = await testDb.db.select().from(transactions).where(eq(transactions.id, tx.id));
      expect(updated.suggestedCategoryId).toBe(cat.id);
      expect(updated.suggestedTagId).toBe(tag.id);
      expect(classificationPublisherSpy.publish).toHaveBeenCalledWith(
         "job.notification",
         expect.objectContaining({ type: "ai.transaction_classified", status: "completed" }),
      );
   });

   it("publishes failed notification on AI error", async () => {
      const { teamId, bankAccountId } = await seedTeam(testDb.db);
      await makeCategory(testDb.db, teamId, { name: "Food" });
      const tx = await makeTransaction(testDb.db, teamId, bankAccountId, {
         name: "X", type: "expense",
      });

      vi.mocked(mockClassify).mockResolvedValueOnce(
         err(AppError.internal("AI fail")),
      );

      await classificationWorkflow({
         transactionId: tx.id, teamId, name: tx.name, type: "expense",
      });

      expect(classificationPublisherSpy.publish).toHaveBeenCalledWith(
         "job.notification",
         expect.objectContaining({ status: "failed" }),
      );
   });
});
```

**Step 10.3 — Run (must fail)**

```bash
bun nx run @modules/classification:test -- workflows/classification
```

Expected: FAIL — `classificationWorkflow` does not exist.

**Step 10.4 — Implement `classification-workflow.ts`**

```ts
import { fromPromise, ok, err, type Result } from "neverthrow";
import { DBOS } from "@dbos-inc/dbos-sdk";
import dayjs from "dayjs";
import { and, eq, sql } from "drizzle-orm";
import { categories } from "@core/database/schemas/categories";
import { tags } from "@core/database/schemas/tags";
import { transactions } from "@core/database/schemas/transactions";
import { AppError } from "@core/logging/errors";
import { NOTIFICATION_TYPES } from "@packages/notifications/types";
import type { JobNotification } from "@packages/notifications/schema";
import { classifyTransaction } from "../ai/classify";
import { CLASSIFICATION_QUEUES } from "../constants";
import {
   classificationDataSource,
   createEnqueuer,
   getClassificationPosthog,
   getClassificationPublisher,
} from "./context";

export type ClassificationInput = {
   transactionId: string;
   teamId: string;
   name: string;
   type: "income" | "expense";
   contactName?: string | null;
};

async function notify(
   status: "started" | "completed" | "failed",
   teamId: string,
   message: string,
   payload?: { transactionId?: string },
) {
   const publisher = getClassificationPublisher();
   await DBOS.runStep(
      () =>
         publisher.publish("job.notification", {
            jobId: crypto.randomUUID(),
            type: NOTIFICATION_TYPES.AI_TRANSACTION_CLASSIFIED,
            status,
            message,
            teamId,
            payload,
            timestamp: dayjs().toISOString(),
         } satisfies JobNotification),
      { name: `notify-${status}` },
   );
}

async function findCategoryByKeywordMatch(
   teamId: string,
   name: string,
   type: "income" | "expense",
) {
   const tx = classificationDataSource.client;
   const lower = name.toLowerCase();
   const rows = await tx
      .select({ id: categories.id, keywords: categories.keywords })
      .from(categories)
      .where(
         and(
            eq(categories.teamId, teamId),
            eq(categories.type, type),
            eq(categories.isArchived, false),
         ),
      );
   const match = rows.find((r) =>
      r.keywords?.some((k) => lower.includes(k.toLowerCase())),
   );
   return match?.id ?? null;
}

async function findTagByKeywordMatch(teamId: string, name: string) {
   const tx = classificationDataSource.client;
   const lower = name.toLowerCase();
   const rows = await tx
      .select({ id: tags.id, keywords: tags.keywords })
      .from(tags)
      .where(and(eq(tags.teamId, teamId), eq(tags.isArchived, false)));
   const match = rows.find((r) =>
      r.keywords?.some((k) => lower.includes(k.toLowerCase())),
   );
   return match?.id ?? null;
}

async function classificationWorkflowFn(input: ClassificationInput) {
   const ctx = `[classify] tx=${input.transactionId} team=${input.teamId}`;
   DBOS.logger.info(`${ctx} started name="${input.name}"`);

   await notify("started", input.teamId, `Classificando "${input.name}"...`);

   const matchResult = await fromPromise(
      classificationDataSource.runTransaction(
         async () => {
            const categoryId = await findCategoryByKeywordMatch(
               input.teamId, input.name, input.type,
            );
            const tagId = await findTagByKeywordMatch(input.teamId, input.name);
            return { categoryId, tagId };
         },
         { name: "matchKeywords" },
      ),
      (e) =>
         AppError.internal("Falha ao consultar palavras-chave.", { cause: e }),
   );

   if (matchResult.isErr()) {
      DBOS.logger.error(`${ctx} keyword match failed`);
      await notify("failed", input.teamId, matchResult.error.message);
      return;
   }

   const { categoryId: kwCategoryId, tagId: kwTagId } = matchResult.value;

   if (kwCategoryId || kwTagId) {
      const applyResult = await fromPromise(
         classificationDataSource.runTransaction(
            async () => {
               const tx = classificationDataSource.client;
               await tx
                  .update(transactions)
                  .set({
                     ...(kwCategoryId && { categoryId: kwCategoryId }),
                     ...(kwTagId && { tagId: kwTagId }),
                  })
                  .where(eq(transactions.id, input.transactionId));
            },
            { name: "applyKeywordMatch" },
         ),
         (e) => AppError.internal("Falha ao aplicar match.", { cause: e }),
      );
      if (applyResult.isErr()) {
         await notify("failed", input.teamId, applyResult.error.message);
         return;
      }
      if (kwCategoryId && kwTagId) {
         await notify("completed", input.teamId, `"${input.name}" classificado.`, {
            transactionId: input.transactionId,
         });
         return;
      }
   }

   const [catList, tagList] = await Promise.all([
      classificationDataSource.runTransaction(
         async () => {
            const tx = classificationDataSource.client;
            return tx
               .select({
                  id: categories.id,
                  name: categories.name,
                  keywords: categories.keywords,
               })
               .from(categories)
               .where(
                  and(
                     eq(categories.teamId, input.teamId),
                     eq(categories.type, input.type),
                     eq(categories.isArchived, false),
                  ),
               );
         },
         { name: "listCategories" },
      ),
      classificationDataSource.runTransaction(
         async () => {
            const tx = classificationDataSource.client;
            return tx
               .select({ id: tags.id, name: tags.name, keywords: tags.keywords })
               .from(tags)
               .where(and(eq(tags.teamId, input.teamId), eq(tags.isArchived, false)));
         },
         { name: "listTags" },
      ),
   ]);

   const aiResult = await DBOS.runStep(
      () =>
         classifyTransaction(
            { name: input.name, type: input.type, contactName: input.contactName },
            catList,
            tagList,
            { posthog: getClassificationPosthog(), distinctId: input.teamId },
         ),
      { name: "classifyAI" },
   );

   if (aiResult.isErr()) {
      DBOS.logger.error(`${ctx} AI failed: ${aiResult.error.message}`);
      await notify("failed", input.teamId, aiResult.error.message);
      return;
   }

   const { categoryId: aiCategoryId, tagId: aiTagId } = aiResult.value;

   const applyAi = await fromPromise(
      classificationDataSource.runTransaction(
         async () => {
            const tx = classificationDataSource.client;
            await tx
               .update(transactions)
               .set({
                  ...(!kwCategoryId && { suggestedCategoryId: aiCategoryId }),
                  ...(!kwTagId && aiTagId && { suggestedTagId: aiTagId }),
               })
               .where(eq(transactions.id, input.transactionId));
         },
         { name: "applyAi" },
      ),
      (e) => AppError.internal("Falha ao aplicar sugestão.", { cause: e }),
   );

   if (applyAi.isErr()) {
      await notify("failed", input.teamId, applyAi.error.message);
      return;
   }

   await notify("completed", input.teamId, `"${input.name}" classificado.`, {
      transactionId: input.transactionId,
   });
   DBOS.logger.info(`${ctx} done`);
}

export const classificationWorkflow = DBOS.registerWorkflow(
   classificationWorkflowFn,
);

export const enqueueClassificationWorkflow = createEnqueuer<ClassificationInput>(
   classificationWorkflowFn.name,
   CLASSIFICATION_QUEUES.classify,
   (i) => `classify-${i.transactionId}`,
);
```

**Step 10.5 — Run test (must pass)**

```bash
bun nx run @modules/classification:test -- workflows/classification
```

Expected: PASS (3 tests).

**Step 10.6 — Commit**

```bash
git add modules/classification/src/workflows/classification-workflow.ts modules/classification/__tests__
git commit -m "feat(classification): classificationWorkflow consolidating categorize+suggestTag"
```

---

## Task 11 — Implement `derive-keywords-workflow.ts` (TDD)

**Files:**
- Create: `modules/classification/src/workflows/derive-keywords-workflow.ts`
- Create: `modules/classification/__tests__/workflows/derive-keywords.test.ts`

**Step 11.1 — Write failing test**

Mirrors Task 10's harness. Cases:
1. Budget exceeded → publishes failed notification, no AI call.
2. Category entity → calls `deriveKeywords({ entity: "category" })` + writes `categories.keywords` + emits `ai.keyword_derived`.
3. Tag entity → calls `deriveKeywords({ entity: "tag" })` + writes `tags.keywords` + emits `ai.tag_keyword_derived`.

Use `vi.mock("../../src/ai/derive-keywords", () => ({ deriveKeywords: vi.fn() }))`. Mock `enforceCreditBudget` from `@packages/events/credits`.

**Step 11.2 — Run (must fail)**

```bash
bun nx run @modules/classification:test -- workflows/derive-keywords
```

**Step 11.3 — Implement**

Input shape (discriminated):
```ts
export type DeriveKeywordsWorkflowInput =
   | { entity: "category"; categoryId: string; teamId: string; organizationId: string;
       name: string; description?: string | null; userId?: string;
       stripeCustomerId?: string | null; }
   | { entity: "tag"; tagId: string; teamId: string; organizationId: string;
       name: string; description?: string | null; userId?: string;
       stripeCustomerId?: string | null; };
```

Body:
1. notify started.
2. `enforceCreditBudget` → event `"ai.keyword_derived"` for category, `"ai.tag_keyword_derived"` for tag.
3. `DBOS.runStep("deriveKeywords", () => deriveKeywords({ entity, name, description }, observability))`.
4. `classificationDataSource.runTransaction` updates `categories.keywords` or `tags.keywords` + `keywordsUpdatedAt = now()`.
5. `DBOS.runStep("emitBilling")` calling `emitAiKeywordDerived` or `emitAiTagKeywordDerived` with createEmitFn.
6. notify completed with `payload: { entity, count, [entity]Id }`.

Emit factory pulls posthog/redis/stripeClient from context store getters.

Export `enqueueDeriveKeywordsWorkflow` via `createEnqueuer` with key `(i) => "derive-" + i.entity + "-" + (i.entity === "category" ? i.categoryId : i.tagId)`.

**Step 11.4 — Run (must pass)**

```bash
bun nx run @modules/classification:test -- workflows/derive-keywords
```

**Step 11.5 — Commit**

```bash
git add modules/classification
git commit -m "feat(classification): deriveKeywordsWorkflow (entity-discriminated, replaces 2 workflows)"
```

---

## Task 12 — Implement `backfill-keywords-workflow.ts` (TDD)

**Files:**
- Create: `modules/classification/src/workflows/backfill-keywords-workflow.ts`
- Create: `modules/classification/__tests__/workflows/backfill-keywords.test.ts`

**Step 12.1 — Failing test**

Cases:
1. No teams with stale categories/tags → no-op, no enqueues.
2. Two teams, each with 3 stale categories + 2 stale tags → 10 `DBOS.startWorkflow` calls of `deriveKeywordsWorkflow`.
3. Budget exceeded mid-loop → halts that team, continues to next.

Mock `DBOS.startWorkflow` to capture invocations.

**Step 12.2 — Implement**

Logic:
1. Query `categories` where `keywords IS NULL OR keywords_updated_at < now() - 30 days`. Same for `tags`. Group by teamId.
2. For each team, fetch organizationId from `team` table.
3. For each entity, `enforceCreditBudget` (skip team if exceeded).
4. `DBOS.startWorkflow(deriveKeywordsWorkflow, { workflowID: "derive-${entity}-${id}-${YYYY-MM-DD}", queueName: "workflow:derive-keywords" })({ entity, ...input })`.
5. Notify cron summary per team.

Register via `DBOS.registerWorkflow` with `(scheduledTime: Date, _ctx: unknown)` signature. Export `backfillKeywordsWorkflow` (no enqueuer — scheduled only).

**Step 12.3 — Run + commit**

```bash
bun nx run @modules/classification:test -- workflows/backfill-keywords
git add modules/classification
git commit -m "feat(classification): backfillKeywordsWorkflow (daily cron enqueuing deriveKeywords)"
```

---

## Task 13 — `setupClassificationWorkflows` + DBOS schedules

**Files:**
- Create: `modules/classification/src/workflows/setup.ts`

**Step 13.1 — Write `setup.ts`**

```ts
import "./classification-workflow";
import "./derive-keywords-workflow";
import "./backfill-keywords-workflow";
import { DBOS } from "@dbos-inc/dbos-sdk";
import { DrizzleDataSource } from "@dbos-inc/drizzle-datasource";
import { env } from "@core/environment/worker";
import type { Redis } from "@core/redis/connection";
import type { PostHog } from "@core/posthog/server";
import type { StripeClient } from "@core/stripe";
import {
   createClassificationQueues,
   initClassificationWorkflowContext,
} from "./context";
import { backfillKeywordsWorkflow } from "./backfill-keywords-workflow";

export async function setupClassificationWorkflows(deps: {
   redis: Redis;
   posthog: PostHog;
   stripeClient: StripeClient | null;
   workerConcurrency: number;
}) {
   await DrizzleDataSource.initializeDBOSSchema({
      connectionString: env.DATABASE_URL,
   });
   initClassificationWorkflowContext({
      redis: deps.redis,
      posthog: deps.posthog,
      stripeClient: deps.stripeClient,
   });
   const queues = createClassificationQueues({
      workerConcurrency: deps.workerConcurrency,
   });
   return { queues, applySchedules: scheduleBackfill };
}

async function scheduleBackfill() {
   await DBOS.applySchedules([
      {
         scheduleName: "classification-backfill-keywords",
         workflowFn: backfillKeywordsWorkflow,
         schedule: "0 3 * * *",
      },
   ]);
}
```

**Step 13.2 — Verify**

```bash
bun nx run @modules/classification:typecheck
```

**Step 13.3 — Commit**

```bash
git add modules/classification/src/workflows/setup.ts
git commit -m "feat(classification): setupClassificationWorkflows + daily cron applySchedules"
```

---

## Task 14 — Migrate routers (categories + tags + ownership middlewares)

**Files:**
- Create: `modules/classification/src/router/middlewares.ts`
- Create: `modules/classification/src/router/categories.ts`
- Create: `modules/classification/src/router/tags.ts`
- Create: `modules/classification/__tests__/router/categories.test.ts`
- Create: `modules/classification/__tests__/router/tags.test.ts`
- Modify: `apps/web/src/integrations/orpc/router/index.ts:7,21,33,45` (re-route to module)
- Delete: `apps/web/src/integrations/orpc/router/categories.ts`
- Delete: `apps/web/src/integrations/orpc/router/tags.ts`

**Step 14.1 — Write `middlewares.ts`** (mirrors `modules/billing/src/router/middlewares.ts`)

```ts
import { os } from "@orpc/server";
import { err, fromPromise, ok } from "neverthrow";
import { WebAppError } from "@core/logging/errors";
import type { ORPCContextWithOrganization } from "@core/orpc/context";

const base = os.$context<ORPCContextWithOrganization>();

export const requireCategory = base.middleware(
   async ({ context, next }, id: string) => {
      const result = await fromPromise(
         context.db.query.categories.findFirst({
            where: (f, { eq }) => eq(f.id, id),
         }),
         () => WebAppError.internal("Falha ao verificar permissão."),
      ).andThen((category) =>
         !category || category.teamId !== context.teamId
            ? err(WebAppError.notFound("Categoria não encontrada."))
            : ok(category),
      );
      if (result.isErr()) throw result.error;
      return next({ context: { category: result.value } });
   },
);

export const requireTag = base.middleware(
   async ({ context, next }, id: string) => {
      const result = await fromPromise(
         context.db.query.tags.findFirst({
            where: (f, { eq }) => eq(f.id, id),
         }),
         () => WebAppError.internal("Falha ao verificar permissão."),
      ).andThen((tag) =>
         !tag || tag.teamId !== context.teamId
            ? err(WebAppError.notFound("Tag não encontrada."))
            : ok(tag),
      );
      if (result.isErr()) throw result.error;
      return next({ context: { tag: result.value } });
   },
);
```

**Step 14.2 — Write `router/categories.ts`** — full rewrite, no repo layer

For every old procedure (`create`, `getAll`, `getPaginated`, `update`, `regenerateKeywords`, `remove`, `exportAll`, `importBatch`, `archive`, `unarchive`, `bulkRemove`, `bulkArchive`):
- Inline the SQL from the deleted repo file directly into the handler
- Wrap in `fromPromise(...)` returning `WebAppError.internal("...")` (pt-BR)
- Use `context.db.transaction(...)` for any write
- Use `requireCategory(input.id)` middleware for entity-level ops (replaces `ensureCategoryOwnership`)
- Replace `enqueueDeriveKeywordsWorkflow` import with `enqueueDeriveKeywordsWorkflow` from `@modules/classification/workflows/derive-keywords-workflow`, passing `entity: "category"`

Sample (`create`):
```ts
import { fromPromise } from "neverthrow";
import { eq } from "drizzle-orm";
import { categories } from "@core/database/schemas/categories";
import { user as userTable } from "@core/database/schemas/auth";
import { WebAppError } from "@core/logging/errors";
import { protectedProcedure } from "@core/orpc/server";
import { z } from "zod";
import { createCategorySchema, updateCategorySchema } from "../contracts/categories";
import { enqueueDeriveKeywordsWorkflow } from "../workflows/derive-keywords-workflow";
import { requireCategory } from "./middlewares";

const idSchema = z.object({ id: z.string().uuid() });

export const create = protectedProcedure
   .input(
      createCategorySchema.extend({
         subcategories: z
            .array(z.object({ name: z.string().min(1).max(100) }))
            .optional(),
      }),
   )
   .handler(async ({ context, input }) => {
      const result = await fromPromise(
         context.db.transaction(async (tx) => {
            const [parent] = await tx
               .insert(categories)
               .values({
                  teamId: context.teamId,
                  name: input.name,
                  type: input.type,
                  parentId: input.parentId ?? null,
                  description: input.description ?? null,
                  color: input.color ?? null,
                  icon: input.icon ?? null,
                  keywords: input.keywords ?? null,
                  notes: input.notes ?? null,
                  participatesDre: input.participatesDre ?? false,
                  dreGroupId: input.dreGroupId ?? null,
                  level: input.parentId ? 2 : 1,
               })
               .returning();
            if (!parent) return undefined;
            if (input.subcategories?.length) {
               await tx.insert(categories).values(
                  input.subcategories.map((s) => ({
                     teamId: context.teamId,
                     name: s.name,
                     type: parent.type,
                     parentId: parent.id,
                     level: 2,
                  })),
               );
            }
            return parent;
         }),
         (e) =>
            e instanceof WebAppError ? e : WebAppError.internal("Falha ao criar categoria.", { cause: e }),
      );
      if (result.isErr()) throw result.error;
      if (!result.value)
         throw WebAppError.internal("Falha ao criar categoria: insert vazio.");

      const userRecord = await context.db.query.user.findFirst({
         where: eq(userTable.id, context.userId),
         columns: { stripeCustomerId: true },
      });

      await enqueueDeriveKeywordsWorkflow(context.workflowClient, {
         entity: "category",
         categoryId: result.value.id,
         teamId: context.teamId,
         organizationId: context.organizationId,
         userId: context.userId,
         name: result.value.name,
         description: result.value.description,
         stripeCustomerId: userRecord?.stripeCustomerId ?? null,
      });

      return result.value;
   });
```

For `update`/`archive`/`unarchive`/`remove`: use `requireCategory` middleware:

```ts
export const update = protectedProcedure
   .input(idSchema.merge(updateCategorySchema))
   .use(({ input, next, context }) => requireCategory({ input: input.id, context, next }))
   .handler(async ({ context, input }) => {
      const { id: _id, ...data } = input;
      void _id;  // route param used by middleware
      // ...inline updateCategory from old repo
   });
```

For `bulkRemove`/`bulkArchive`/`importBatch`: inline per old repo logic.

**Step 14.3 — Write `router/tags.ts`** analogously (procedures: `create`, `getAll`, `update`, `remove`, `archive`, `bulkArchive`, `unarchive`, `getStats`, `bulkCreate`, `bulkRemove`).

**Step 14.4 — Re-wire `apps/web/src/integrations/orpc/router/index.ts`**

Edit lines 7 + 21:
```ts
import * as categoriesRouter from "@modules/classification/router/categories";
import * as tagsRouter from "@modules/classification/router/tags";
```

**Step 14.5 — Delete old router files**

```bash
git rm apps/web/src/integrations/orpc/router/categories.ts
git rm apps/web/src/integrations/orpc/router/tags.ts
```

**Step 14.6 — Add web → modules link**

```bash
grep '"@modules/billing"' apps/web/package.json   # confirm pattern exists
```
Add `"@modules/classification": "workspace:*"` to `apps/web/package.json` dependencies.

**Step 14.7 — Write router tests** (`__tests__/router/categories.test.ts` + `tags.test.ts`)

Mirror `modules/billing/__tests__/router/services.test.ts`. Use real pglite via `setupTestDb`. Mock `enqueueDeriveKeywordsWorkflow`. Test:
- create → row inserted + enqueue called with `entity: "category"`
- update → cross-team rejection (NOT_FOUND)
- archive → `isArchived = true`
- bulkArchive → all archived
- importBatch → enqueues per parent only
- regenerateKeywords → enqueue called

**Step 14.8 — Run all tests**

```bash
bun install
bun nx run @modules/classification:test
bun nx run @apps/web:typecheck
```

Expected: all PASS. Web typecheck may surface stale imports — fix per error.

**Step 14.9 — Commit**

```bash
git add modules/classification apps/web
git commit -m "refactor(classification): migrate categories+tags routers from apps/web to module"
```

---

## Task 15 — Wire `apps/worker` to call `setupClassificationWorkflows`

**Files:**
- Modify: `apps/worker/src/index.ts:1-42`
- Modify: `apps/worker/package.json` (add `"@modules/classification": "workspace:*"`)

**Step 15.1 — Edit `apps/worker/src/index.ts`**

Insert after line 9:
```ts
import { setupClassificationWorkflows } from "@modules/classification/workflows/setup";
```

Replace lines 27-29:
```ts
const billing = await setupBillingWorkflows({
   redis, resendClient, workerConcurrency: 10,
});
const classification = await setupClassificationWorkflows({
   redis, posthog, stripeClient: null, workerConcurrency: 10,
});

launchDBOS({
   db, redis, posthog, resendClient,
   systemDatabaseUrl: env.DATABASE_URL,
   logLevel: env.LOG_LEVEL,
   onLaunch: async () => {
      await classification.applySchedules();
   },
   onShutdown: async () => { /* unchanged */ },
});
```

(`launchDBOS` may not currently take `onLaunch` — see Task 18 about modifying it OR call `applySchedules` immediately after `DBOS.launch()` resolves. Inspect `packages/workflows/src/setup.ts:38-46` for the existing `applySchedules` callsite and refactor it to accept a hook.)

**Step 15.2 — Verify**

```bash
bun nx run @apps/worker:typecheck
```

**Step 15.3 — Commit**

```bash
git add apps/worker
git commit -m "feat(worker): wire setupClassificationWorkflows + cron schedule registration"
```

---

## Task 16 — Delete old AI actions + repo files + middleware

**Files (delete):**
- `core/agents/src/actions/categorize.ts`
- `core/agents/src/actions/suggest-tag.ts`
- `core/agents/src/actions/keywords.ts`
- `core/agents/src/actions/keywords-tag.ts`
- `core/agents/src/middleware/posthog.ts`
- `core/database/src/repositories/categories-repository.ts`
- `core/database/src/repositories/tags-repository.ts`

**Step 16.1 — Confirm no remaining references**

```bash
grep -rn "categories-repository\|tags-repository\|core/agents/actions/categorize\|core/agents/actions/suggest-tag\|core/agents/actions/keywords\|core/agents/middleware/posthog" apps core packages modules --include="*.ts" 2>/dev/null
```

Expected: empty. If any hits, fix before deletion.

**Step 16.2 — Delete**

```bash
git rm core/agents/src/actions/categorize.ts
git rm core/agents/src/actions/suggest-tag.ts
git rm core/agents/src/actions/keywords.ts
git rm core/agents/src/actions/keywords-tag.ts
git rm core/agents/src/middleware/posthog.ts
git rm core/database/src/repositories/categories-repository.ts
git rm core/database/src/repositories/tags-repository.ts
```

**Step 16.3 — Drop back-compat re-exports from Task 5.5b**

Re-edit `core/database/src/schemas/categories.ts` and `tags.ts` to remove the `export { ... } from "@modules/classification/contracts/..."` lines added during Task 5.

**Step 16.4 — Verify**

```bash
bun run typecheck
bun run check
```

Expected: zero errors across workspace.

**Step 16.5 — Commit**

```bash
git add -u
git commit -m "refactor: delete legacy categories/tags repos + AI actions superseded by @modules/classification"
```

---

## Task 17 — Remove obsolete workflows from `packages/workflows`

**Files (delete):**
- `packages/workflows/src/workflows/categorization-workflow.ts`
- `packages/workflows/src/workflows/suggest-tag-workflow.ts`
- `packages/workflows/src/workflows/derive-keywords-workflow.ts`
- `packages/workflows/src/workflows/derive-tag-keywords-workflow.ts`
- `packages/workflows/src/workflows/backfill-keywords-workflow.ts`

**Files (modify):**
- `packages/workflows/src/setup.ts:1-62` (drop side-effect imports + `applySchedules` for backfill)
- `packages/workflows/src/workflow-factory.ts` (drop `categorize|suggestTag|deriveKeywords|deriveTagKeywords|backfillKeywords` queue keys)

**Step 17.1 — Drop old notification types** in `packages/notifications/src/types.ts`: `AI_TRANSACTION_CATEGORIZED`, `AI_TAG_SUGGESTED`, `AI_KEYWORD_DERIVED`, `AI_TAG_KEYWORD_DERIVED`. Confirm no remaining consumers via:
```bash
grep -rn "AI_TRANSACTION_CATEGORIZED\|AI_TAG_SUGGESTED\|AI_KEYWORD_DERIVED\|AI_TAG_KEYWORD_DERIVED" apps core packages modules --include="*.ts"
```

**Step 17.2 — Delete**

```bash
git rm packages/workflows/src/workflows/categorization-workflow.ts
git rm packages/workflows/src/workflows/suggest-tag-workflow.ts
git rm packages/workflows/src/workflows/derive-keywords-workflow.ts
git rm packages/workflows/src/workflows/derive-tag-keywords-workflow.ts
git rm packages/workflows/src/workflows/backfill-keywords-workflow.ts
```

**Step 17.3 — Edit `packages/workflows/src/setup.ts`**

Remove lines 5-9 (side-effect imports + backfillKeywords import). Remove lines 40-46 (`applySchedules` block — schedule now lives in classification module).

**Step 17.4 — Edit `packages/workflows/src/workflow-factory.ts`**

Drop the queue keys.

**Step 17.5 — Verify**

```bash
bun run typecheck
bun run test
```

Expected: zero errors, all tests pass.

**Step 17.6 — Commit**

```bash
git add -u packages
git commit -m "refactor(workflows): drop legacy categorization/keyword workflows from packages/workflows"
```

---

## Task 18 — DBOS smoke integration test (pglite)

**Files:**
- Create: `modules/classification/__tests__/helpers/pglite-dbos-runtime.ts` (copy from `modules/billing/__tests__/helpers/pglite-dbos-runtime.ts`, change `name` to `"classification-pglite-test"`)
- Create: `modules/classification/__tests__/integration/dbos-smoke.test.ts`
- Create: `modules/classification/__tests__/integration/derive-keywords-handoff.test.ts`

**Step 18.1 — Write `dbos-smoke.test.ts`** copying `modules/billing/__tests__/integration/dbos-smoke.test.ts` exactly. Run it to validate pglite + DBOS still boots.

**Step 18.2 — Write `derive-keywords-handoff.test.ts`**

End-to-end: enqueue `classificationWorkflow` for a transaction with no keywords match → mock `classifyTransaction` to return cat+tag → assert `transactions.suggestedCategoryId` set within 5s deadline. Use `launchPgliteDBOS` + real `setupClassificationWorkflows` against the pglite db.

**Step 18.3 — Run**

```bash
bun nx run @modules/classification:test -- integration
```

Expected: PASS.

**Step 18.4 — Commit**

```bash
git add modules/classification/__tests__
git commit -m "test(classification): pglite-socket DBOS smoke + derive-keywords handoff"
```

---

## Task 19 — Final workspace verification

**Step 19.1 — Full sweep**

```bash
bun run typecheck
bun run check
bun run test
bun run check-boundaries
```

Expected: all pass. If `check-boundaries` complains about a new cross-layer import, fix the import or add a boundary tag in `nx.json`.

**Step 19.2 — Manual smoke (worker boots)**

```bash
bun nx run @apps/worker:build
```

Expected: clean build.

**Step 19.3 — Manual smoke (web boots)**

```bash
cd apps/web && docker compose up -d
cd ../.. && bun dev
```

Expected: dev server starts without category/tag-related errors. Hit `/categorias` and `/tags` routes — must render and CRUD must work end-to-end.

**Step 19.4 — Final commit (if anything left)**

```bash
git status
git add -u
git commit -m "chore(classification): final cleanup after migration"
```

---

## Open Decisions (resolve before / during execution)

1. **Single PostHog prompt vs two**: plan uses one (`classifyTransaction` covering both) per spec. If it underperforms in prod, split — adds one prompt key + one chat call to derive-keywords-style discriminator. Out of scope here.
2. **`onLaunch` hook on `launchDBOS`**: Task 15 assumes a hook. If not present, refactor `packages/workflows/src/setup.ts` to take it OR move `applySchedules` call into worker `index.ts` after awaiting `DBOS.launch()` (cleaner — schedules per module owned by module).
3. **`@core/ai` future**: this package becomes the home for Rubi agent's model exports too once the agent migrates. Leave the `models.ts` shape stable (named per-task adapters) so call sites don't churn.

## Final File Layout (after this plan)

```
core/ai/                                    # NEW
├── package.json
├── tsconfig.json
└── src/
   ├── models.ts                            # proModel, flashModel
   ├── middleware.ts                        # createPosthogAiMiddleware
   └── observability.ts                     # AiObservabilityContext

modules/classification/                     # NEW
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── src/
│  ├── constants.ts                         # CLASSIFICATION_QUEUES
│  ├── contracts/
│  │  ├── categories.ts
│  │  └── tags.ts
│  ├── ai/
│  │  ├── classify.ts                       # 1 chat() call → category + tag (flashModel)
│  │  └── derive-keywords.ts                # 1 chat() call (proModel, entity-discriminated)
│  ├── router/
│  │  ├── middlewares.ts                    # requireCategory, requireTag
│  │  ├── categories.ts                     # 12 procedures (no repo)
│  │  └── tags.ts                           # 10 procedures (no repo)
│  └── workflows/
│     ├── context.ts                        # classificationDataSource + store
│     ├── setup.ts                          # setupClassificationWorkflows + schedules
│     ├── classification-workflow.ts        # categorize+tag in one pass
│     ├── derive-keywords-workflow.ts       # entity-discriminated
│     └── backfill-keywords-workflow.ts     # daily cron
└── __tests__/
   ├── helpers/
   │  ├── classification-factories.ts
   │  ├── mock-classification-context.ts
   │  └── pglite-dbos-runtime.ts
   ├── ai/{classify,derive-keywords}.test.ts
   ├── router/{categories,tags}.test.ts
   ├── workflows/{classification,derive-keywords,backfill-keywords}.test.ts
   └── integration/{dbos-smoke,derive-keywords-handoff}.test.ts

DELETED:
├── core/agents/src/actions/{categorize,suggest-tag,keywords,keywords-tag}.ts
├── core/agents/src/middleware/posthog.ts
├── core/database/src/repositories/{categories-repository,tags-repository}.ts
├── packages/workflows/src/workflows/{categorization,suggest-tag,derive-keywords,derive-tag-keywords,backfill-keywords}-workflow.ts
└── apps/web/src/integrations/orpc/router/{categories,tags}.ts
```
