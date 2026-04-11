# AI Auto-Derive Category Keywords — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Automatically derive financial category keywords using a lightweight LLM, notify users via SSE, and backfill existing categories — all with usage-based billing.

**Architecture:** `apps/web` oRPC saves category → fire-and-forget POST to `apps/server` → DBOS workflow calls LLM → updates DB → publishes via `IORedisPublisher` from `@packages/notifications` → `apps/web` oRPC SSE streams `JobNotification` to frontend → `useJobNotifications` hook dispatches toasts + invalidates queries. A daily DBOS cron handles backfill of existing categories without keywords.

**Tech Stack:** `@packages/notifications` (new package), `@orpc/experimental-publisher` (IORedisPublisher + eventIterator), DBOS workflows, `openrouter/liquid/lfm2-8b`, neverthrow (ResultAsync/Result), `@core/logging/errors` (AppError), `packages/events` billing, sonner toasts.

**Design doc:** `docs/plans/2026-04-11-ai-auto-derive-category-keywords.md`

---

## Task 1: New package — `packages/notifications`

This package owns all SSE notification contracts: the `JobNotification` schema, the `IORedisPublisher` singleton factory, and a typed dictionary of notification types with their payload shapes. Both `apps/web` and `apps/server` import from here — no duplication.

**Files:**
- Create: `packages/notifications/package.json`
- Create: `packages/notifications/tsconfig.json`
- Create: `packages/notifications/src/schema.ts`
- Create: `packages/notifications/src/types.ts`
- Create: `packages/notifications/src/publisher.ts`
- Modify: root `package.json` (add `@packages/notifications` to workspaces if needed — check existing pattern)

**Step 1: Create `packages/notifications/package.json`**

```json
{
   "name": "@packages/notifications",
   "version": "0.1.0",
   "private": true,
   "license": "Apache-2.0",
   "files": ["dist"],
   "type": "module",
   "exports": {
      "./schema": {
         "types": "./dist/schema.d.ts",
         "default": "./dist/schema.js"
      },
      "./types": {
         "types": "./dist/types.d.ts",
         "default": "./dist/types.js"
      },
      "./publisher": {
         "types": "./dist/publisher.d.ts",
         "default": "./dist/publisher.js"
      }
   },
   "scripts": {
      "build": "tsc --build",
      "check": "oxlint ./src",
      "format": "oxfmt --write ./src",
      "format:check": "oxfmt --check ./src",
      "typecheck": "tsgo"
   },
   "dependencies": {
      "@core/redis": "workspace:*",
      "@orpc/experimental-publisher": "catalog:orpc",
      "zod": "catalog:validation"
   },
   "devDependencies": {
      "@tooling/typescript": "workspace:*",
      "typescript": "catalog:development"
   }
}
```

**Step 2: Create `packages/notifications/tsconfig.json`**

Copy structure from `packages/events/tsconfig.json` adjusting paths:

```json
{
   "extends": "@tooling/typescript/tsconfig.package.json",
   "compilerOptions": {
      "paths": {
         "@core/redis/*": ["../../core/redis/src/*"],
         "@packages/notifications/*": ["./src/*"]
      }
   },
   "include": ["src"],
   "references": [
      { "path": "../../core/redis" }
   ]
}
```

**Step 3: Create `packages/notifications/src/schema.ts`**

The `JobNotification` Zod schema — single source of truth used by both server (publish) and web (SSE output validation):

```typescript
import { z } from "zod";

export const jobNotificationSchema = z.object({
   jobId: z.string(),
   type: z.string(),
   status: z.enum(["completed", "failed"]),
   payload: z.record(z.unknown()).optional(),
   error: z.string().optional(),
   teamId: z.string().uuid(),
   timestamp: z.string(),
});

export type JobNotification = z.infer<typeof jobNotificationSchema>;
```

**Step 4: Create `packages/notifications/src/types.ts`**

Typed dictionary of every notification type with its known payload shape. Add new types here when new jobs/crons are added — keeps the hook's dispatch logic type-safe:

```typescript
export const NOTIFICATION_TYPES = {
   AI_KEYWORD_DERIVED: "ai.keyword_derived",
   CRON_KEYWORDS_BACKFILL: "cron.keywords_backfill",
} as const;

export type NotificationType =
   (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES];

export type NotificationPayloadMap = {
   "ai.keyword_derived": {
      categoryId: string;
      categoryName: string;
      count: number;
   };
   "cron.keywords_backfill": {
      count: number;
   };
};

export function getPayload<T extends NotificationType>(
   type: T,
   payload: Record<string, unknown> | undefined,
): NotificationPayloadMap[T] | undefined {
   return payload as NotificationPayloadMap[T] | undefined;
}
```

**Step 5: Create `packages/notifications/src/publisher.ts`**

Factory that creates an `IORedisPublisher` — each app calls this with its own Redis instance:

```typescript
import { IORedisPublisher } from "@orpc/experimental-publisher";
import type { Redis } from "@core/redis/connection";
import type { JobNotification } from "./schema";

export type JobPublisher = IORedisPublisher<{
   "job.notification": JobNotification;
}>;

export function createJobPublisher(redis: Redis): JobPublisher {
   return new IORedisPublisher<{
      "job.notification": JobNotification;
   }>(redis);
}
```

**Step 6: Verify `@orpc/experimental-publisher` is in the `orpc` catalog**

```bash
grep "experimental-publisher" package.json
```

If missing, add to the `orpc` catalog in root `package.json`:
```json
"@orpc/experimental-publisher": "latest"
```

Then run: `bun install`

**Step 7: Build the package**

```bash
cd packages/notifications && bun run build
```

**Step 8: Commit**

```bash
git add packages/notifications/
git commit -m "feat(notifications): add @packages/notifications with schema, types, publisher factory"
```

---

## Task 2: Billing constants — `core/stripe/src/constants.ts`

**Files:**
- Modify: `core/stripe/src/constants.ts`

**Step 1: Add free tier limits and pricing for the two new events**

In `FREE_TIER_LIMITS`, add:
```typescript
"ai.keyword_derived": 100,
"notifications.delivered": 1000,
```

In `EVENT_PRICES`, add:
```typescript
"ai.keyword_derived": "0.010000",
"notifications.delivered": "0.001000",
```

In `STRIPE_METER_EVENTS`, add:
```typescript
"ai.keyword_derived": "ai_keyword_derived",
"notifications.delivered": "notifications_delivered",
```

**Step 2: Commit**
```bash
git add core/stripe/src/constants.ts
git commit -m "feat(billing): add ai.keyword_derived and notifications.delivered billing constants"
```

---

## Task 3: Event schemas — `packages/events/src/ai.ts`

**Files:**
- Modify: `packages/events/src/ai.ts`

**Step 1: Add `ai.keyword_derived` event**

Add to `AI_PRICING`:
```typescript
"ai.keyword_derived": "0.010000",
```

Add to `AI_EVENTS`:
```typescript
"ai.keyword_derived": "ai.keyword_derived",
```

Add schema and emit function after the existing ones:
```typescript
export const aiKeywordDerivedEventSchema = z.object({
   categoryId: z.uuid(),
   keywordCount: z.number().int().nonnegative(),
   model: z.string(),
   latencyMs: z.number().nonnegative(),
});
export type AiKeywordDerivedEvent = z.infer<typeof aiKeywordDerivedEventSchema>;

export function emitAiKeywordDerived(
   emit: EmitFn,
   ctx: { organizationId: string; userId?: string; teamId?: string },
   properties: AiKeywordDerivedEvent,
) {
   return emit({
      ...ctx,
      eventName: AI_EVENTS["ai.keyword_derived"],
      eventCategory: EVENT_CATEGORIES.ai,
      properties,
   });
}
```

**Step 2: Add export to `packages/events/package.json`**

The `ai` subpath already exists — no change needed. But verify `dist/ai.d.ts` will include the new exports after build:
```bash
cd packages/events && bun run build
```

**Step 3: Commit**
```bash
git add packages/events/src/ai.ts
git commit -m "feat(events): add ai.keyword_derived schema and emitter"
```

---

## Task 4: Publisher singletons — `apps/web` + `apps/server`

