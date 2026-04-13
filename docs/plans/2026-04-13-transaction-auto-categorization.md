# Transaction Auto-Categorization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Automatically assign categories to transactions on creation using keyword matching first, falling back to AI inference only when needed.

**Architecture:** Keyword match runs as a DB query against `categories.keywords` (text array). If no match, a cheap LLM call infers the best existing category. Both run inside a DBOS workflow triggered fire-and-forget from the `transactions.create` oRPC procedure. Low-confidence AI results stored as `suggestedCategoryId` for user review; high-confidence and keyword matches set `categoryId` directly.

**Tech Stack:** DBOS workflows, Drizzle ORM, `@tanstack/ai` + `@tanstack/ai-openrouter`, oRPC, PostgreSQL text array operators.

---

### Task 1: Add `suggestedCategoryId` column to transactions schema

**Files:**
- Modify: `core/database/src/schemas/transactions.ts`

**Step 1: Add column to transactions table**

In `core/database/src/schemas/transactions.ts`, add after the `categoryId` column:

```typescript
suggestedCategoryId: uuid("suggested_category_id").references(
  () => categories.id,
  { onDelete: "set null" },
),
```

Make sure `categories` is already imported in that file (it is, via the `categoryId` FK).

**Step 2: Push schema to DB**

```bash
bun run db:push
```

Expected: migration applied, no errors.

**Step 3: Commit**

```bash
git add core/database/src/schemas/transactions.ts
git commit -m "feat(schema): add suggestedCategoryId to transactions"
```

---

### Task 2: Add `updateTransactionCategory` to transactions repository

**Files:**
- Modify: `core/database/src/repositories/transactions-repository.ts`

**Step 1: Add the function**

At the bottom of `core/database/src/repositories/transactions-repository.ts`:

```typescript
export async function updateTransactionCategory(
  db: DatabaseInstance,
  id: string,
  data: {
    categoryId?: string | null;
    suggestedCategoryId?: string | null;
  },
) {
  try {
    await db
      .update(transactions)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(transactions.id, id));
  } catch (err) {
    propagateError(err);
    throw AppError.database("Failed to update transaction category");
  }
}
```

**Step 2: Commit**

```bash
git add core/database/src/repositories/transactions-repository.ts
git commit -m "feat(repo): add updateTransactionCategory"
```

---

### Task 3: Add `findCategoryByKeywords` to categories repository

**Files:**
- Modify: `core/database/src/repositories/categories-repository.ts`

**Step 1: Add query function**

This does one DB round-trip: checks if any keyword in the category's `keywords` array is a substring of the transaction name (case-insensitive). Filters by type, excludes archived, returns best match (deepest level first).

```typescript
export async function findCategoryByKeywords(
  db: DatabaseInstance,
  teamId: string,
  opts: {
    name: string;
    type: "income" | "expense";
  },
): Promise<{ id: string; name: string } | null> {
  try {
    const rows = await db
      .select({ id: categories.id, name: categories.name, level: categories.level })
      .from(categories)
      .where(
        and(
          eq(categories.teamId, teamId),
          eq(categories.type, opts.type),
          eq(categories.isArchived, false),
          sql`EXISTS (
            SELECT 1 FROM unnest(${categories.keywords}) k
            WHERE ${opts.name} ILIKE '%' || k || '%'
          )`,
        ),
      )
      .orderBy(desc(categories.level))
      .limit(1);

    return rows[0] ?? null;
  } catch (err) {
    propagateError(err);
    throw AppError.database("Failed to find category by keywords");
  }
}
```

Make sure `sql`, `desc`, `and`, `eq` are imported from `drizzle-orm` at the top of the file (they likely already are).

**Step 2: Commit**

```bash
git add core/database/src/repositories/categories-repository.ts
git commit -m "feat(repo): add findCategoryByKeywords"
```

---

### Task 4: Create the categorization DBOS workflow

**Files:**
- Create: `apps/web/src/integrations/dbos/workflows/categorization.workflow.ts`
- Modify: `apps/web/src/integrations/dbos/workflows/index.ts`

**Step 1: Create workflow file**

