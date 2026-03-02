# Finance Master Plan — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement 18 finance features across schema migrations, backend enrichment, filter improvements, form fixes, UX additions, and new financial concepts.

**Architecture:** Changes flow from schema → repository → oRPC router → UI. Schema changes must be followed immediately by `bun run db:push` before any router/UI work in that task.

**Tech Stack:** Drizzle ORM (PostgreSQL), oRPC (`@orpc/server`), TanStack Query + Form, React/Vite, Radix + Tailwind, `@packages/ui` components.

---

## Dependency Order

```
Tasks 1-2  → Schema migrations (must run db:push after each)
Tasks 3-4  → Repository changes (depend on schema)
Tasks 5-7  → Router enrichment (depend on repositories)
Tasks 8-10 → Transaction table UI (depend on enriched router)
Tasks 11-13→ Form improvements (independent of each other)
Tasks 14-15→ Sidebar additions (independent)
Tasks 16-17→ Goals + bank account summaries (depend on router)
Tasks 18-19→ Auto-bill on unpaid/future transactions (new business logic)
Task 20    → Projected balance (depends on bills + bank accounts)
```

---

## Task 1: Schema — Add `isArchived` to categories and tags

**Files:**
- Modify: `packages/database/src/schemas/categories.ts`
- Modify: `packages/database/src/schemas/tags.ts`
- Run: `bun run db:push`

**Step 1: Add `isArchived` boolean to categories schema**

In `packages/database/src/schemas/categories.ts`, add inside the table definition after `icon`:
```typescript
isArchived: boolean("is_archived").notNull().default(false),
```

Import `boolean` from `drizzle-orm/pg-core`.

**Step 2: Add `isArchived` boolean to tags schema**

In `packages/database/src/schemas/tags.ts`, add inside the table definition after `color`:
```typescript
isArchived: boolean("is_archived").notNull().default(false),
```

Import `boolean` from `drizzle-orm/pg-core`.

**Step 3: Push schema**
```bash
bun run db:push
```
Expected: Drizzle adds two nullable/default columns with no breaking changes.

**Step 4: Commit**
```bash
git add packages/database/src/schemas/categories.ts packages/database/src/schemas/tags.ts
git commit -m "feat(schema): add isArchived to categories and tags"
```

---

## Task 2: Schema — Add `bankAccountId` to credit cards

**Files:**
- Modify: `packages/database/src/schemas/credit-cards.ts`
- Run: `bun run db:push`

**Step 1: Add nullable `bankAccountId` foreign key**

In `packages/database/src/schemas/credit-cards.ts`, add import:
```typescript
import { bankAccounts } from "./bank-accounts";
```

Add field inside `creditCards` table (after `dueDay`):
```typescript
bankAccountId: uuid("bank_account_id").references(() => bankAccounts.id, {
   onDelete: "set null",
}),
```

Also add a new index:
```typescript
index("credit_cards_bank_account_id_idx").on(table.bankAccountId),
```

**Step 2: Push schema**
```bash
bun run db:push
```

**Step 3: Commit**
```bash
git add packages/database/src/schemas/credit-cards.ts
git commit -m "feat(schema): add bankAccountId FK to credit_cards"
```

---

## Task 3: Repository — Tags deletion protection + archive

**Files:**
- Modify: `packages/database/src/repositories/tags-repository.ts`

**Step 1: Add `tagHasTransactions` function**

In `packages/database/src/repositories/tags-repository.ts`:

Add import:
```typescript
import { eq, sql } from "drizzle-orm";
import { transactionTags } from "../schema";
```

Add function after `deleteTag`:
```typescript
export async function tagHasTransactions(
   db: DatabaseInstance,
   tagId: string,
): Promise<boolean> {
   try {
      const [row] = await db
         .select({ count: sql<number>`count(*)::int` })
         .from(transactionTags)
         .where(eq(transactionTags.tagId, tagId));
      return (row?.count ?? 0) > 0;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to check tag transactions");
   }
}
```

**Step 2: Update `listTags` to filter out archived by default**

Modify the `listTags` function to accept an options param:
```typescript
export async function listTags(
   db: DatabaseInstance,
   teamId: string,
   opts?: { includeArchived?: boolean },
) {
   try {
      const conditions = [eq(tags.teamId, teamId)];
      if (!opts?.includeArchived) {
         conditions.push(eq(tags.isArchived, false));
      }
      return await db
         .select()
         .from(tags)
         .where(and(...conditions))
         .orderBy(tags.name);
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to list tags");
   }
}
```

Import `and` from `drizzle-orm`.

**Step 3: Update tags oRPC router**

In `apps/web/src/integrations/orpc/router/tags.ts`:

1. Add `tagHasTransactions` to imports from tags-repository.
2. In `remove` handler, add check before `deleteTag`:
```typescript
const hasTransactions = await tagHasTransactions(db, input.id);
if (hasTransactions) {
   throw new ORPCError("BAD_REQUEST", {
      message: "Não é possível excluir uma tag com transações vinculadas.",
   });
}
```

3. Add new `archive` procedure:
```typescript
export const archive = protectedProcedure
   .input(z.object({ id: z.string().uuid() }))
   .handler(async ({ context, input }) => {
      const { db, teamId } = context;
      const tag = await getTag(db, input.id);
      if (!tag || tag.teamId !== teamId) {
         throw new ORPCError("NOT_FOUND", { message: "Tag não encontrada." });
      }
      return updateTag(db, input.id, { isArchived: true });
   });
```

