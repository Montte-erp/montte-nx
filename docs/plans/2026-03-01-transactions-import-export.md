# Transactions Import / Export + Categories Expandable Table

**Date:** 2026-03-01
**Status:** Approved

---

## Scope

1. Export transactions (CSV / OFX) — client-side
2. Import transactions (CSV / OFX) — parse client-side, insert server-side
3. Categories table with expandable subcategory rows

**Out of scope (future — "contas a pagar/receber"):**

- Mark as paid / unpaid
- Installment transactions
- Recurring transactions

---

## New Dependencies

Add to root `package.json` catalog under `"fot"`:

```json
"@f-o-t/csv": "1.2.6",
"@f-o-t/ofx": "2.4.6"
```

Add to `apps/web/package.json`:

```json
"@f-o-t/csv": "catalog:fot",
"@f-o-t/ofx": "catalog:fot"
```

`@f-o-t/condition-evaluator` is already in the catalog.

---

## 1. Export

### UI

- Button "Exportar" in transactions page header
- Opens `TransactionExportCredenza` (via `useCredenza()`)
- Format selector: CSV | OFX (radio)
- Date range picker — pre-filled from active screen filters (`dateFrom` / `dateTo`); defaults to current month if no active filter
- "Baixar" button triggers download

### Client-side flow

1. `orpc.transactions.getAll` with selected period (no pagination — fetch all)
2. If CSV → `generateFromObjects()` from `@f-o-t/csv`
3. If OFX → `generateBankStatement()` or `generateCreditCardStatement()` from `@f-o-t/ofx` based on account type
4. `URL.createObjectURL(blob)` + `<a download="transacoes-YYYY-MM.csv">` — browser download

**Nothing is sent to the server.**

### CSV column order

`data` · `nome` · `tipo` · `valor` · `descricao` · `conta` · `conta_destino` · `categoria` · `subcategoria` · `tags`

---

## 2. Import

### UI — 2-step modal

**Step 1: Upload + Defaults**

- File picker (`.csv`, `.ofx`) with drag & drop
- Parses file immediately in the browser on selection:
   - `.csv` → `parseToArray()` from `@f-o-t/csv`
   - `.ofx` → `parse()` + `getTransactions()` from `@f-o-t/ofx`
- Global defaults (applied to empty cells in imported rows):
   - Conta (required if not present in file)
   - Categoria + Subcategoria
   - Tags
   - Observação (maps to `description`)
- "Baixar modelo CSV" button → generates and downloads template with `@f-o-t/csv`
   - Template includes all columns: `data`, `nome`, `tipo`, `valor`, `descricao`, `conta`, `conta_destino`, `categoria`, `subcategoria`, `tags`
   - XLS template deferred — tracked at F-O-T/libraries issue

**Step 2: Preview + Duplicates**

- Table showing parsed rows: `data`, `nome`, `tipo`, `valor`, `conta`, `categoria`
- "Verificar duplicados" button:
   1. Fetches existing transactions for the imported period via `orpc.transactions.getAll`
   2. Runs `@f-o-t/condition-evaluator` in the browser:
      ```ts
      {
        scoringMode: "weighted",
        threshold: 0.8,
        conditions: [
          { type: "number", field: "amount",        operator: "eq", options: { weight: 0.45 } },
          { type: "date",   field: "date",           operator: "eq", options: { weight: 0.35 } },
          { type: "string", field: "bankAccountId",  operator: "eq", options: { weight: 0.20 } },
        ]
      }
      ```
   3. Rows with `scorePercentage >= 0.8` get ⚠️ icon
- Checkbox "Ignorar duplicados" → removes flagged rows from selection before import
- "Importar X transações" button → sends JSON to `transactions.import`

**Nothing (no file) is sent to the server — only the final parsed JSON array.**

### New oRPC procedure: `transactions.import`

```ts
// Input
{
  teamId: string,
  transactions: Array<{
    date: string,          // YYYY-MM-DD
    name: string | null,
    type: "income" | "expense" | "transfer",
    amount: string,        // positive numeric string
    description: string | null,
    bankAccountId: string,
    destinationBankAccountId: string | null,
    categoryId: string | null,
    subcategoryId: string | null,
    tagIds: string[],
  }>
}

// Output
{ imported: number, skipped: number }
```

Inserts in bulk. Uses existing `createTransaction` repository function per row (or a new `bulkCreateTransactions` if performance requires it).

---

## 3. Categories Table — Expandable Subcategories

### Behavior

- All category rows **start expanded by default**
- Each subcategory renders as a sub-row beneath its parent category
- Works identically for receitas and despesas (type-agnostic)
- Chevron column to manually collapse/expand

### Visual structure

```
▼ Alimentação       despesa    [editar] [excluir]
    └ Restaurante   sub
    └ Mercado       sub
▼ Salário           receita    [editar] [excluir]
    └ Freelance     sub
► Casa              despesa    [editar] [excluir]
```

### Implementation

- `categories-columns.tsx` → remove inline subcategory column, add expand chevron column
- `categories-route.tsx` → pass subcategories nested within each category row (already available via oRPC join)
- `DataTable` receives `renderSubComponent` rendering sub-rows
- Initial state: `expanded: Object.fromEntries(categories.map(c => [c.id, true]))`

---

## Files to Create / Modify

| File                                                                    | Change                                        |
| ----------------------------------------------------------------------- | --------------------------------------------- |
| `apps/web/src/features/transactions/ui/transaction-export-credenza.tsx` | New                                           |
| `apps/web/src/features/transactions/ui/transaction-import-credenza.tsx` | New                                           |
| `apps/web/src/integrations/orpc/router/transactions.ts`                 | Add `import` procedure                        |
| `apps/web/src/routes/.../finance/transactions.tsx`                      | Add export/import buttons                     |
| `apps/web/src/features/categories/ui/categories-columns.tsx`            | Expandable rows                               |
| `apps/web/src/routes/.../finance/categories.tsx`                        | Pass subcategories, initial expanded state    |
| `package.json` (root)                                                   | Add `@f-o-t/csv`, `@f-o-t/ofx` to fot catalog |
| `apps/web/package.json`                                                 | Add `@f-o-t/csv`, `@f-o-t/ofx` deps           |
