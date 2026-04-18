# AI Tag (Centro de Custo) Suggestion Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Auto-suggest Centro de Custo (tag) for new transactions using keyword matching first, LLM fallback — same pattern as category AI suggestion.

**Architecture:** When a transaction is created, enqueue a DBOS workflow that tries keyword match first (tag keywords array), falls back to LLM inference if no match, writes `suggestedTagId` to the transaction. Tags derive keywords via a separate DBOS workflow triggered on create/update. UI shows "sugestão IA" badge popover in the Centro de Custo column of the transactions table.

**Tech Stack:** Drizzle ORM, DBOS, `@tanstack/ai`, `@tanstack/ai-openrouter`, neverthrow, oRPC

---

### Task 1: Schema — add `keywords` to tags + `suggestedTagId` to transactions

**Files:**
- Modify: `core/database/src/schemas/tags.ts`
- Modify: `core/database/src/schemas/transactions.ts`

**Step 1: Add `keywords text[]` column to tags schema**

In `core/database/src/schemas/tags.ts`, add the `keywords` column to the `tags` table definition (after `isArchived`):

```typescript
import { text, boolean, timestamp, uuid, index, uniqueIndex } from "drizzle-orm/pg-core";
// add to existing imports:
// (no new imports needed — text is already imported)
```

Add inside the table columns object, after `isArchived`:
```typescript
keywords: text("keywords").array(),
```

Also update `tagSchema` exports — `createSelectSchema` will pick it up automatically.

**Step 2: Add `suggestedTagId` to transactions schema**

In `core/database/src/schemas/transactions.ts`, add after `tagId`:

```typescript
suggestedTagId: uuid("suggested_tag_id").references(() => tags.id, {
   onDelete: "set null",
}),
```

Add an index in the table `(table) => [...]` array:
```typescript
index("transactions_suggested_tag_id_idx").on(table.suggestedTagId),
```

**Step 3: Push schema to database**

```bash
bun run db:push
```

Expected: prompts to add columns, confirm. No data loss.

**Step 4: Verify typecheck passes**

```bash
bun run typecheck
```

Expected: no errors.

**Step 5: Commit**

```bash
git add core/database/src/schemas/tags.ts core/database/src/schemas/transactions.ts
git commit -m "feat(schema): add keywords to tags, suggestedTagId to transactions"
```

---

### Task 2: Tags repository — `findTagByKeywords` + `updateTagKeywords`

**Files:**
- Modify: `core/database/src/repositories/tags-repository.ts`

**Step 1: Add imports**

Add to the top of the file:
```typescript
import { sql, eq, inArray, and } from "drizzle-orm";
```

(Check what's already imported — `eq` and `inArray` might already be there. Only add what's missing.)

**Step 2: Add `findTagByKeywords`**

Append to `tags-repository.ts`:

```typescript
export function findTagByKeywords(
   db: DatabaseInstance,
   teamId: string,
   name: string,
) {
   const words = name
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2);

   if (words.length === 0) return ok(null);

   return fromPromise(
      db.query.tags.findFirst({
         where: (fields, { and, eq, not }) =>
            and(
               eq(fields.teamId, teamId),
               eq(fields.isArchived, false),
               sql`${fields.keywords} && ARRAY[${sql.join(
                  words.map((w) => sql`${w}`),
                  sql`, `,
               )}]::text[]`,
            ),
      }),
      (e) => AppError.database("Falha ao buscar centro de custo por palavras-chave.", { cause: e }),
   ).map((tag) => tag ?? null);
}
```

**Step 3: Add `updateTagKeywords`**

```typescript
export function updateTagKeywords(
   db: DatabaseInstance,
   id: string,
   keywords: string[],
) {
   return fromPromise(
      db
         .update(tags)
         .set({ keywords, updatedAt: dayjs().toDate() })
         .where(eq(tags.id, id)),
      (e) => AppError.database("Falha ao atualizar palavras-chave.", { cause: e }),
   ).map(() => undefined);
}
```

**Step 4: Verify typecheck**

```bash
bun run typecheck
```

**Step 5: Commit**

```bash
git add core/database/src/repositories/tags-repository.ts
git commit -m "feat(tags-repository): add findTagByKeywords and updateTagKeywords"
```