4. Register `archive` in `apps/web/src/integrations/orpc/router/index.ts` — it is auto-exported since the router uses `* as tagsRouter`.

**Step 4: Commit**
```bash
git add packages/database/src/repositories/tags-repository.ts apps/web/src/integrations/orpc/router/tags.ts
git commit -m "feat(tags): add deletion protection and archive procedure"
```

---

## Task 4: Repository + Router — Categories archive + filter archived

**Files:**
- Modify: `packages/database/src/repositories/categories-repository.ts`
- Modify: `apps/web/src/integrations/orpc/router/categories.ts`

**Step 1: Update `listCategories` to filter out archived**

In `categories-repository.ts`, modify `listCategories`:
```typescript
export async function listCategories(
   db: DatabaseInstance,
   teamId: string,
   opts?: { includeArchived?: boolean },
) {
   try {
      const catConditions: SQL[] = [eq(categories.teamId, teamId)];
      if (!opts?.includeArchived) {
         catConditions.push(eq(categories.isArchived, false));
      }

      const cats = await db
         .select()
         .from(categories)
         .where(and(...catConditions))
         .orderBy(categories.name);

      const subs = await db
         .select()
         .from(subcategories)
         .where(eq(subcategories.teamId, teamId))
         .orderBy(subcategories.name);

      return cats.map((cat) => ({
         ...cat,
         subcategories: subs.filter((s) => s.categoryId === cat.id),
      }));
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to list categories");
   }
}
```

Import `and`, `SQL` from `drizzle-orm`.

**Step 2: Add `archive` procedure to categories router**

In `apps/web/src/integrations/orpc/router/categories.ts`, add:
```typescript
export const archive = protectedProcedure
   .input(z.object({ id: z.string().uuid() }))
   .handler(async ({ context, input }) => {
      const { db, teamId } = context;
      const category = await getCategory(db, input.id);
      if (!category || category.teamId !== teamId) {
         throw new ORPCError("NOT_FOUND", {
            message: "Categoria não encontrada.",
         });
      }
      if (category.isDefault) {
         throw new ORPCError("BAD_REQUEST", {
            message: "Categorias padrão não podem ser arquivadas.",
         });
      }
      return updateCategory(db, input.id, { isArchived: true });
   });
```

Add `updateCategory` import if not already there.

**Step 3: Add archive action to categories columns UI**

In `apps/web/src/features/categories/ui/categories-columns.tsx`, add an "Arquivar" menu item in the row actions dropdown. When the category has transactions (server will return error if trying to delete), show "Arquivar" instead of delete. The user can click "Arquivar" to call `orpc.categories.archive.mutationOptions(...)`.

**Step 4: Add archive action to tags columns UI**

Same pattern in `apps/web/src/features/tags/ui/tags-columns.tsx`.

**Step 5: Commit**
```bash
git add packages/database/src/repositories/categories-repository.ts apps/web/src/integrations/orpc/router/categories.ts apps/web/src/features/categories/ui/categories-columns.tsx apps/web/src/features/tags/ui/tags-columns.tsx
git commit -m "feat(categories,tags): add archive procedure and filter archived from list"
```

---

## Task 5: Repository + Router — Bank account current balance

**Files:**
- Modify: `packages/database/src/repositories/bank-accounts-repository.ts`
- Modify: `apps/web/src/integrations/orpc/router/bank-accounts.ts`
- Modify: `apps/web/src/features/bank-accounts/ui/bank-accounts-columns.tsx`

**Step 1: Add balance computation to `listBankAccounts`**

In `bank-accounts-repository.ts`, update the list function to join transaction sums:

```typescript
import { and, eq, sql, sum } from "drizzle-orm";
import { transactions } from "../schema";

export async function listBankAccountsWithBalance(db: DatabaseInstance, teamId: string) {
   try {
      const accounts = await db
         .select()
         .from(bankAccounts)
         .where(eq(bankAccounts.teamId, teamId))
         .orderBy(bankAccounts.name);

      // For each account, compute income - expense from transactions
      const results = await Promise.all(
         accounts.map(async (account) => {
            const [row] = await db
               .select({
                  income: sql<string>`COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0)`,
                  expense: sql<string>`COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0)`,
               })
               .from(transactions)
               .where(eq(transactions.bankAccountId, account.id));

            const currentBalance =
               Number(account.initialBalance) +
               Number(row?.income ?? 0) -
               Number(row?.expense ?? 0);

            return { ...account, currentBalance: currentBalance.toFixed(2) };
         }),
      );

      return results;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to list bank accounts");
   }
}
```

**Step 2: Update bank accounts router to use new function**

In the bank-accounts router `getAll` handler, replace `listBankAccounts` with `listBankAccountsWithBalance`.

**Step 3: Update `BankAccountRow` type and columns**

In `bank-accounts-columns.tsx`:
1. Add `currentBalance: string` to `BankAccountRow` type.
2. Add a new column "Saldo Atual":
```typescript
{
   accessorKey: "currentBalance",
   header: "Saldo Atual",
   cell: ({ row }) => {
      const balance = Number(row.original.currentBalance);
      return (
         <span className={`text-sm font-medium ${balance >= 0 ? "text-green-600 dark:text-green-500" : "text-destructive"}`}>
            {formatBRL(row.original.currentBalance)}
         </span>
      );
   },
},
```