**Files:**
- Create: `apps/web/src/integrations/orpc/publisher.ts`
- Create: `apps/server/src/publisher.ts`
- Modify: `apps/web/package.json` (add `@packages/notifications`)
- Modify: `apps/server/package.json` (add `@packages/notifications`)

**Step 1: Add `@packages/notifications` to both apps**

In `apps/web/package.json` and `apps/server/package.json`, add to `dependencies`:
```json
"@packages/notifications": "workspace:*"
```

Run: `bun install`

**Step 2: Create `apps/web/src/integrations/orpc/publisher.ts`**

```typescript
import { createJobPublisher } from "@packages/notifications/publisher";
import { redis } from "@core/redis/connection";

export const jobPublisher = createJobPublisher(redis);
```

**Step 3: Create `apps/server/src/publisher.ts`**

```typescript
import { createJobPublisher } from "@packages/notifications/publisher";
import { redis } from "./singletons";

export const jobPublisher = createJobPublisher(redis);
```

**Step 4: Add path aliases for `@packages/notifications` to both apps' tsconfigs**

In `apps/web/tsconfig.json` and `apps/server/tsconfig.json`, add under `paths`:
```json
"@packages/notifications/*": ["../../packages/notifications/src/*"]
```

Also add to `references`:
```json
{ "path": "../../packages/notifications" }
```

**Step 5: Typecheck**
```bash
bun run typecheck
```

**Step 6: Commit**
```bash
git add apps/web/src/integrations/orpc/publisher.ts apps/server/src/publisher.ts apps/web/package.json apps/server/package.json
git commit -m "feat(notifications): add jobPublisher singletons in apps/web and apps/server"
```

---

## Task 5: SSE procedure — `apps/web/src/integrations/orpc/router/notifications.ts`

**Files:**
- Create: `apps/web/src/integrations/orpc/router/notifications.ts`
- Modify: `apps/web/src/integrations/orpc/router/index.ts`

**Step 1: Create the notifications router**

```typescript
import { eventIterator } from "@orpc/server";
import { jobNotificationSchema } from "@packages/notifications/schema";
import { protectedProcedure } from "../server";
import { jobPublisher } from "../publisher";

export const subscribe = protectedProcedure
   .output(eventIterator(jobNotificationSchema))
   .handler(async function* ({ context, signal }) {
      const iterator = jobPublisher.subscribe("job.notification", {
         filter: (event) => event.teamId === context.teamId,
         signal,
      });
      try {
         for await (const event of iterator) {
            yield event;
         }
      } finally {
         await iterator.return?.();
      }
   });
```

**Step 2: Register in `apps/web/src/integrations/orpc/router/index.ts`**

Add import:
```typescript
import * as notificationsRouter from "./notifications";
```

Add to exported object:
```typescript
notifications: notificationsRouter,
```

**Step 3: Typecheck**
```bash
bun run typecheck
```

**Step 4: Commit**
```bash
git add apps/web/src/integrations/orpc/router/notifications.ts apps/web/src/integrations/orpc/router/index.ts
git commit -m "feat(notifications): add oRPC SSE subscribe procedure"
```

---

## Task 6: Frontend hook — `useJobNotifications`

**Files:**
- Create: `apps/web/src/features/notifications/use-job-notifications.ts`
- Modify: dashboard layout component

**Step 1: Find the DashboardLayout component file**
```bash
grep -r "export function DashboardLayout\|export default function DashboardLayout" apps/web/src --include="*.tsx" -l
```

**Step 2: Create the hook**