---

### Task 3: Transactions repository — `updateTransactionTag` + update `listTransactions`

**Files:**
- Modify: `core/database/src/repositories/transactions-repository.ts`

**Step 1: Add `updateTransactionTag` function**

After `updateTransactionCategory`, append:

```typescript
export async function updateTransactionTag(
   db: DatabaseInstance,
   id: string,
   data: {
      tagId?: string | null;
      suggestedTagId?: string | null;
   },
) {
   try {
      await db
         .update(transactions)
         .set({ ...data, updatedAt: dayjs().toDate() })
         .where(eq(transactions.id, id));
   } catch (err) {
      propagateError(err);
      throw AppError.database("Falha ao atualizar centro de custo da transação.");
   }
}
```

**Step 2: Update `listTransactions` to join suggestedTags**

In the `listTransactions` function there are two `db.select({...})` blocks (weighted path and normal path). In both, add:

1. Import `tags` schema at the top (it's already imported since `tags` is referenced):

```typescript
import { tags } from "@core/database/schemas/tags";
```

(Check if already imported — add only if missing.)

2. In the normal path `db.select({...})`, after existing fields add:
```typescript
suggestedTagName: suggestedTags.name,
```

3. Before the `.from(transactions)`, create the alias:
```typescript
const suggestedTags = alias(tags, "suggested_tags");
```

4. Add left join after existing joins:
```typescript
.leftJoin(suggestedTags, eq(transactions.suggestedTagId, suggestedTags.id))
```

5. Do the same in the weighted path's `db.select({...})` block.

**Step 3: Clear `suggestedTagId` when `tagId` is set explicitly**

In `updateTransaction`, after the existing `suggestedCategoryId: null` line:
```typescript
...(validated.tagId !== undefined ? { suggestedTagId: null } : {}),
```

Wait — `tagId` is passed as a separate param `tagId?: string | null`. Update:
```typescript
...(tagId !== undefined ? { tagId, suggestedTagId: null } : {}),
```

**Step 4: Verify typecheck**

```bash
bun run typecheck
```

**Step 5: Commit**

```bash
git add core/database/src/repositories/transactions-repository.ts
git commit -m "feat(transactions-repository): add updateTransactionTag, join suggestedTagName in listTransactions"
```

---

### Task 4: AI action — `inferTagWithAI`

**Files:**
- Create: `core/agents/src/actions/suggest-tag.ts`

**Step 1: Create the file**

```typescript
import { fromPromise } from "neverthrow";
import { chat } from "@tanstack/ai";
import { openRouterText } from "@tanstack/ai-openrouter";
import { z } from "zod";
import { AppError } from "@core/logging/errors";

type OpenRouterModelId = Parameters<typeof openRouterText>[0];

export type TagOption = {
   id: string;
   name: string;
   description?: string | null;
};

const outputSchema = z.object({
   tagName: z.string().nullable(),
   confidence: z.enum(["high", "low"]),
});

export function inferTagWithAI(
   tagOptions: TagOption[],
   transactionName: string,
   model: OpenRouterModelId,
) {
   const list = tagOptions
      .map((t) => `- ${t.name}${t.description ? ` (${t.description})` : ""}`)
      .join("\n");

   const prompt = `Você é um assistente financeiro brasileiro. Com base no nome da transação abaixo, identifique o Centro de Custo mais adequado da lista.

Transação: ${transactionName}

Centros de Custo disponíveis:
${list}

Retorne o nome exato de um Centro de Custo da lista, ou null se nenhum for adequado.
Se tiver certeza, retorne confidence "high". Se estiver em dúvida, retorne "low".`;

   return fromPromise(
      chat({
         adapter: openRouterText(model),
         messages: [
            { role: "user", content: [{ type: "text", content: prompt }] },
         ],
         outputSchema,
         stream: false,
      }).then((result): { tagId: string; confidence: "high" | "low" } | null => {
         if (!result.tagName) return null;
         const match = tagOptions.find((t) => t.name === result.tagName);
         if (!match) return null;
         return { tagId: match.id, confidence: result.confidence };
      }),
      (e) => AppError.internal("Falha na inferência de centro de custo por IA.", { cause: e }),
   );
}
```

**Step 2: Verify typecheck**

```bash
bun run typecheck
```

**Step 3: Commit**

```bash
git add core/agents/src/actions/suggest-tag.ts
git commit -m "feat(agents): add inferTagWithAI action"
```

---

### Task 5: Notifications — add `AI_TAG_SUGGESTED` and `AI_TAG_KEYWORD_DERIVED`

**Files:**
- Modify: `packages/notifications/src/types.ts`

**Step 1: Add notification types**

```typescript
export const NOTIFICATION_TYPES = {
   AI_KEYWORD_DERIVED: "ai.keyword_derived",
   AI_TRANSACTION_CATEGORIZED: "ai.transaction_categorized",
   AI_TAG_KEYWORD_DERIVED: "ai.tag_keyword_derived",
   AI_TAG_SUGGESTED: "ai.tag_suggested",
   CRON_KEYWORDS_BACKFILL: "cron.keywords_backfill",
} as const;
```

Add payload types:
```typescript
"ai.tag_keyword_derived": {
   tagId: string;
   tagName: string;
   count: number;
};
"ai.tag_suggested": {
   transactionId: string;
};
```

**Step 2: Verify typecheck**

```bash
bun run typecheck
```

**Step 3: Commit**

```bash
git add packages/notifications/src/types.ts
git commit -m "feat(notifications): add AI_TAG_KEYWORD_DERIVED and AI_TAG_SUGGESTED types"
```

---

### Task 6: Events — add `ai.tag_keyword_derived`

**Files:**
- Modify: `packages/events/src/ai.ts`

**Step 1: Add pricing + event key**

In `AI_PRICING`:
```typescript
"ai.tag_keyword_derived": "0.010000",
```

In `AI_EVENTS`:
```typescript
"ai.tag_keyword_derived": "ai.tag_keyword_derived",
```

**Step 2: Add schema + emit function**

```typescript
export const aiTagKeywordDerivedEventSchema = z.object({
   tagId: z.uuid(),
   keywordCount: z.number().int().nonnegative(),
   model: z.string(),
   latencyMs: z.number().nonnegative(),
});
export type AiTagKeywordDerivedEvent = z.infer<typeof aiTagKeywordDerivedEventSchema>;

export function emitAiTagKeywordDerived(
   emit: EmitFn,
   ctx: { organizationId: string; userId?: string; teamId?: string },
   properties: AiTagKeywordDerivedEvent,
) {
   return emit({
      ...ctx,
      eventName: AI_EVENTS["ai.tag_keyword_derived"],
      eventCategory: EVENT_CATEGORIES.ai,
      properties,
   });
}
```

**Step 3: Verify typecheck**

```bash
bun run typecheck
```

**Step 4: Commit**

```bash
git add packages/events/src/ai.ts
git commit -m "feat(events): add ai.tag_keyword_derived event"
```

---

### Task 7: Workflow — `derive-tag-keywords-workflow.ts`

**Files:**
- Create: `packages/workflows/src/workflows/derive-tag-keywords-workflow.ts`
- Modify: `packages/workflows/src/setup.ts`

**Step 1: Create workflow (mirror of `derive-keywords-workflow.ts` but for tags)**

```typescript
import type { DBOSClient } from "@dbos-inc/dbos-sdk";
import { fromPromise } from "neverthrow";
import dayjs from "dayjs";
import { DBOS, WorkflowQueue } from "@dbos-inc/dbos-sdk";
import { updateTagKeywords } from "@core/database/repositories/tags-repository";
import { emitAiTagKeywordDerived } from "@packages/events/ai";
import { createEmitFn } from "@packages/events/emit";
import { enforceCreditBudget } from "@packages/events/credits";
import { deriveKeywordsWithAI } from "@core/agents/actions/keywords";
import { NOTIFICATION_TYPES } from "@packages/notifications/types";
import type { JobNotification } from "@packages/notifications/schema";
import { getDeps, getPublisher } from "../context";

const MODEL = "google/gemini-3.1-flash-lite-preview";

export const deriveTagKeywordsQueue = new WorkflowQueue(
   "workflow:derive-tag-keywords",
   { workerConcurrency: 5 },
);

export type DeriveTagKeywordsInput = {
   tagId: string;
   teamId: string;
   organizationId: string;
   name: string;
   description?: string | null;
   userId?: string;
   stripeCustomerId?: string | null;
};

async function publishFailed(
   publisher: ReturnType<typeof getPublisher>,
   teamId: string,
   msg: string,
   stepName: string,
) {
   await DBOS.runStep(
      () =>
         publisher.publish("job.notification", {
            jobId: crypto.randomUUID(),
            type: NOTIFICATION_TYPES.AI_TAG_KEYWORD_DERIVED,
            status: "failed",
            message: msg,
            teamId,
            timestamp: dayjs().toISOString(),
         } satisfies JobNotification),
      { name: stepName },
   );
}

async function deriveTagKeywordsWorkflowFn(input: DeriveTagKeywordsInput) {
   const { db, redis, posthog, stripeClient } = getDeps();
   const publisher = getPublisher();
   const ctx = `[derive-tag-keywords] tag=${input.tagId} team=${input.teamId}`;

   DBOS.logger.info(`${ctx} started name="${input.name}"`);

   await DBOS.runStep(
      () =>
         publisher.publish("job.notification", {
            jobId: crypto.randomUUID(),
            type: NOTIFICATION_TYPES.AI_TAG_KEYWORD_DERIVED,
            status: "started",
            message: `Gerando palavras-chave para ${input.name}...`,
            teamId: input.teamId,
            timestamp: dayjs().toISOString(),
         } satisfies JobNotification),
      { name: "publishStarted" },
   );

   const budgetResult = await fromPromise(
      DBOS.runStep(
         () =>
            enforceCreditBudget(
               input.organizationId,
               "ai.tag_keyword_derived",
               redis,
               input.stripeCustomerId,
            ),
         { name: "enforceBudget" },
      ),
      (e) => (e instanceof Error ? e.message : String(e)),
   );

   if (budgetResult.isErr()) {
      DBOS.logger.warn(`${ctx} budget exceeded: ${budgetResult.error}`);
      await publishFailed(publisher, input.teamId, budgetResult.error, "publishFailed");
      return;
   }

   const keywordsResult = await fromPromise(
      DBOS.runStep(
         () =>
            deriveKeywordsWithAI({
               name: input.name,
               description: input.description,
               model: MODEL,
            }).match(
               (v) => v,
               (e) => { throw e; },
            ),
         { name: "deriveKeywords" },
      ),
      (e) => (e instanceof Error ? e.message : String(e)),
   );

   if (keywordsResult.isErr()) {
      DBOS.logger.error(`${ctx} derive failed: ${keywordsResult.error}`);
      await publishFailed(publisher, input.teamId, keywordsResult.error, "publishFailed");
      return;
   }

   const keywords = keywordsResult.value;
   DBOS.logger.info(`${ctx} derived ${keywords.length} keywords: [${keywords.join(", ")}]`);

   const saveResult = await fromPromise(
      DBOS.runStep(
         async () =>
            (await updateTagKeywords(db, input.tagId, keywords)).match(
               () => null,
               (e) => { throw e; },
            ),
         { name: "saveKeywords" },
      ),
      (e) => (e instanceof Error ? e.message : String(e)),
   );

   if (saveResult.isErr()) {
      DBOS.logger.error(`${ctx} save failed: ${saveResult.error}`);
      await publishFailed(publisher, input.teamId, saveResult.error, "publishFailed");
      return;
   }

   DBOS.logger.info(`${ctx} saved`);

   await DBOS.runStep(
      async () => {
         const emit = createEmitFn(db, posthog, stripeClient, input.stripeCustomerId ?? undefined, redis);
         await emitAiTagKeywordDerived(
            emit,
            { organizationId: input.organizationId, teamId: input.teamId, userId: input.userId },
            { tagId: input.tagId, keywordCount: keywords.length, model: MODEL, latencyMs: 0 },
         );
      },
      { name: "emitBilling" },
   );

   await DBOS.runStep(
      () =>
         publisher.publish("job.notification", {
            jobId: crypto.randomUUID(),
            type: NOTIFICATION_TYPES.AI_TAG_KEYWORD_DERIVED,
            status: "completed",
            message: `Palavras-chave geradas para ${input.name}.`,
            payload: { tagId: input.tagId, tagName: input.name, count: keywords.length },
            teamId: input.teamId,
            timestamp: dayjs().toISOString(),
         } satisfies JobNotification),
      { name: "publishCompleted" },
   );

   DBOS.logger.info(`${ctx} completed`);
}

export const deriveTagKeywordsWorkflow = DBOS.registerWorkflow(deriveTagKeywordsWorkflowFn);

export async function enqueueDeriveTagKeywordsWorkflow(
   client: DBOSClient,
   input: DeriveTagKeywordsInput,
): Promise<void> {
   await client.enqueue(
      {
         workflowName: deriveTagKeywordsWorkflowFn.name,
         queueName: deriveTagKeywordsQueue.name,
      },
      input,
   );
}
```

**Step 2: Register in `setup.ts`**

Add import side-effect after existing workflow imports:
```typescript
import "./workflows/derive-tag-keywords-workflow";
```

**Step 3: Verify typecheck**

```bash
bun run typecheck
```

**Step 4: Commit**

```bash
git add packages/workflows/src/workflows/derive-tag-keywords-workflow.ts packages/workflows/src/setup.ts
git commit -m "feat(workflows): add derive-tag-keywords workflow"
```

---

### Task 8: Workflow — `suggest-tag-workflow.ts`

**Files:**
- Create: `packages/workflows/src/workflows/suggest-tag-workflow.ts`
- Modify: `packages/workflows/src/setup.ts`

**Step 1: Create workflow (mirror of `categorization-workflow.ts` but for tags)**

```typescript
import type { DBOSClient } from "@dbos-inc/dbos-sdk";
import { fromPromise } from "neverthrow";
import { DBOS, WorkflowQueue } from "@dbos-inc/dbos-sdk";
import { findTagByKeywords, listTags } from "@core/database/repositories/tags-repository";
import { updateTransactionTag } from "@core/database/repositories/transactions-repository";
import { inferTagWithAI } from "@core/agents/actions/suggest-tag";
import { NOTIFICATION_TYPES } from "@packages/notifications/types";
import type { JobNotification } from "@packages/notifications/schema";
import { getDeps, getPublisher } from "../context";

export type SuggestTagInput = {
   transactionId: string;
   teamId: string;
   name: string;
};

const MODEL = "google/gemini-3.1-flash-lite-preview";

export const suggestTagQueue = new WorkflowQueue("workflow:suggest-tag", {
   workerConcurrency: 10,
});

async function publishFailed(
   publisher: ReturnType<typeof getPublisher>,
   teamId: string,
   msg: string,
   stepName: string,
) {
   await DBOS.runStep(
      () =>
         publisher.publish("job.notification", {
            jobId: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            type: NOTIFICATION_TYPES.AI_TAG_SUGGESTED,
            status: "failed",
            message: msg,
            teamId,
         } satisfies JobNotification),
      { name: stepName },
   );
}

async function suggestTagWorkflowFn(input: SuggestTagInput) {
   const { db } = getDeps();
   const publisher = getPublisher();
   const ctx = `[suggest-tag] tx=${input.transactionId} team=${input.teamId}`;

   DBOS.logger.info(`${ctx} started name="${input.name}"`);

   // Step 1: keyword match
   const keywordMatchResult = await fromPromise(
      DBOS.runStep(
         async () =>
            (await findTagByKeywords(db, input.teamId, input.name)).match(
               (v) => v,
               (e) => { throw e; },
            ),
         { name: "matchKeywords" },
      ),
      (e) => (e instanceof Error ? e.message : String(e)),
   );

   if (keywordMatchResult.isErr()) {
      DBOS.logger.error(`${ctx} keyword match failed: ${keywordMatchResult.error}`);
      await publishFailed(publisher, input.teamId, keywordMatchResult.error, "publishFailed");
      return;
   }

   const keywordMatch = keywordMatchResult.value;

   if (keywordMatch) {
      await DBOS.runStep(
         () => updateTransactionTag(db, input.transactionId, { suggestedTagId: keywordMatch.id }),
         { name: "applyTag" },
      );
      await DBOS.runStep(
         () =>
            publisher.publish("job.notification", {
               jobId: crypto.randomUUID(),
               timestamp: new Date().toISOString(),
               type: NOTIFICATION_TYPES.AI_TAG_SUGGESTED,
               status: "completed",
               message: `Centro de custo sugerido para "${input.name}".`,
               payload: { transactionId: input.transactionId },
               teamId: input.teamId,
            } satisfies JobNotification),
         { name: "publishCompleted" },
      );
      DBOS.logger.info(`${ctx} completed via keyword match`);
      return;
   }

   // Step 2: LLM fallback
   const aiResult = await fromPromise(
      DBOS.runStep(
         async () => {
            const tagsResult = await listTags(db, input.teamId, { includeArchived: false });
            return tagsResult.match(
               (tagList) =>
                  inferTagWithAI(tagList, input.name, MODEL).match(
                     (v) => v,
                     (e) => { throw e; },
                  ),
               (e) => { throw e; },
            );
         },
         { name: "inferWithAI" },
      ),
      (e) => (e instanceof Error ? e.message : String(e)),
   );

   if (aiResult.isErr()) {
      DBOS.logger.error(`${ctx} AI inference failed: ${aiResult.error}`);
      await publishFailed(publisher, input.teamId, aiResult.error, "publishFailed");
      return;
   }

   if (!aiResult.value) {
      DBOS.logger.info(`${ctx} no tag match found`);
      return;
   }

   const { tagId, confidence } = aiResult.value;

   if (confidence !== "high") {
      DBOS.logger.info(`${ctx} low confidence, skipping suggestion`);
      return;
   }

   await DBOS.runStep(
      () => updateTransactionTag(db, input.transactionId, { suggestedTagId: tagId }),
      { name: "applyTag" },
   );

   await DBOS.runStep(
      () =>
         publisher.publish("job.notification", {
            jobId: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            type: NOTIFICATION_TYPES.AI_TAG_SUGGESTED,
            status: "completed",
            message: `Centro de custo sugerido para "${input.name}".`,
            payload: { transactionId: input.transactionId },
            teamId: input.teamId,
         } satisfies JobNotification),
      { name: "publishCompleted" },
   );

   DBOS.logger.info(`${ctx} completed via AI inference`);
}

export const suggestTagWorkflow = DBOS.registerWorkflow(suggestTagWorkflowFn);

export async function enqueueSuggestTagWorkflow(
   client: DBOSClient,
   input: SuggestTagInput,
): Promise<void> {
   await client.enqueue(
      {
         workflowName: suggestTagWorkflowFn.name,
         queueName: suggestTagQueue.name,
         workflowID: `suggest-tag-${input.transactionId}`,
      },
      input,
   );
}
```

**Step 2: Register in `setup.ts`**

```typescript
import "./workflows/suggest-tag-workflow";
```

**Step 3: Verify typecheck**

```bash
bun run typecheck
```

**Step 4: Commit**

```bash
git add packages/workflows/src/workflows/suggest-tag-workflow.ts packages/workflows/src/setup.ts
git commit -m "feat(workflows): add suggest-tag workflow"
```

---

### Task 9: Router/tags — trigger keyword derivation on create/update

**Files:**
- Modify: `apps/web/src/integrations/orpc/router/tags.ts`

**Step 1: Import workflow enqueue function**

```typescript
import { enqueueDeriveTagKeywordsWorkflow } from "@packages/workflows/workflows/derive-tag-keywords-workflow";
```

**Step 2: Enqueue after `create`**

In the `create` handler, after returning tag, enqueue keyword derivation. The handler currently does `.match()` directly. Restructure to enqueue before returning:

```typescript
export const create = protectedProcedure
   .input(createTagSchema)
   .handler(async ({ context, input }) => {
      const tag = (await createTag(context.db, context.teamId, input)).match(
         (t) => t,
         (e) => { throw WebAppError.fromAppError(e); },
      );

      await enqueueDeriveTagKeywordsWorkflow(context.workflowClient, {
         tagId: tag.id,
         teamId: context.teamId,
         organizationId: context.organizationId,
         name: tag.name,
         description: tag.description,
         userId: context.userId,
         stripeCustomerId: context.session.user.stripeCustomerId ?? null,
      });

      return tag;
   });
```

**Step 3: Enqueue after `update`**

Find the `update` handler (currently in `tags.ts`). After a successful update, enqueue if name or description changed:

```typescript
await enqueueDeriveTagKeywordsWorkflow(context.workflowClient, {
   tagId: id,
   teamId: context.teamId,
   organizationId: context.organizationId,
   name: updated.name,
   description: updated.description,
   userId: context.userId,
   stripeCustomerId: context.session.user.stripeCustomerId ?? null,
});
```

**Step 4: Verify typecheck**

```bash
bun run typecheck
```

**Step 5: Commit**

```bash
git add apps/web/src/integrations/orpc/router/tags.ts
git commit -m "feat(tags-router): enqueue derive-tag-keywords on create/update"
```

---

### Task 10: Router/transactions — enqueue tag suggestion + accept/dismiss procedures

**Files:**
- Modify: `apps/web/src/integrations/orpc/router/transactions.ts`

**Step 1: Import**

```typescript
import { enqueueSuggestTagWorkflow } from "@packages/workflows/workflows/suggest-tag-workflow";
```

**Step 2: Enqueue on create**

After the existing `enqueueCategorizationWorkflow` block (line ~122), add:

```typescript
if (transaction && input.name && !input.tagId) {
   await enqueueSuggestTagWorkflow(context.workflowClient, {
      transactionId: transaction.id,
      teamId: context.teamId,
      name: input.name,
   });
}
```

Do the same in the **bulk import** path (line ~281) and any other transaction creation paths (line ~450). Check all 3 occurrences of `enqueueCategorizationWorkflow` and mirror them for tag suggestion.

**Step 3: Add `acceptSuggestedTag` procedure**

Append to `transactions.ts`:

```typescript
export const acceptSuggestedTag = protectedProcedure
   .input(z.object({ id: z.string().uuid() }))
   .handler(async ({ context, input }) => {
      const tx = await ensureTransactionOwnership(context.db, input.id, context.teamId);
      if (!tx.suggestedTagId) {
         throw WebAppError.badRequest("Nenhuma sugestão de centro de custo disponível.");
      }
      await updateTransactionTag(context.db, input.id, {
         tagId: tx.suggestedTagId,
         suggestedTagId: null,
      });
      return { ok: true };
   });
```

**Step 4: Add `dismissSuggestedTag` procedure**

```typescript
export const dismissSuggestedTag = protectedProcedure
   .input(z.object({ id: z.string().uuid() }))
   .handler(async ({ context, input }) => {
      await ensureTransactionOwnership(context.db, input.id, context.teamId);
      await updateTransactionTag(context.db, input.id, { suggestedTagId: null });
      return { ok: true };
   });
```

**Step 5: Check `updateTransactionTag` is imported**

Add to imports from `transactions-repository`:
```typescript
import { ..., updateTransactionTag } from "@core/database/repositories/transactions-repository";
```

**Step 6: Register procedures in router index**

Find `apps/web/src/integrations/orpc/router/index.ts` (or wherever `transactions` router is assembled). Add:
```typescript
acceptSuggestedTag,
dismissSuggestedTag,
```

**Step 7: Verify typecheck**

```bash
bun run typecheck
```

**Step 8: Commit**

```bash
git add apps/web/src/integrations/orpc/router/transactions.ts
git commit -m "feat(transactions-router): enqueue suggest-tag workflow, add accept/dismiss suggestedTag procedures"
```

---

### Task 11: UI — `SuggestedTagCell` + Centro de Custo column

**Files:**
- Modify: `apps/web/src/features/transactions/ui/transactions-columns.tsx`

**Step 1: Add `SuggestedTagCell` component (above `buildTransactionColumns`)**

Modeled after the existing `SuggestedCategoryCell`:

```tsx
function SuggestedTagCell({
   id,
   tagName,
}: {
   id: string;
   tagName: string | null;
}) {
   const accept = useMutation(
      orpc.transactions.acceptSuggestedTag.mutationOptions(),
   );
   const dismiss = useMutation(
      orpc.transactions.dismissSuggestedTag.mutationOptions(),
   );

   return (
      <Popover>
         <PopoverTrigger asChild>
            <Badge variant="outline" className="text-xs cursor-pointer">
               sugestão IA
            </Badge>
         </PopoverTrigger>
         <PopoverContent className="w-56 p-3">
            {tagName && (
               <p className="text-sm font-medium">{tagName}</p>
            )}
            <p className="text-sm text-muted-foreground">
               Centro de custo sugerido pela IA. Deseja aceitar?
            </p>
            <div className="flex gap-2">
               <Button
                  size="sm"
                  className="flex-1"
                  disabled={accept.isPending || dismiss.isPending}
                  onClick={() => accept.mutate({ id })}
               >
                  Aceitar
               </Button>
               <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  disabled={accept.isPending || dismiss.isPending}
                  onClick={() => dismiss.mutate({ id })}
               >
                  Ignorar
               </Button>
            </div>
         </PopoverContent>
      </Popover>
   );
}
```

**Step 2: Add Centro de Custo column to `buildTransactionColumns`**

Add after the category column (or wherever appropriate):

```tsx
{
   accessorKey: "tagName",
   header: "Centro de Custo",
   cell: ({ row }) => {
      const name = row.original.tagName;
      const hasSuggestion = !name && row.original.suggestedTagId;
      if (!name && !hasSuggestion)
         return <span className="text-xs text-muted-foreground">—</span>;
      if (hasSuggestion)
         return (
            <SuggestedTagCell
               id={row.original.id}
               tagName={row.original.suggestedTagName ?? null}
            />
         );
      return <span className="text-sm">{name}</span>;
   },
},
```

Note: `tagName` and `suggestedTagId` / `suggestedTagName` need to be part of `TransactionRow`. They come from `Outputs["transactions"]["getAll"]["data"][number]` — which is inferred from the oRPC router return type — which comes from `listTransactions`. Once Task 3 adds `suggestedTagName` to the select, these fields will be available automatically. `tagName` will also need to be joined — check if it's already joined in `listTransactions`. If not, add the join for `tags` similar to how `suggestedTags` is joined.

**Step 3: Verify `tagName` is in the listTransactions select**

Check `transactions-repository.ts` — if `tagName` isn't already joined (it likely isn't based on the code), add:

```typescript
const tagAlias = alias(tags, "tag_alias");
// In select:
tagName: tagAlias.name,
// In joins:
.leftJoin(tagAlias, eq(transactions.tagId, tagAlias.id))
```

Do this in Task 3 if you see it's missing.

**Step 4: Verify typecheck**

```bash
bun run typecheck
```

**Step 5: Commit**

```bash
git add apps/web/src/features/transactions/ui/transactions-columns.tsx
git commit -m "feat(transactions-ui): add SuggestedTagCell and Centro de Custo column"
```

---

### Task 12: Credits — register `ai.tag_keyword_derived` event

**Files:**
- Check: `packages/events/src/credits.ts`

**Step 1: Verify `enforceCreditBudget` supports `ai.tag_keyword_derived`**

Open `packages/events/src/credits.ts` and check the allowed event names. If it uses a union type, add `"ai.tag_keyword_derived"` to it. If it's dynamic (reads from `AI_PRICING`), no change needed — Task 6 already added the pricing entry.

**Step 2: Verify typecheck**

```bash
bun run typecheck
```

**Step 3: Commit if changed**

```bash
git add packages/events/src/credits.ts
git commit -m "feat(credits): support ai.tag_keyword_derived budget enforcement"
```

---

### Task 13: Final verification

**Step 1: Full typecheck**

```bash
bun run typecheck
```

Expected: zero errors.

**Step 2: Run tests**

```bash
bun run test
```

Expected: all pass.

**Step 3: Start dev and smoke test**

```bash
bun dev
```

1. Create a tag (Centro de Custo) — verify keyword derivation notification fires
2. Create a transaction with that name — verify `suggestedTagId` gets set after a few seconds
3. Verify "sugestão IA" badge appears in the Centro de Custo column
4. Click badge → Aceitar → verify `tagId` is set and badge disappears
5. Repeat with Ignorar → verify `suggestedTagId` is cleared