```typescript
import { DBOS } from "@dbos-inc/dbos-sdk";
import { chat } from "@tanstack/ai";
import { openRouterText } from "@tanstack/ai-openrouter";
import { z } from "zod";
import { db } from "@core/database/client";
import { findCategoryByKeywords } from "@core/database/repositories/categories-repository";
import { listCategories } from "@core/database/repositories/categories-repository";
import { updateTransactionCategory } from "@core/database/repositories/transactions-repository";
import { env } from "@core/environment/server";

export type CategorizationInput = {
  transactionId: string;
  teamId: string;
  name: string;
  type: "income" | "expense";
  contactName?: string | null;
};

const MODEL = "google/gemini-3.1-flash-lite-preview";

const outputSchema = z.object({
  categoryName: z.string().nullable(),
  confidence: z.enum(["high", "low"]),
});

export class CategorizationWorkflow {
  @DBOS.workflow()
  static async run(input: CategorizationInput) {
    const keywordMatch = await CategorizationWorkflow.matchKeywordsStep(input);

    if (keywordMatch) {
      await CategorizationWorkflow.applyStep(input.transactionId, {
        categoryId: keywordMatch.id,
      });
      return;
    }

    const aiResult = await CategorizationWorkflow.inferWithAIStep(input);
    if (!aiResult) return;

    if (aiResult.confidence === "high") {
      await CategorizationWorkflow.applyStep(input.transactionId, {
        categoryId: aiResult.categoryId,
      });
    } else {
      await CategorizationWorkflow.applyStep(input.transactionId, {
        suggestedCategoryId: aiResult.categoryId,
      });
    }
  }

  @DBOS.step()
  static async matchKeywordsStep(
    input: Pick<CategorizationInput, "teamId" | "name" | "type">,
  ): Promise<{ id: string } | null> {
    return findCategoryByKeywords(db, input.teamId, {
      name: input.name,
      type: input.type,
    });
  }

  @DBOS.step()
  static async inferWithAIStep(
    input: CategorizationInput,
  ): Promise<{ categoryId: string; confidence: "high" | "low" } | null> {
    const categories = await listCategories(db, input.teamId, {
      type: input.type,
      includeArchived: false,
    });
    if (categories.length === 0) return null;

    const categoryList = categories
      .map((c) => `- ${c.name}${c.keywords?.length ? ` (palavras: ${c.keywords.join(", ")})` : ""}`)
      .join("\n");

    const prompt = `Você é um assistente financeiro brasileiro. Classifique a transação abaixo na categoria mais adequada.

Transação:
- Nome: ${input.name}${input.contactName ? `\n- Contato: ${input.contactName}` : ""}
- Tipo: ${input.type === "income" ? "Receita" : "Despesa"}

Categorias disponíveis:
${categoryList}

Retorne o nome exato de uma categoria da lista acima, ou null se nenhuma for adequada.
Se tiver certeza, retorne confidence "high". Se estiver em dúvida, retorne "low".`;

    const result = await chat({
      adapter: openRouterText(MODEL, { apiKey: env.OPENROUTER_API_KEY }),
      messages: [{ role: "user", content: [{ type: "text", content: prompt }] }],
      outputSchema,
      stream: false,
    });

    if (!result.categoryName) return null;

    const match = categories.find((c) => c.name === result.categoryName);
    if (!match) return null;

    return { categoryId: match.id, confidence: result.confidence };
  }

  @DBOS.step()
  static async applyStep(
    transactionId: string,
    data: { categoryId?: string; suggestedCategoryId?: string },
  ) {
    await updateTransactionCategory(db, transactionId, data);
  }
}
```

**Step 2: Export from index**

In `apps/web/src/integrations/dbos/workflows/index.ts`, add:

```typescript
export { CategorizationWorkflow } from "./categorization.workflow";
```

**Step 3: Commit**

```bash
git add apps/web/src/integrations/dbos/workflows/categorization.workflow.ts \
        apps/web/src/integrations/dbos/workflows/index.ts
git commit -m "feat(workflow): add CategorizationWorkflow"
```

---

### Task 5: Wire workflow into transactions.create router

**Files:**
- Modify: `apps/web/src/integrations/orpc/router/transactions.ts`

**Step 1: Add trigger helper**

At the top of the file, after existing imports, add:

```typescript
import { DBOS } from "@dbos-inc/dbos-sdk";
import { CategorizationWorkflow } from "../../../integrations/dbos/workflows/categorization.workflow";
import { logger } from "@core/logging";

function enqueueCategorization(input: {
  transactionId: string;
  teamId: string;
  name: string;
  type: "income" | "expense";
  contactName?: string | null;
}): void {
  void DBOS.startWorkflow(CategorizationWorkflow)
    .run(input)
    .catch((err) => {
      logger.error(
        { err, transactionId: input.transactionId },
        "Failed to start categorization workflow",
      );
    });
}
```

**Step 2: Call after transaction creation**