```typescript
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { consumeEventIterator } from "@orpc/client";
import { toast } from "sonner";
import { orpc, client } from "@/integrations/orpc/client";
import {
   NOTIFICATION_TYPES,
   getPayload,
} from "@packages/notifications/types";

export function useJobNotifications() {
   const queryClient = useQueryClient();

   useEffect(() => {
      const cancel = consumeEventIterator(client.notifications.subscribe({}), {
         onEvent: (notification) => {
            if (notification.status === "failed") {
               toast.error("Não foi possível gerar palavras-chave.", {
                  description:
                     "Tente novamente ou adicione manualmente nas configurações da categoria.",
               });
               return;
            }

            if (notification.type === NOTIFICATION_TYPES.AI_KEYWORD_DERIVED) {
               const p = getPayload(NOTIFICATION_TYPES.AI_KEYWORD_DERIVED, notification.payload);
               queryClient.invalidateQueries({
                  queryKey: orpc.categories.getAll.queryKey(),
               });
               toast.success(
                  `Palavras-chave geradas para ${p?.categoryName ?? "categoria"}.`,
               );
               return;
            }

            if (notification.type === NOTIFICATION_TYPES.CRON_KEYWORDS_BACKFILL) {
               const p = getPayload(NOTIFICATION_TYPES.CRON_KEYWORDS_BACKFILL, notification.payload);
               queryClient.invalidateQueries({
                  queryKey: orpc.categories.getAll.queryKey(),
               });
               toast.success(
                  `Palavras-chave configuradas para ${p?.count ?? 0} categorias.`,
               );
               return;
            }
         },
         onError: () => {
            // SSE connection error — fail silently
         },
      });

      return () => {
         cancel();
      };
   }, [queryClient]);
}
```

**Step 3: Call `useJobNotifications()` in the DashboardLayout component**

Add the hook call inside the layout component body (must be inside the React tree where `QueryClientProvider` is active):

```typescript
import { useJobNotifications } from "@/features/notifications/use-job-notifications";

export function DashboardLayout({ children }: { children: React.ReactNode }) {
   useJobNotifications();
   // ... rest of component
}
```

**Step 4: Typecheck**
```bash
bun run typecheck
```

**Step 5: Commit**
```bash
git add apps/web/src/features/notifications/use-job-notifications.ts
git commit -m "feat(notifications): add useJobNotifications hook with typed dispatch"
```

---

## Task 7: DBOS Workflow — `apps/server/src/workflows/derive-keywords.workflow.ts`

**Files:**
- Create: `apps/server/src/workflows/derive-keywords.workflow.ts`

**Context:** DBOS `@DBOS.workflow()` marks durable execution — the whole function is retried from last completed `@DBOS.step()` on crash. Each `@DBOS.step()` is the smallest retry unit. Use `neverthrow` `ResultAsync` inside steps — return `err()` instead of throwing so the workflow can handle failures gracefully without DBOS retrying infinitely.

**Step 1: Check the AI SDK setup in `apps/server`**
```bash
grep -r "generateObject\|createOpenRouter\|openrouter" apps/server/src --include="*.ts"
grep "ai\|openrouter" apps/server/package.json
```

If `ai` and `@openrouter/ai-sdk-provider` are not installed, add them:
```json
"ai": "catalog:server",
"@openrouter/ai-sdk-provider": "catalog:server"
```

**Step 2: Create the workflow**