Place this column after "Saldo Inicial".

**Step 4: Commit**
```bash
git add packages/database/src/repositories/bank-accounts-repository.ts apps/web/src/integrations/orpc/router/bank-accounts.ts apps/web/src/features/bank-accounts/ui/bank-accounts-columns.tsx
git commit -m "feat(bank-accounts): add computed current balance to table"
```

---

## Task 6: Router + Repository — Enrich transactions with category/card names + new filters

**Files:**
- Modify: `packages/database/src/repositories/transactions-repository.ts`
- Modify: `apps/web/src/integrations/orpc/router/transactions.ts`

**Step 1: Update `listTransactions` to join category and credit card names**

In `transactions-repository.ts`, update `ListTransactionsFilter`:
```typescript
export interface ListTransactionsFilter {
   teamId: string;
   type?: "income" | "expense" | "transfer";
   bankAccountId?: string;
   categoryId?: string;
   uncategorized?: boolean;   // NEW: filter transactions with no category
   creditCardId?: string;     // NEW
   tagId?: string;
   contactId?: string;
   dateFrom?: string;
   dateTo?: string;
   search?: string;
   page?: number;
   pageSize?: number;
}
```

Update `listTransactions` to do a left join with `categories` and `creditCards`:
```typescript
import { categories } from "../schemas/categories";
import { creditCards } from "../schemas/credit-cards";
import { isNull } from "drizzle-orm";

// In listTransactions, change the select to include joined names:
const data = await db
   .select({
      ...getTableColumns(transactions),
      categoryName: categories.name,
      creditCardName: creditCards.name,
   })
   .from(transactions)
   .leftJoin(categories, eq(transactions.categoryId, categories.id))
   .leftJoin(creditCards, eq(transactions.creditCardId, creditCards.id))
   .where(whereClause)
   .orderBy(desc(transactions.date))
   .limit(pageSize)
   .offset((page - 1) * pageSize);
```

Import `getTableColumns` from `drizzle-orm`.

Add new filter conditions:
```typescript
if (filter.creditCardId)
   conditions.push(eq(transactions.creditCardId, filter.creditCardId));
if (filter.uncategorized)
   conditions.push(isNull(transactions.categoryId));
```

Note: The count query also needs to include the left joins for accurate results.

**Step 2: Expose new filters in transactions router**

In `apps/web/src/integrations/orpc/router/transactions.ts`, update `getAll` input schema:
```typescript
creditCardId: z.string().uuid().optional(),
uncategorized: z.boolean().optional(),
```

Pass them through to `listTransactions`.

Also update `transactionSchema` to include `creditCardId` for create/update (it already exists in the Drizzle schema but was not picked):
```typescript
const transactionSchema = createInsertSchema(transactions)
   .pick({
      type: true,
      amount: true,
      description: true,
      date: true,
      bankAccountId: true,
      destinationBankAccountId: true,
      categoryId: true,
      subcategoryId: true,
      attachmentUrl: true,
      contactId: true,
      creditCardId: true,  // ADD THIS
   })
   // ...
```

**Step 3: Commit**
```bash
git add packages/database/src/repositories/transactions-repository.ts apps/web/src/integrations/orpc/router/transactions.ts
git commit -m "feat(transactions): join category/card names, add uncategorized and creditCardId filters"
```

---

## Task 7: Fix credit card form — limit editable on edit + bankAccountId field

**Files:**
- Modify: `apps/web/src/features/credit-cards/ui/credit-cards-form.tsx`
- Modify: `apps/web/src/integrations/orpc/router/credit-cards.ts`

**Step 1: Fix credit card limit visibility on edit**

In `credit-cards-form.tsx`, find the `{isCreate && (` guard around `creditLimit` field (line 225) and remove the conditional so it always renders:

Change:
```tsx
{isCreate && (
   <form.Field name="creditLimit">
```
To:
```tsx
<form.Field name="creditLimit">
```

Remove the closing `)}` after that field block.

**Step 2: Add `creditLimit` to update mutation payload**

In `credit-cards-form.tsx`, inside `onSubmit`, the `else if (card)` branch currently doesn't send `creditLimit`. Add it:
```typescript
updateMutation.mutate({
   id: card.id,
   name: value.name.trim(),
   color: value.color,
   creditLimit: value.creditLimit,   // ADD
   closingDay: value.closingDay,
   dueDay: value.dueDay,
});
```

**Step 3: Ensure credit-cards router `update` accepts `creditLimit`**

In `apps/web/src/integrations/orpc/router/credit-cards.ts`, check the update input schema includes `creditLimit`. If not, add it to the partial schema.

**Step 4: Add `bankAccountId` combobox field to credit card form**