Inside the `create` procedure handler, after the transaction is created and **only if `categoryId` is not already set** (user manually chose one), call:

```typescript
if (!input.categoryId) {
  enqueueCategorization({
    transactionId: transaction.id,
    teamId: context.teamId,
    name: input.name,
    type: input.type as "income" | "expense",
    contactName: input.contactName ?? null,
  });
}
```

Check what `input.contactName` looks like in the existing schema — it may be `contactId` not `contactName`. If so, skip `contactName` for now (workflow still works, just without contact context).

**Step 3: Typecheck**

```bash
bun run typecheck
```

Fix any errors before committing.

**Step 4: Commit**

```bash
git add apps/web/src/integrations/orpc/router/transactions.ts
git commit -m "feat(router): trigger categorization workflow on transaction create"
```

---

### Task 6: Add "sugestão IA" badge to transaction UI

**Files:**
- Find the transaction list/row component — likely in `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/transactions.tsx` or colocated `-transactions/` folder
- Modify the component that renders each transaction row

**Step 1: Locate the row component**

Search for where `categoryId` is rendered in the transactions UI. The badge should appear on the category cell or transaction name when `suggestedCategoryId` is set and `categoryId` is null.

**Step 2: Query includes suggestedCategoryId**

Ensure `getAll` or `getById` oRPC procedure returns `suggestedCategoryId`. Check `apps/web/src/integrations/orpc/router/transactions.ts` — the list query likely returns raw DB rows. If `suggestedCategoryId` is on the DB row, it's already returned.

**Step 3: Add badge**

In the transaction row component, where category is displayed:

```tsx
{transaction.suggestedCategoryId && !transaction.categoryId && (
  <Tooltip>
    <TooltipTrigger>
      <Badge variant="outline" className="text-xs">sugestão IA</Badge>
    </TooltipTrigger>
    <TooltipContent>
      Categoria sugerida pela IA. Clique para revisar.
    </TooltipContent>
  </Tooltip>
)}
```

Import `Badge` from `@packages/ui/components/badge`, `Tooltip`/`TooltipTrigger`/`TooltipContent` from `@packages/ui/components/tooltip`.

**Step 4: Commit**

```bash
git add <modified UI files>
git commit -m "feat(ui): add sugestão IA badge to transactions"
```

---

### Task 7: Manual review action for suggested category

**Goal:** When user clicks the "sugestão IA" badge, show them the suggested category name and let them accept or dismiss it.

**Files:**
- Modify: transaction row or a colocated action component
- Modify: `apps/web/src/integrations/orpc/router/transactions.ts` — add `acceptSuggestedCategory` procedure

**Step 1: Add `acceptSuggestedCategory` procedure**

```typescript
export const acceptSuggestedCategory = protectedProcedure
  .input(z.object({ id: z.string().uuid() }))
  .handler(async ({ context, input }) => {
    const tx = await getTransactionById(context.db, input.id);
    if (!tx) throw WebAppError.notFound("Transaction not found");
    if (tx.teamId !== context.teamId) throw WebAppError.forbidden();
    if (!tx.suggestedCategoryId) throw WebAppError.badRequest("No suggestion");

    await updateTransactionCategory(context.db, input.id, {
      categoryId: tx.suggestedCategoryId,
      suggestedCategoryId: null,
    });

    return { ok: true };
  });
```

Add `dismissSuggestedCategory` the same way but sets `suggestedCategoryId: null` without setting `categoryId`.

**Step 2: Wire into router export**

Make sure both procedures are exported in the transactions router object.

**Step 3: Add UI actions**

In the tooltip or a popover triggered by the badge, add two buttons:
- "Aceitar" → calls `acceptSuggestedCategory` mutation
- "Ignorar" → calls `dismissSuggestedCategory` mutation

Both invalidate the transactions query on success (handled by global `MutationCache` automatically).

**Step 4: Commit**

```bash
git add <all changed files>
git commit -m "feat: accept/dismiss suggested category for transactions"
```

---

## Notes

- `agentSettings.dataSourceTransactions` toggle: if this setting exists on the team, check it in the `enqueueCategorization` helper before calling `DBOS.startWorkflow`. Skip if disabled.
- Keyword match is free (no AI cost). AI only fires when no keyword matches.
- The workflow is idempotent-safe — DBOS deduplicates on `workflowID`. Add `{ workflowID: \`categorize-${transactionId}\` }` to `DBOS.startWorkflow` options to prevent double-runs on retries.
- `importBulk` and `importStatement` procedures also create transactions — wire `enqueueCategorization` there too after Task 5 is verified working.
