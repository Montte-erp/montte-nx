# [Transações] Reestruturar campos, formulários e listagem conforme spec do PM

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add payment method, installments, products/services line items, file attachment upload, totalizadores, and missing columns/filters to the transactions feature per PM spec (#632).

**Architecture:** Schema-first approach — add new fields/tables to Drizzle schema, update repository queries, extend oRPC router inputs/outputs, then update UI (form, columns, list, filters, import/export). Products/services use a junction table `transaction_items` linking transactions to existing `services` table.

**Tech Stack:** Drizzle ORM, oRPC, TanStack Query, TanStack Form, Zod, MinIO (file upload), React/Vite

---

## Pre-Implementation Notes

### PM Spec Clarifications (from issue #632 "Observações")

- "Cliente/Fornecedor (Contato)" appears twice in spec (fields 11 and 15) — treat as **same field** (`contactId`)
- "Transferência" type — **keep it** (existing data depends on it), spec just doesn't list it
- `bankAccountId` is currently NOT NULL — spec says optional → **make nullable** (requires migration care)
- Tag currently optional, spec says obrigatório → **make required in form validation only** (not schema, to avoid breaking existing data)
- Categoria currently nullable, spec says obrigatório → **make required in form validation only**

### What Already Exists ✅

- Nome, Tipo, Valor, Data, Conta Bancária, Categoria (+Subcategoria), Tags, Contato, Cartão, Descrição
- Import/Export CSV and OFX
- Filtros: Busca, Período, Tipo, Condition Builder
- CRUD completo, bulk actions

---

## Task 1: Add `paymentMethodEnum` and new schema fields

**Files:**

- Modify: `packages/database/src/schemas/transactions.ts`

**Step 1: Add the enum and fields to schema**

```typescript
// After transactionTypeEnum definition, add:
export const paymentMethodEnum = pgEnum("payment_method", [
  "pix",
  "credit_card",
  "debit_card",
  "boleto",
  "cash",
  "transfer",
  "other",
]);

// Add to transactions table (after attachmentUrl):
paymentMethod: paymentMethodEnum().default("other"),
isInstallment: boolean().default(false).notNull(),
installmentCount: integer(),
installmentNumber: integer(),
installmentGroupId: uuid(),
```

**Step 2: Push schema**

Run: `bun run db:push`
Expected: Schema changes applied successfully

**Step 3: Commit**

```bash
git add packages/database/src/schemas/transactions.ts
git commit -m "feat(transactions): add paymentMethod, installment fields to schema"
```

---

## Task 2: Create `transaction_items` junction table

**Files:**

- Modify: `packages/database/src/schemas/transactions.ts`

**Step 1: Add the junction table**

```typescript
export const transactionItems = pgTable("transaction_items", {
   id: uuid().primaryKey().defaultRandom(),
   transactionId: uuid()
      .notNull()
      .references(() => transactions.id, { onDelete: "cascade" }),
   serviceId: uuid().references(() => services.id, { onDelete: "set null" }),
   teamId: uuid()
      .notNull()
      .references(() => team.id, { onDelete: "cascade" }),
   description: text(),
   quantity: numeric({ precision: 12, scale: 4 }).notNull().default("1"),
   unitPrice: numeric({ precision: 12, scale: 2 }).notNull().default("0"),
   createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
});
```

Add relations:

```typescript
export const transactionItemsRelations = relations(transactionItems, ({ one }) => ({
  transaction: one(transactions, {
    fields: [transactionItems.transactionId],
    references: [transactions.id],
  }),
  service: one(services, {
    fields: [transactionItems.serviceId],
    references: [services.id],
  }),
}));

// Add to transactionsRelations:
items: many(transactionItems),
```

**Step 2: Push schema**

Run: `bun run db:push`
Expected: New table created

**Step 3: Commit**

```bash
git add packages/database/src/schemas/transactions.ts
git commit -m "feat(transactions): add transaction_items junction table for products/services"
```

---

## Task 3: Make `bankAccountId` nullable

**Files:**

- Modify: `packages/database/src/schemas/transactions.ts`
- Modify: `packages/database/src/repositories/transactions-repository.ts`
- Modify: `apps/web/src/integrations/orpc/router/transactions.ts`

**Step 1: Change schema field**

In `transactions` table definition, change `bankAccountId` from `.notNull()` to nullable (remove `.notNull()`).

**Step 2: Update router validation**

In the Zod schema, change `bankAccountId` from required UUID to optional/nullable UUID.

**Step 3: Update repository**

Ensure `listTransactions` JOIN on bankAccount uses LEFT JOIN (should already be the case or update).

**Step 4: Push schema and verify**

Run: `bun run db:push`
Run: `bun run typecheck`
Expected: No type errors

**Step 5: Commit**

```bash
git add packages/database/src/schemas/transactions.ts packages/database/src/repositories/transactions-repository.ts apps/web/src/integrations/orpc/router/transactions.ts
git commit -m "feat(transactions): make bankAccountId nullable per PM spec"
```

---

## Task 4: Update repository — add new filters and JOINs

**Files:**

- Modify: `packages/database/src/repositories/transactions-repository.ts`

**Step 1: Add paymentMethod to ListTransactionsFilter**

```typescript
interface ListTransactionsFilter {
   // ...existing fields
   paymentMethod?: string;
}
```

**Step 2: Add paymentMethod filter condition**

In `listTransactions`, add:

```typescript
if (filter.paymentMethod) {
   conditions.push(eq(transactions.paymentMethod, filter.paymentMethod));
}
```

**Step 3: Add bankAccount name and contact name to SELECT**

Add LEFT JOINs for `bankAccounts` and `contacts` tables, return `bankAccountName` and `contactName` in the result.

**Step 4: Add totalizadores query**

Create new function `getTransactionsSummary(db, filter)`:

```typescript
export async function getTransactionsSummary(
   db: DatabaseInstance,
   filter: ListTransactionsFilter,
) {
   // Uses same WHERE conditions as listTransactions
   // Returns: { totalCount, incomeTotal, expenseTotal, balance }
   // Use SQL aggregation: COUNT(*), SUM(CASE WHEN type='income' THEN amount ELSE 0 END), etc.
}
```

**Step 5: Add transaction items CRUD helpers**

```typescript
export async function createTransactionItems(
  db: DatabaseInstance,
  transactionId: string,
  items: { serviceId?: string; description?: string; quantity: string; unitPrice: string; teamId: string }[],
) { ... }

export async function getTransactionItems(db: DatabaseInstance, transactionId: string) { ... }

export async function replaceTransactionItems(
  db: DatabaseInstance,
  transactionId: string,
  items: { serviceId?: string; description?: string; quantity: string; unitPrice: string; teamId: string }[],
) { ... }
```

**Step 6: Verify**

Run: `bun run typecheck`
Expected: No type errors

**Step 7: Commit**

```bash
git add packages/database/src/repositories/transactions-repository.ts
git commit -m "feat(transactions): add paymentMethod filter, JOINs for names, totalizadores, items CRUD"
```

---

## Task 5: Update oRPC router — new fields, items, summary endpoint

**Files:**

- Modify: `apps/web/src/integrations/orpc/router/transactions.ts`

**Step 1: Update transaction input schema**

Add to the Zod schema:

```typescript
paymentMethod: z.enum(["pix", "credit_card", "debit_card", "boleto", "cash", "transfer", "other"]).nullable().optional(),
isInstallment: z.boolean().default(false),
installmentCount: z.number().int().min(2).max(72).nullable().optional(),
items: z.array(z.object({
  serviceId: z.string().uuid().nullable().optional(),
  description: z.string().max(500).nullable().optional(),
  quantity: z.string(),
  unitPrice: z.string(),
})).optional().default([]),
```

**Step 2: Wire items into create/update procedures**

After creating/updating the transaction, call `createTransactionItems` / `replaceTransactionItems`.

**Step 3: Add `getSummary` procedure**

```typescript
export const getSummary = protectedProcedure
   .input(
      z
         .object({
            /* same filters as getAll */
         })
         .optional(),
   )
   .handler(async ({ context, input }) => {
      return getTransactionsSummary(context.db, {
         teamId: context.session.activeTeamId,
         ...input,
      });
   });
```

**Step 4: Add paymentMethod to getAll filter input**

**Step 5: Update importBulk to accept new fields**

**Step 6: Verify**

Run: `bun run typecheck`
Expected: No type errors

**Step 7: Commit**

```bash
git add apps/web/src/integrations/orpc/router/transactions.ts
git commit -m "feat(transactions): add paymentMethod, items, installments, summary to router"
```

---

## Task 6: Update form (transactions-sheet.tsx) — new fields

**Files:**

- Modify: `apps/web/src/features/transactions/ui/transactions-sheet.tsx`

**Step 1: Add paymentMethod field**

Add a Select dropdown after Categoria with options:

- Pix, Cartão de Crédito, Cartão de Débito, Boleto, Dinheiro, Transferência, Outro

**Step 2: Add installment toggle and count**

After payment method:

- Toggle "Parcelado" (boolean)
- Conditional field "Número de parcelas" (number input, min 2, max 72) — only visible when parcelado=true

**Step 3: Add items (products/services) section**

After contato field, add a repeatable items section:

- Button "Adicionar Produto/Serviço"
- Each item row: Service combobox (optional) + Description + Quantity + Unit Price + Remove button
- Query services via `orpc.services.getAll`

**Step 4: Add file attachment upload**

After description field:

- File input with drag-and-drop
- Use `usePresignedUpload` hook for MinIO upload
- Store URL in `attachmentUrl`

**Step 5: Make Tag and Categoria required in form validation**

Update TanStack Form validators to require tagIds (min 1) and categoryId (non-null).

**Step 6: Verify**

Run: `bun run typecheck`
Expected: No type errors

**Step 7: Commit**

```bash
git add apps/web/src/features/transactions/ui/transactions-sheet.tsx
git commit -m "feat(transactions): add paymentMethod, installments, items, attachment to form"
```

---

## Task 7: Update columns (transactions-columns.tsx)

**Files:**

- Modify: `apps/web/src/features/transactions/ui/transactions-columns.tsx`

**Step 1: Add missing columns**

Add columns for:

- **Conta** (bankAccountName from JOIN)
- **Fornecedor/Cliente** (contactName from JOIN)

**Step 2: Reorder columns per spec**

New order: Data → Nome → Tipo → Fornecedor/Cliente → Categoria → Conta → Cartão → Valor

**Step 3: Update TransactionRow type**

Add `bankAccountName?: string | null` to the type.

**Step 4: Verify**

Run: `bun run typecheck`
Expected: No type errors

**Step 5: Commit**

```bash
git add apps/web/src/features/transactions/ui/transactions-columns.tsx
git commit -m "feat(transactions): add Conta, Contato columns, reorder per spec"
```

---

## Task 8: Add totalizadores to list (transactions-list.tsx)

**Files:**

- Modify: `apps/web/src/features/transactions/ui/transactions-list.tsx`

**Step 1: Query summary data**

Add `useSuspenseQuery` for `orpc.transactions.getSummary` with same filters.

**Step 2: Render totalizadores bar**

Above the DataTable, add a summary bar with 4 cards:

- Total de lançamentos (count)
- Entradas (R$ green)
- Saídas (R$ red)
- Saldo (R$ — green if positive, red if negative)

Use `formatCurrency` from `@f-o-t/money`.

**Step 3: Verify**

Run: `bun run typecheck`
Expected: No type errors

**Step 4: Commit**

```bash
git add apps/web/src/features/transactions/ui/transactions-list.tsx
git commit -m "feat(transactions): add totalizadores summary bar above table"
```

---

## Task 9: Update filters (transaction-filter-bar.tsx)

**Files:**

- Modify: `apps/web/src/features/transactions/ui/transaction-filter-bar.tsx`

**Step 1: Add direct filters**

Promote from condition builder to top-level Select filters:

- **Conta** (bankAccountId) — dropdown of bank accounts
- **Cartão** (creditCardId) — dropdown of credit cards
- **Forma de pagamento** (paymentMethod) — dropdown of payment methods
- **Categoria** (categoryId) — dropdown of categories

**Step 2: Update TransactionFilters interface**

Add:

```typescript
bankAccountId?: string;
creditCardId?: string;
paymentMethod?: string;
categoryId?: string;
```

**Step 3: Update search to include contact name**

Modify the search behavior to include contactName matching (server-side in repository).

**Step 4: Verify**

Run: `bun run typecheck`
Expected: No type errors

**Step 5: Commit**

```bash
git add apps/web/src/features/transactions/ui/transaction-filter-bar.tsx
git commit -m "feat(transactions): promote filters to top-level, add paymentMethod filter"
```

---

## Task 10: Update import (transaction-import-credenza.tsx)

**Files:**

- Modify: `apps/web/src/features/transactions/ui/transaction-import-credenza.tsx`

**Step 1: Add column mappings for new fields**

Add auto-detection patterns for:

- `forma_pagamento` / `payment_method` / `metodo` → paymentMethod
- `parcelado` / `installment` → isInstallment
- `num_parcelas` / `parcelas` / `installments` → installmentCount
- `produto` / `servico` / `product` / `service` → item description
- `quantidade` / `qty` / `quantity` → item quantity
- `preco_unitario` / `unit_price` / `preco` → item unitPrice

**Step 2: Update preview and mapping UI**

Add the new fields to the column mapping step.

**Step 3: Wire into importBulk call**

Include new fields in the mutation payload.

**Step 4: Commit**

```bash
git add apps/web/src/features/transactions/ui/transaction-import-credenza.tsx
git commit -m "feat(transactions): add new field mappings to CSV import"
```

---

## Task 11: Update export (transaction-export-credenza.tsx)

**Files:**

- Modify: `apps/web/src/features/transactions/ui/transaction-export-credenza.tsx`

**Step 1: Add new columns to CSV export**

Add to CSV header and row generation:

- `forma_pagamento` (paymentMethod)
- `parcelado` (isInstallment)
- `num_parcelas` (installmentCount)
- `conta` (bankAccountName)
- `contato` (contactName)

**Step 2: Commit**

```bash
git add apps/web/src/features/transactions/ui/transaction-export-credenza.tsx
git commit -m "feat(transactions): add new fields to CSV export"
```

---

## Task 12: Final verification and typecheck

**Step 1: Full typecheck**

Run: `bun run typecheck`
Expected: No errors

**Step 2: Lint check**

Run: `bun run check`
Expected: No errors (fix any biome issues)

**Step 3: Run tests**

Run: `bun run test`
Expected: All passing

**Step 4: Final commit (if any fixes needed)**

```bash
git commit -m "fix(transactions): resolve typecheck/lint issues from restructure"
```

---

## Dependency Order

```
Task 1 (paymentMethod enum + fields)
  → Task 2 (transaction_items table)
    → Task 3 (bankAccountId nullable)
      → Task 4 (repository updates)
        → Task 5 (router updates)
          → Task 6 (form UI)
          → Task 7 (columns UI)
          → Task 8 (totalizadores UI)
          → Task 9 (filters UI)
          → Task 10 (import UI)
          → Task 11 (export UI)
            → Task 12 (final verification)
```

Tasks 6-11 can be parallelized after Task 5 completes.