In `credit-cards-form.tsx`:
1. Add `useSuspenseQuery` for bank accounts:
```typescript
const { data: bankAccounts } = useSuspenseQuery(
   orpc.bankAccounts.getAll.queryOptions({}),
);
```
2. Add `bankAccountId` to form `defaultValues`:
```typescript
bankAccountId: card?.bankAccountId ?? "",
```
3. Add `bankAccountId` combobox field after `dueDay`:
```tsx
<form.Field name="bankAccountId">
   {(field) => (
      <Field>
         <FieldLabel>Conta Bancária Vinculada</FieldLabel>
         <Combobox
            className="w-full"
            emptyMessage="Nenhuma conta encontrada."
            onValueChange={(v) => field.handleChange(v || "")}
            options={bankAccounts.map((a) => ({ value: a.id, label: a.name }))}
            placeholder="Selecionar conta (opcional)..."
            searchPlaceholder="Buscar conta..."
            value={field.state.value}
         />
      </Field>
   )}
</form.Field>
```
4. Send `bankAccountId` in both create and update payloads.

**Step 5: Wrap in Suspense since bankAccounts uses useSuspenseQuery**

Wrap `CreditCardForm` body in `<Suspense fallback={<Spinner />}>` or lift the bankAccounts query into a child component.

**Step 6: Commit**
```bash
git add apps/web/src/features/credit-cards/ui/credit-cards-form.tsx apps/web/src/integrations/orpc/router/credit-cards.ts
git commit -m "fix(credit-cards): allow limit edit on update, add bankAccountId field"
```

---

## Task 8: Transaction table — category + credit card columns

**Files:**
- Modify: `apps/web/src/features/transactions/ui/transactions-columns.tsx`

**Step 1: Extend `TransactionRow` type**

Add new fields to the type:
```typescript
export type TransactionRow = {
   // ... existing fields ...
   creditCardId: string | null;
   categoryName?: string | null;
   creditCardName?: string | null;
};
```

**Step 2: Add category column**

Add after the "Tipo" column:
```typescript
{
   accessorKey: "categoryName",
   header: "Categoria",
   cell: ({ row }) => {
      const name = row.original.categoryName;
      if (!name) return <span className="text-xs text-muted-foreground">—</span>;
      return <span className="text-sm">{name}</span>;
   },
},
```

**Step 3: Add credit card column**

Add after "Categoria":
```typescript
{
   accessorKey: "creditCardName",
   header: "Cartão",
   cell: ({ row }) => {
      const name = row.original.creditCardName;
      if (!name) return <span className="text-xs text-muted-foreground">—</span>;
      return <span className="text-sm">{name}</span>;
   },
},
```

**Step 4: Commit**
```bash
git add apps/web/src/features/transactions/ui/transactions-columns.tsx
git commit -m "feat(transactions): add category and credit card columns to table"
```

---

## Task 9: Transaction filter bar — category, account, card filters

**Files:**
- Modify: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/finance/transactions.tsx`

**Step 1: Extend `TransactionFilters` interface**

```typescript
interface TransactionFilters {
   type?: TransactionType;
   dateFrom?: string;
   dateTo?: string;
   datePreset?: string;
   search: string;
   categoryId?: string;
   uncategorized?: boolean;
   bankAccountId?: string;
   creditCardId?: string;
   page: number;
   pageSize: number;
}
```

**Step 2: Add filter state to `FilterBar` props**

`FilterBar` already receives `filters` and `onFiltersChange`. Just add the new filter UI inside `FilterBar`.

**Step 3: Add category Combobox with "Não categorizado" option**

Inside `FilterBar`, after the type ToggleGroup:
```tsx
<Suspense fallback={null}>
   <CategoryFilter
      value={filters.categoryId}
      uncategorized={filters.uncategorized}
      onChange={(categoryId, uncategorized) =>
         onFiltersChange({ ...filters, categoryId, uncategorized, page: 1 })
      }
   />
</Suspense>
```

Create `CategoryFilter` as a local component:
```tsx
function CategoryFilter({ value, uncategorized, onChange }) {
   const { data: categories } = useSuspenseQuery(
      orpc.categories.getAll.queryOptions({}),
   );

   const options = [
      { value: "__uncategorized__", label: "Sem categoria" },
      ...categories.map((c) => ({ value: c.id, label: c.name })),
   ];

   const currentValue = uncategorized ? "__uncategorized__" : (value ?? "");

   return (
      <Combobox
         className="h-8 w-[180px]"
         emptyMessage="Nenhuma categoria."
         onValueChange={(v) => {
            if (v === "__uncategorized__") onChange(undefined, true);
            else onChange(v || undefined, false);
         }}
         options={options}
         placeholder="Categoria"
         searchPlaceholder="Buscar..."
         value={currentValue}
      />
   );
}
```

**Step 4: Add bank account Combobox filter**

Similar pattern using `orpc.bankAccounts.getAll`:
```tsx
<Suspense fallback={null}>
   <AccountFilter
      value={filters.bankAccountId}
      onChange={(v) => onFiltersChange({ ...filters, bankAccountId: v || undefined, page: 1 })}
   />
</Suspense>
```

**Step 5: Add credit card Combobox filter**

Similar pattern using `orpc.creditCards.getAll`.

**Step 6: Pass new filters through to `TransactionsList` → `useSuspenseQuery`**

In `TransactionsList`, add to the `orpc.transactions.getAll.queryOptions` input:
```typescript
input: {
   // ... existing ...
   categoryId: filters.categoryId,
   uncategorized: filters.uncategorized,
   bankAccountId: filters.bankAccountId,
   creditCardId: filters.creditCardId,
},
```

**Step 7: Update `hasActiveFilters` check**

```typescript
const hasActiveFilters =
   filters.type || hasDateFilter || filters.search.length > 0
   || filters.categoryId || filters.uncategorized
   || filters.bankAccountId || filters.creditCardId;