```typescript
import { DBOS } from "@dbos-inc/dbos-sdk";
import { ResultAsync } from "neverthrow";
import { AppError } from "@core/logging/errors";
import { generateObject } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { z } from "zod";
import { updateCategory } from "@core/database/repositories/categories-repository";
import { emitAiKeywordDerived } from "@packages/events/ai";
import { createEmitFn } from "@packages/events/emit";
import { enforceCreditBudget } from "@packages/events/credits";
import {
   NOTIFICATION_TYPES,
} from "@packages/notifications/types";
import type { JobNotification } from "@packages/notifications/schema";
import { jobPublisher } from "../publisher";
import { db, redis, posthog, stripeClient } from "../singletons";

const openrouter = createOpenRouter({
   apiKey: process.env.OPENROUTER_API_KEY!,
});

const keywordsOutputSchema = z.object({
   keywords: z
      .array(z.string().min(1).max(60))
      .min(1)
      .max(20)
      .describe("Lista de palavras-chave financeiras para categorização de transações"),
});

export type DeriveKeywordsInput = {
   categoryId: string;
   teamId: string;
   organizationId: string;
   name: string;
   description?: string | null;
   userId?: string;
   stripeCustomerId?: string | null;
};

export class DeriveKeywordsWorkflow {
   @DBOS.workflow()
   static async run(input: DeriveKeywordsInput): Promise<void> {
      const budgetResult = await DeriveKeywordsWorkflow.enforceBudgetStep(input);

      if (budgetResult.isErr()) {
         await DeriveKeywordsWorkflow.publishStep({
            jobId: crypto.randomUUID(),
            type: NOTIFICATION_TYPES.AI_KEYWORD_DERIVED,
            status: "failed",
            error: budgetResult.error.message,
            teamId: input.teamId,
            timestamp: new Date().toISOString(),
         });
         return;
      }

      const deriveResult = await DeriveKeywordsWorkflow.deriveStep(input);

      if (deriveResult.isErr()) {
         await DeriveKeywordsWorkflow.publishStep({
            jobId: crypto.randomUUID(),
            type: NOTIFICATION_TYPES.AI_KEYWORD_DERIVED,
            status: "failed",
            error: deriveResult.error.message,
            teamId: input.teamId,
            timestamp: new Date().toISOString(),
         });
         return;
      }

      const keywords = deriveResult.value;
      await DeriveKeywordsWorkflow.saveStep({ categoryId: input.categoryId, keywords });
      await DeriveKeywordsWorkflow.emitBillingStep({ input, keywords });
      await DeriveKeywordsWorkflow.publishStep({
         jobId: crypto.randomUUID(),
         type: NOTIFICATION_TYPES.AI_KEYWORD_DERIVED,
         status: "completed",
         payload: {
            categoryId: input.categoryId,
            categoryName: input.name,
            count: keywords.length,
         },
         teamId: input.teamId,
         timestamp: new Date().toISOString(),
      });
   }

   @DBOS.step()
   static async enforceBudgetStep(input: DeriveKeywordsInput) {
      return ResultAsync.fromPromise(
         enforceCreditBudget(
            input.organizationId,
            "ai.keyword_derived",
            redis,
            input.stripeCustomerId,
         ),
         () => AppError.forbidden("Free tier limit exceeded for ai.keyword_derived"),
      );
   }

   @DBOS.step()
   static async deriveStep(input: DeriveKeywordsInput) {
      return ResultAsync.fromPromise(
         generateObject({
            model: openrouter("liquid/lfm2-8b"),
            schema: keywordsOutputSchema,
            prompt: `Você é um assistente financeiro brasileiro. Gere palavras-chave para a categoria financeira abaixo. As palavras-chave devem ser termos comuns que aparecem em descrições de transações bancárias.

Categoria: ${input.name}${input.description ? `\nDescrição: ${input.description}` : ""}

Retorne entre 5 e 15 palavras-chave relevantes em português brasileiro. Inclua variações, abreviações e termos relacionados.`,
         }).then((r) => r.object.keywords),
         (e) => AppError.internal(`LLM derivation failed: ${String(e)}`),
      );
   }

   @DBOS.step()
   static async saveStep({
      categoryId,
      keywords,
   }: {
      categoryId: string;
      keywords: string[];
   }): Promise<void> {
      await updateCategory(db, categoryId, { keywords });
   }

   @DBOS.step()
   static async emitBillingStep({
      input,
      keywords,
   }: {
      input: DeriveKeywordsInput;
      keywords: string[];
   }): Promise<void> {
      const emit = createEmitFn(
         db,
         posthog,
         stripeClient,
         input.stripeCustomerId ?? undefined,
         redis,
      );
      await emitAiKeywordDerived(
         emit,
         {
            organizationId: input.organizationId,
            teamId: input.teamId,
            userId: input.userId,
         },
         {
            categoryId: input.categoryId,
            keywordCount: keywords.length,
            model: "liquid/lfm2-8b",
            latencyMs: 0,
         },
      );
   }

   @DBOS.step()
   static async publishStep(notification: JobNotification): Promise<void> {
      await jobPublisher.publish("job.notification", notification);
   }
}
```

**Step 3: Typecheck**
```bash
bun run typecheck
```

**Step 4: Commit**
```bash
git add apps/server/src/workflows/derive-keywords.workflow.ts
git commit -m "feat(server): add DeriveKeywordsWorkflow DBOS workflow with neverthrow"
```

---

## Task 8: Internal HTTP endpoint — `apps/server/src/index.ts`