```

**Step 8: Clear new filters in "Limpar" button**

The `DEFAULT_FILTERS` reset will handle it automatically if the new fields default to `undefined`.

**Step 9: Commit**
```bash
git add apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/finance/transactions.tsx
git commit -m "feat(transactions): add category, account, credit card filter comboboxes"
```

---

## Task 10: Transaction form — add credit card field + replace tag checkboxes with combobox

**Files:**
- Modify: `apps/web/src/features/transactions/ui/transactions-sheet.tsx`

**Step 1: Add `creditCardId` to form defaultValues**

```typescript
creditCardId: transaction?.creditCardId ?? "",
```

**Step 2: Fetch credit cards**

Add inside `TransactionFormContent`:
```typescript
const { data: creditCards } = useSuspenseQuery(
   orpc.creditCards.getAll.queryOptions({}),
);
```

**Step 3: Add credit card combobox field**

Add after the bank account field, visible only when type is "expense":
```tsx
<form.Subscribe selector={(s) => s.values.type}>
   {(type) =>
      type === "expense" ? (
         <form.Field name="creditCardId">
            {(field) => (
               <Field>
                  <FieldLabel>Cartão de Crédito</FieldLabel>
                  <Combobox
                     className="w-full"
                     emptyMessage="Nenhum cartão cadastrado."
                     onValueChange={(v) => field.handleChange(v || "")}
                     options={creditCards.map((c) => ({
                        value: c.id,
                        label: c.name,
                     }))}
                     placeholder="Selecionar cartão (opcional)..."
                     searchPlaceholder="Buscar cartão..."
                     value={field.state.value}
                  />
               </Field>
            )}
         </form.Field>
      ) : null
   }
</form.Subscribe>
```

**Step 4: Add `creditCardId` to the form payload**

In `onSubmit`:
```typescript
creditCardId: value.type === "expense" ? (value.creditCardId || null) : null,
```

**Step 5: Replace `TagCheckboxList` with multi-select Combobox**

Remove the `TagCheckboxList` component entirely. Replace the `tagIds` field with:
```tsx
<form.Field name="tagIds">
   {(field) => (
      <Field>
         <FieldLabel>Tags</FieldLabel>
         <Suspense fallback={<Skeleton className="h-9 w-full" />}>
            <TagCombobox
               selectedIds={field.state.value}
               onChange={field.handleChange}
            />
         </Suspense>
      </Field>
   )}
</form.Field>
```

Create `TagCombobox` local component:
```tsx
function TagCombobox({
   selectedIds,
   onChange,
}: {
   selectedIds: string[];
   onChange: (ids: string[]) => void;
}) {
   const { data: tags } = useSuspenseQuery(orpc.tags.getAll.queryOptions({}));

   if (tags.length === 0) {
      return (
         <p className="text-sm text-muted-foreground">Nenhuma tag cadastrada.</p>
      );
   }

   const options = tags.map((t) => ({ value: t.id, label: t.name }));

   return (
      <Combobox
         className="w-full"
         emptyMessage="Nenhuma tag encontrada."
         multiSelect
         onValueChange={(v) => {
            if (Array.isArray(v)) onChange(v);
            else onChange(v ? [v] : []);
         }}
         options={options}
         placeholder="Selecionar tags..."
         searchPlaceholder="Buscar tag..."
         value={selectedIds}
      />
   );
}
```

Check `@packages/ui/components/combobox` API for multi-select — if not supported, implement as a popover with checkboxes inside a Combobox-style trigger.

**Step 6: Commit**
```bash
git add apps/web/src/features/transactions/ui/transactions-sheet.tsx
git commit -m "feat(transactions): add credit card field, replace tag checkboxes with combobox"
```

---

## Task 11: Categories form — icon picker as searchable combobox

**Files:**
- Modify: `apps/web/src/features/categories/ui/categories-form.tsx`

**Step 1: Replace icon grid with searchable combobox**

The current UI is a `grid grid-cols-10` of icon buttons. Replace with a `Combobox` that shows icons with their name label.

Create options array:
```typescript
const ICON_OPTIONS: ComboboxOption[] = CATEGORY_ICONS.map(({ name, Icon }) => ({
   value: name,
   label: name
      .split("-")
      .map((w) => w[0]?.toUpperCase() + w.slice(1))
      .join(" "),
}));
```

Replace the icon `form.Field` render with:
```tsx
<form.Field name="icon">
   {(field) => (
      <Field>
         <FieldLabel>Ícone</FieldLabel>
         <Combobox
            className="w-full"
            emptyMessage="Ícone não encontrado."
            onValueChange={(v) => field.handleChange(v || "")}
            options={ICON_OPTIONS}
            placeholder="Selecionar ícone..."
            searchPlaceholder="Buscar ícone..."
            value={field.state.value}
         />
         {field.state.value && (() => {
            const found = CATEGORY_ICONS.find((i) => i.name === field.state.value);
            if (!found) return null;
            const { Icon } = found;
            return (
               <div className="flex items-center gap-2 mt-1">
                  <Icon className="size-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">{field.state.value}</span>
               </div>
            );
         })()}
      </Field>
   )}