**Files:**
- Modify: `apps/server/src/index.ts`

**Step 1: Import the workflow and add the route**

Add import after the existing imports:
```typescript
import { z } from "zod";
import { DeriveKeywordsWorkflow } from "./workflows/derive-keywords.workflow";
```

Add route inside the Elysia app chain before `.listen(...)`:
```typescript
.post("/internal/jobs/derive-keywords", async ({ body, set }) => {
   const parsed = z
      .object({
         categoryId: z.string().uuid(),
         teamId: z.string().uuid(),
         organizationId: z.string().uuid(),
         name: z.string(),
         description: z.string().nullable().optional(),
         userId: z.string().optional(),
         stripeCustomerId: z.string().nullable().optional(),
      })
      .safeParse(body);

   if (!parsed.success) {
      set.status = 400;
      return { error: "Invalid input" };
   }

   await DBOS.startWorkflow(DeriveKeywordsWorkflow).run(parsed.data);
   return { queued: true };
})
```

**Step 2: Typecheck**
```bash
bun run typecheck
```

**Step 3: Commit**
```bash
git add apps/server/src/index.ts
git commit -m "feat(server): add /internal/jobs/derive-keywords HTTP endpoint"
```

---

## Task 9: Fire-and-forget in `apps/web` categories router

**Files:**
- Modify: `apps/web/src/integrations/orpc/router/categories.ts`

**Step 1: Check `SERVER_URL` exists in env**
```bash
grep "SERVER_URL" core/environment/src/server.ts
```

If missing, add to `core/environment/src/server.ts`:
```typescript
SERVER_URL: z.string().url(),
```

And to `apps/web/.env.local`:
```
SERVER_URL=http://localhost:9877
```

**Step 2: Add the fire-and-forget helper and update `create`/`update`**

Add imports at the top of `apps/web/src/integrations/orpc/router/categories.ts`:
```typescript
import { env } from "@core/environment/server";
import { ResultAsync } from "neverthrow";
import { AppError } from "@core/logging/errors";
```

Add module-level helper (before the procedure exports):
```typescript
function enqueueKeywordDerivation(input: {
   categoryId: string;
   teamId: string;
   organizationId: string;
   name: string;
   description?: string | null;
}): void {
   void ResultAsync.fromPromise(
      fetch(`${env.SERVER_URL}/internal/jobs/derive-keywords`, {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify(input),
      }),
      (e) => AppError.internal(`Failed to enqueue keyword derivation: ${String(e)}`),
   );
}
```

Update `create` handler:
```typescript
export const create = protectedProcedure
   .input(createCategorySchema)
   .handler(async ({ context, input }) => {
      const category = await createCategory(context.db, context.teamId, input);
      enqueueKeywordDerivation({
         categoryId: category.id,
         teamId: context.teamId,
         organizationId: context.organizationId,
         name: category.name,
         description: category.description,
      });
      return category;
   });
```

Update `update` handler — enqueue only when name or description changes:
```typescript
export const update = protectedProcedure
   .input(idSchema.merge(updateCategorySchema))
   .handler(async ({ context, input }) => {
      await ensureCategoryOwnership(context.db, input.id, context.teamId);
      const { id, ...data } = input;
      const category = await updateCategory(context.db, id, data);
      if (data.name !== undefined || data.description !== undefined) {
         enqueueKeywordDerivation({
            categoryId: category.id,
            teamId: context.teamId,
            organizationId: context.organizationId,
            name: category.name,
            description: category.description,
         });
      }
      return category;
   });
```

**Step 3: Typecheck**
```bash
bun run typecheck
```

**Step 4: Commit**
```bash
git add apps/web/src/integrations/orpc/router/categories.ts
git commit -m "feat(categories): fire-and-forget keyword derivation on create/update"
```

---

## Task 10: DBOS Cron — backfill existing categories

**Files:**
- Create: `apps/server/src/workflows/backfill-keywords.workflow.ts`
- Modify: `apps/server/src/index.ts`

**Step 1: Check team schema to get `organizationId`**
```bash
grep -r "organizationId\|org_id" core/database/src/schemas/ --include="*.ts" | grep -i team
```

**Step 2: Create the backfill workflow**

```typescript
import { DBOS } from "@dbos-inc/dbos-sdk";
import { ResultAsync } from "neverthrow";
import { AppError } from "@core/logging/errors";
import { isNull } from "drizzle-orm";
import { categories } from "@core/database/schemas/categories";
import { enforceCreditBudget } from "@packages/events/credits";
import { NOTIFICATION_TYPES } from "@packages/notifications/types";
import type { JobNotification } from "@packages/notifications/schema";
import { jobPublisher } from "../publisher";
import { db, redis } from "../singletons";
import { DeriveKeywordsWorkflow } from "./derive-keywords.workflow";

export class BackfillKeywordsWorkflow {
   @DBOS.scheduled({ crontab: "0 3 * * *" }) // daily at 03:00 UTC
   @DBOS.workflow()
   static async runDaily(_scheduledTime: Date, _actualTime: Date): Promise<void> {
      const teams = await BackfillKeywordsWorkflow.fetchTeamsWithPendingStep();

      for (const team of teams) {
         await BackfillKeywordsWorkflow.processTeamStep(team);
      }
   }

   @DBOS.step()
   static async fetchTeamsWithPendingStep(): Promise<
      { teamId: string; organizationId: string }[]
   > {
      // Join with the team table to get organizationId
      // Check core/database/src/schemas/ for the correct team table + column names
      const rows = await db
         .selectDistinct({ teamId: categories.teamId })
         .from(categories)
         .where(isNull(categories.keywords));

      // TODO: join with teams table to get organizationId per teamId
      // For now returns empty organizationId — fix after checking team schema
      return rows.map((r) => ({ teamId: r.teamId, organizationId: "" }));
   }

   @DBOS.step()
   static async processTeamStep(team: {
      teamId: string;
      organizationId: string;
   }): Promise<void> {
      const pending = await db
         .select()
         .from(categories)
         .where(isNull(categories.keywords))
         .limit(50);

      let processed = 0;

      for (const category of pending) {
         const budgetOk = await ResultAsync.fromPromise(
            enforceCreditBudget(
               team.organizationId,
               "ai.keyword_derived",
               redis,
               null,
            ),
            () => AppError.forbidden("Free tier exhausted"),
         );

         if (budgetOk.isErr()) break;

         await DBOS.startWorkflow(DeriveKeywordsWorkflow).run({
            categoryId: category.id,
            teamId: category.teamId,
            organizationId: team.organizationId,
            name: category.name,
            description: category.description,
         });

         processed++;
      }

      if (processed > 0) {
         const notification: JobNotification = {
            jobId: crypto.randomUUID(),
            type: NOTIFICATION_TYPES.CRON_KEYWORDS_BACKFILL,
            status: "completed",
            payload: { count: processed },
            teamId: team.teamId,
            timestamp: new Date().toISOString(),
         };
         await jobPublisher.publish("job.notification", notification);
      }
   }
}
```

**Step 3: Register in `apps/server/src/index.ts`**

Add import (so DBOS picks up the `@DBOS.scheduled` decorator):
```typescript
import "./workflows/backfill-keywords.workflow";
```

**Step 4: Typecheck**
```bash
bun run typecheck
```

**Step 5: Commit**
```bash
git add apps/server/src/workflows/backfill-keywords.workflow.ts apps/server/src/index.ts
git commit -m "feat(server): add daily backfill cron for category keywords"
```

---

## Task 11: End-to-end verification

**Step 1: Start the full stack**
```bash
bun dev:all
```

**Step 2: Create a test category**

Navigate to the categories page and create a new category. Check `apps/server` logs for:
- `POST /internal/jobs/derive-keywords 200`
- DBOS: `DeriveKeywordsWorkflow started`
- DBOS: `DeriveKeywordsWorkflow completed`

**Step 3: Verify keywords in DB**
```bash
bun run db:studio:local
```

Check the `categories` table — the new row should have `keywords` array populated.

**Step 4: Verify SSE toast in browser**

Toast should appear: `"Palavras-chave geradas para [category name]."`

**Step 5: Typecheck + lint**
```bash
bun run typecheck && bun run check
```