</form.Field>
```

**Step 2: Commit**
```bash
git add apps/web/src/features/categories/ui/categories-form.tsx
git commit -m "feat(categories): replace icon grid with searchable combobox"
```

---

## Task 12: Budget goals — totalizadores summary bar

**Files:**
- Modify: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/finance/goals.tsx` (or wherever budget goals page lives)

**Step 1: Find the budget goals page**
```bash
# Find the goals route file
ls apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/finance/
```

**Step 2: Add summary totals component**

At the top of the goals page (before the grid of `BudgetGoalCard`), add:
```tsx
function GoalsSummary({ goals }: { goals: BudgetGoalWithProgress[] }) {
   const totalLimit = goals.reduce((sum, g) => sum + Number(g.limitAmount), 0);
   const totalSpent = goals.reduce((sum, g) => sum + g.spentAmount, 0);
   const totalRemaining = totalLimit - totalSpent;
   const atAlertCount = goals.filter(
      (g) => g.alertThreshold && g.percentUsed >= g.alertThreshold,
   ).length;
   const overBudgetCount = goals.filter((g) => g.percentUsed >= 100).length;

   const fmt = (v: number) =>
      new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

   return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
         <div className="rounded-lg border bg-card p-4 space-y-1">
            <p className="text-xs text-muted-foreground">Total orçado</p>
            <p className="text-lg font-semibold">{fmt(totalLimit)}</p>
         </div>
         <div className="rounded-lg border bg-card p-4 space-y-1">
            <p className="text-xs text-muted-foreground">Total gasto</p>
            <p className="text-lg font-semibold text-destructive">{fmt(totalSpent)}</p>
         </div>
         <div className="rounded-lg border bg-card p-4 space-y-1">
            <p className="text-xs text-muted-foreground">Disponível</p>
            <p className={`text-lg font-semibold ${totalRemaining >= 0 ? "text-emerald-600 dark:text-emerald-500" : "text-destructive"}`}>
               {fmt(totalRemaining)}
            </p>
         </div>
         <div className="rounded-lg border bg-card p-4 space-y-1">
            <p className="text-xs text-muted-foreground">Em alerta</p>
            <p className="text-lg font-semibold text-amber-500">
               {atAlertCount} meta{atAlertCount !== 1 ? "s" : ""}
               {overBudgetCount > 0 && (
                  <span className="text-destructive ml-1">({overBudgetCount} excedida{overBudgetCount !== 1 ? "s" : ""})</span>
               )}
            </p>
         </div>
      </div>
   );
}
```

Render `<GoalsSummary goals={goals} />` above the goals grid.

**Step 3: Commit**
```bash
git commit -m "feat(goals): add summary totals bar with limit, spent, remaining, alert count"
```

---

## Task 13: Sidebar — quick-action for new transaction

**Files:**
- Modify: `apps/web/src/layout/dashboard/ui/sidebar-nav-items.ts`
- Modify: `apps/web/src/layout/dashboard/ui/sidebar-item-actions.tsx`

**Step 1: Add `quickAction` to transactions nav item**

In `sidebar-nav-items.ts`, update the transactions item:
```typescript
{
   id: "transactions",
   label: "Transações",
   icon: ArrowLeftRight,
   route: "/$slug/$teamSlug/finance/transactions",
   quickAction: { type: "create", target: "sheet" },
},
```

**Step 2: Implement "sheet" target in `QuickCreateButton`**

The `QuickCreateButton` in `sidebar-item-actions.tsx` currently only handles `navigate` and `sub-menu` targets. Add `sheet` support.

Since the sidebar component can't import feature-specific components (would create circular deps), we need an event-based approach. Use a `CustomEvent`:

In `QuickCreateButton`, for `target === "sheet"`:
```typescript
if (item.quickAction.target === "sheet") {
   const handleCreate = () => {
      window.dispatchEvent(
         new CustomEvent("sidebar:quick-create", { detail: { itemId: item.id } }),
      );
   };

   return (
      <SidebarMenuAction onClick={handleCreate} title="Criar novo">
         <Plus className="size-4" />
      </SidebarMenuAction>
   );
}
```

In `TransactionsPage` (transactions route), add a listener:
```typescript
useEffect(() => {
   const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail.itemId === "transactions") {
         handleCreate();
      }
   };
   window.addEventListener("sidebar:quick-create", handler);
   return () => window.removeEventListener("sidebar:quick-create", handler);
}, [handleCreate]);
```

**Step 3: Commit**
```bash
git add apps/web/src/layout/dashboard/ui/sidebar-nav-items.ts apps/web/src/layout/dashboard/ui/sidebar-item-actions.tsx apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/finance/transactions.tsx
git commit -m "feat(sidebar): add quick-create action for new transaction"
```

---

## Task 14: Sidebar — configure visible items

**Files:**
- Create: `apps/web/src/layout/dashboard/hooks/use-sidebar-visibility.ts`
- Modify: `apps/web/src/layout/dashboard/ui/sidebar-nav.tsx`
- Modify: `apps/web/src/layout/dashboard/ui/sidebar-nav-items.ts`

**Step 1: Create visibility hook**

```typescript
// apps/web/src/layout/dashboard/hooks/use-sidebar-visibility.ts
import { useSafeLocalStorage } from "@/hooks/use-local-storage";

export function useSidebarVisibility() {
   const [hiddenItems, setHiddenItems] = useSafeLocalStorage<string[]>(
      "sidebar:hidden-items",
      [],
   );

   const isVisible = (itemId: string) => !hiddenItems.includes(itemId);

   const toggleItem = (itemId: string) => {
      setHiddenItems((prev) =>
         prev.includes(itemId)
            ? prev.filter((id) => id !== itemId)
            : [...prev, itemId],
      );
   };

   return { hiddenItems, isVisible, toggleItem };
}
```

**Step 2: Add `configurable` flag to NavItemDef**

In `sidebar-nav-items.ts`:
```typescript
export type NavItemDef = {
   // ... existing ...
   /** Whether the item can be hidden by the user */
   configurable?: boolean;
};
```

Mark all finance items as `configurable: true`.

**Step 3: Add configuration gear to sidebar footer**

In the sidebar layout (find `sidebar-footer` or similar component), add a settings button that opens a credenza with checkboxes for each `configurable` nav item.

Use `useCredenza()` to open a settings panel:
```tsx
function SidebarVisibilitySettings() {
   const { openCredenza, closeCredenza } = useCredenza();
   const { hiddenItems, toggleItem } = useSidebarVisibility();
   const configurableItems = navGroups
      .flatMap((g) => g.items)
      .filter((item) => item.configurable);

   const handleOpen = () => {
      openCredenza({
         children: (
            <SidebarVisibilityForm
               items={configurableItems}
               hiddenItems={hiddenItems}
               onToggle={toggleItem}
               onClose={closeCredenza}
            />
         ),
      });
   };

   return (
      <Button onClick={handleOpen} size="icon" variant="ghost">
         <Settings className="size-4" />
      </Button>
   );
}
```

**Step 4: Filter items in `NavGroup` using visibility hook**

In `SidebarNav` and `SidebarDefaultItems`, apply `isVisible(item.id)` in addition to the existing early access filter.

**Step 5: Commit**
```bash
git commit -m "feat(sidebar): add configurable item visibility with localStorage persistence"
```

---

## Task 15: Auto-create bill from unpaid/future transaction

**Files:**
- Modify: `apps/web/src/features/transactions/ui/transactions-sheet.tsx`
- Modify: `apps/web/src/integrations/orpc/router/transactions.ts`

**Step 1: Add "Registrar como conta a pagar" checkbox to transaction form**

In `transactions-sheet.tsx`, add to `defaultValues`:
```typescript
createAsBill: false as boolean,
```

Add a checkbox field in the form (visible only for expense type, near the bottom):
```tsx
<form.Subscribe selector={(s) => s.values.type}>
   {(type) =>
      type === "expense" ? (
         <form.Field name="createAsBill">
            {(field) => (
               <Field>
                  <div className="flex items-center gap-2">
                     <Checkbox
                        checked={field.state.value}
                        id="createAsBill"
                        onCheckedChange={(v) => field.handleChange(!!v)}
                     />
                     {/* biome-ignore lint/a11y/noLabelWithoutControl: Checkbox is Radix */}
                     <label
                        className="text-sm cursor-pointer select-none"
                        htmlFor="createAsBill"
                     >
                        Registrar como conta a pagar (não pago ainda)
                     </label>
                  </div>
               </Field>
            )}
         </form.Field>
      ) : null
   }
</form.Subscribe>
```

**Step 2: Branch in `onSubmit` — if createAsBill, call bills.create instead**

```typescript
onSubmit: ({ value }) => {
   const dateStr = value.date ? value.date.toISOString().split("T")[0] : "";

   if (value.createAsBill && value.type === "expense") {
      // Create as a bill (payable) instead of a transaction
      billCreateMutation.mutate({
         bill: {
            name: value.name?.trim() || "Despesa",
            type: "payable",
            amount: value.amount,
            dueDate: dateStr,
            bankAccountId: value.bankAccountId || null,
            categoryId: value.categoryId || null,
            description: value.description || null,
         },
      });
      return;
   }

   // Normal transaction creation
   // ... existing logic ...
},
```

Add `billCreateMutation`:
```typescript
const billCreateMutation = useMutation(
   orpc.bills.create.mutationOptions({
      onSuccess: () => {
         toast.success("Conta a pagar criada com sucesso.");
         onSuccess();
      },
      onError: (error) => {
         toast.error(error.message || "Erro ao criar conta a pagar.");
      },
   }),
);
```

**Step 3: Auto-suggest bill for future-dated transactions**

Add a derived state in the form to detect if the selected date is in the future:
```tsx
<form.Subscribe selector={(s) => s.values.date}>
   {(date) => {
      const isFuture = date && date > new Date();
      return isFuture ? (
         <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 text-sm text-amber-700 dark:text-amber-300">
            Esta transação é no futuro. Considere registrá-la como conta a pagar.
         </div>
      ) : null;
   }}
</form.Subscribe>
```

**Step 4: Commit**
```bash
git add apps/web/src/features/transactions/ui/transactions-sheet.tsx
git commit -m "feat(transactions): add 'create as bill' option for unpaid expenses and future transactions"
```

---

## Task 16: Projected balance concept

**Files:**
- Modify: `apps/web/src/integrations/orpc/router/bank-accounts.ts`
- Modify: `packages/database/src/repositories/bank-accounts-repository.ts`
- Modify: `apps/web/src/features/bank-accounts/ui/bank-accounts-columns.tsx`

**Step 1: Add projected balance to bank accounts repository**

In `bank-accounts-repository.ts`, update `listBankAccountsWithBalance` to also compute projected balance:

```typescript
import { bills } from "../schemas/bills";

// For each account, also sum pending bills
const [billsRow] = await db
   .select({
      pendingReceivable: sql<string>`COALESCE(SUM(CASE WHEN type = 'receivable' AND status = 'pending' THEN amount ELSE 0 END), 0)`,
      pendingPayable: sql<string>`COALESCE(SUM(CASE WHEN type = 'payable' AND status = 'pending' THEN amount ELSE 0 END), 0)`,
   })
   .from(bills)
   .where(
      and(
         eq(bills.bankAccountId, account.id),
         // status IN ('pending', 'overdue')
      )
   );

const projectedBalance =
   currentBalance +
   Number(billsRow?.pendingReceivable ?? 0) -
   Number(billsRow?.pendingPayable ?? 0);

return {
   ...account,
   currentBalance: currentBalance.toFixed(2),
   projectedBalance: projectedBalance.toFixed(2),
};
```

**Step 2: Add projected balance column to bank accounts table**

In `bank-accounts-columns.tsx`, add `projectedBalance: string` to `BankAccountRow` and add column:
```typescript
{
   accessorKey: "projectedBalance",
   header: "Saldo Previsto",
   cell: ({ row }) => {
      const balance = Number(row.original.projectedBalance);
      return (
         <span className={`text-sm ${balance >= 0 ? "text-blue-600 dark:text-blue-400" : "text-destructive"}`}>
            {formatBRL(row.original.projectedBalance)}
         </span>
      );
   },
},
```

Place it after "Saldo Atual".

**Step 3: Add a tooltip explaining projected balance**

Use `TooltipProvider` + `Tooltip` from `@packages/ui/components/tooltip` to add an info icon next to "Saldo Previsto" header:
```tsx
header: () => (
   <TooltipProvider>
      <Tooltip>
         <TooltipTrigger className="flex items-center gap-1">
            Saldo Previsto <Info className="size-3 text-muted-foreground" />
         </TooltipTrigger>
         <TooltipContent>
            Saldo atual + contas a receber pendentes - contas a pagar pendentes
         </TooltipContent>
      </Tooltip>
   </TooltipProvider>
),
```

**Step 4: Commit**
```bash
git commit -m "feat(bank-accounts): add projected balance column (current + pending bills)"
```

---

## Task 17: Final QA & typecheck

**Step 1: Run typecheck**
```bash
bun run typecheck
```
Fix any type errors introduced by new fields on `TransactionRow`, `BankAccountRow`, extended filters, etc.

**Step 2: Run lint**
```bash
bun run check
```
Fix any biome lint issues.

**Step 3: Run app in dev and manually test each feature**
```bash
bun dev
```

Test checklist:
- [ ] Category archive + filtered from list
- [ ] Tag archive + deletion protection
- [ ] Bank account current + projected balance columns
- [ ] Transaction table: category + card columns visible
- [ ] Transaction filters: category, account, card comboboxes work
- [ ] Transaction filter: "Sem categoria" shows uncategorized
- [ ] Transaction form: credit card field shows for expense
- [ ] Transaction form: tags now combobox multi-select
- [ ] Credit card form: limit editable on edit
- [ ] Credit card form: bankAccountId combobox field
- [ ] Budget goals summary bar with 4 totals
- [ ] Sidebar quick-action "+" next to Transações opens new transaction sheet
- [ ] Sidebar visibility configuration persists across refresh
- [ ] "Criar como conta a pagar" checkbox creates a bill
- [ ] Future-dated transaction shows warning callout

**Step 4: Final commit**
```bash
git commit -m "fix(finance): typecheck and lint fixes for finance master plan"
```

---

## Summary of all changes

| Task | Files touched | Category |
|------|--------------|----------|
| 1 | categories.ts, tags.ts schema | Schema migration |
| 2 | credit-cards.ts schema | Schema migration |
| 3 | tags-repository.ts, router/tags.ts | Backend |
| 4 | categories-repository.ts, router/categories.ts, categories-columns.tsx, tags-columns.tsx | Backend + UI |
| 5 | bank-accounts-repository.ts, router/bank-accounts.ts, bank-accounts-columns.tsx | Backend + UI |
| 6 | transactions-repository.ts, router/transactions.ts | Backend |
| 7 | credit-cards-form.tsx, router/credit-cards.ts | UI + Backend |
| 8 | transactions-columns.tsx | UI |
| 9 | transactions.tsx (route) | UI |
| 10 | transactions-sheet.tsx | UI |
| 11 | categories-form.tsx | UI |
| 12 | goals.tsx (route) | UI |
| 13 | sidebar-nav-items.ts, sidebar-item-actions.tsx, transactions.tsx | UI |
| 14 | use-sidebar-visibility.ts (new), sidebar-nav.tsx | UI |
| 15 | transactions-sheet.tsx | UI + logic |
| 16 | bank-accounts-repository.ts, bank-accounts-columns.tsx | Backend + UI |
| 17 | — | QA |
