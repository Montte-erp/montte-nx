# Transactions Filter Redesign

**Date:** 2026-03-03
**Scope:** Transactions page first, then all pages

---

## Goal

Replace the current spread-out `FilterBar` (7 visible controls) with a compact, consistent filter pattern:

```
[🔍 Search] [📅 Date] [Tipo ▼] [⚙ Filtros (N)] [✕ Clear]
```

The Filters popover uses `@f-o-t/condition-evaluator` condition builder with pre-defined properties per page, standard AND/OR logic, and an optional advanced weighted scoring mode.

---

## Filter Bar Layout

Five elements, always in this order:

| Element        | Component                  | Notes                                                             |
| -------------- | -------------------------- | ----------------------------------------------------------------- |
| Search         | `Input`                    | Debounced 350ms, unchanged                                        |
| Date picker    | `DateRangePicker`          | Existing component, unchanged                                     |
| Type select    | `Select`                   | Replaces `ToggleGroup`: Todos / Receita / Despesa / Transferência |
| Filters button | `TransactionFilterPopover` | Badge shows active condition count                                |
| Clear button   | `Button`                   | Only visible when `hasActiveFilters`                              |

---

## Filters Popover — Standard Mode

Condition builder with pre-defined properties for the transactions domain.

### Transaction Properties

| Field           | Label     | Type   | Operators                                              | Value UI     |
| --------------- | --------- | ------ | ------------------------------------------------------ | ------------ |
| `categoryId`    | Categoria | string | `eq`, `neq`, `is_empty`, `is_not_empty`                | Combobox     |
| `bankAccountId` | Conta     | string | `eq`, `neq`, `is_empty`, `is_not_empty`                | Combobox     |
| `creditCardId`  | Cartão    | string | `eq`, `neq`, `is_empty`, `is_not_empty`                | Combobox     |
| `amount`        | Valor     | number | `eq`, `gt`, `gte`, `lt`, `lte`, `between`              | Number input |
| `name`          | Nome      | string | `contains`, `not_contains`, `starts_with`, `ends_with` | Text input   |

### Popover Structure

```
┌─────────────────────────────────────────┐
│ Filtros          [AND | OR]  [Avançado] │
├─────────────────────────────────────────┤
│ [Categoria ▼] [é igual a ▼] [Select ▼] [✕] │
│ [Valor     ▼] [maior que  ▼] [0.00   ] [✕] │
│ + Adicionar filtro                      │
├─────────────────────────────────────────┤
│              [Limpar]  [Aplicar]        │
└─────────────────────────────────────────┘
```

- Each row: `[Property ▼] [Operator ▼] [Value input] [✕ remove]`
- AND/OR toggle sets `ConditionGroup.operator`
- `+ Adicionar filtro` appends a new empty row

---

## Filters Popover — Advanced Mode

Toggled by "Avançado" switch in the popover header.

```
┌─────────────────────────────────────────┐
│ Filtros          [AND | OR]  [Avançado●]│
├─────────────────────────────────────────┤
│ [Categoria ▼] [é igual a ▼] [Select ▼] [45%] [✕] │
│ [Valor     ▼] [maior que  ▼] [100.00 ] [35%] [✕] │
│ + Adicionar filtro                      │
├─────────────────────────────────────────┤
│ Limite mínimo de correspondência: [70%] │
│              [Limpar]  [Aplicar]        │
└─────────────────────────────────────────┘
```

- Each condition row gains a **weight input** (0–100, defaults to equal split)
- Footer shows **threshold slider** (default 70%)
- Maps to `scoringMode: "weighted"` + `threshold: 0.7` on `ConditionGroup`

---

## Data Flow

### Filter State (client-side)

```typescript
interface TransactionFilters {
   search: string;
   type?: "income" | "expense" | "transfer";
   dateFrom?: string;
   dateTo?: string;
   datePreset?: string;
   conditionGroup?: ConditionGroup; // from @f-o-t/condition-evaluator
   page: number;
   pageSize: number;
}
```

### Server-Side (oRPC `transactions.getAll`)

**Standard mode** (`scoringMode: "binary"` or undefined):

- Translate each condition to a Drizzle `where` clause
- `eq`, `neq` → `eq()` / `ne()`
- `gt`, `gte`, `lt`, `lte` → `gt()` / `gte()` / `lt()` / `lte()`
- `between` → `between()`
- `is_empty`, `is_not_empty` → `isNull()` / `isNotNull()`
- `contains`, `starts_with`, `ends_with` → `ilike()` patterns
- AND/OR maps to Drizzle `and()` / `or()`

**Advanced mode** (`scoringMode: "weighted"`):

- Fetch a broader result set (omit condition SQL, keep other filters)
- Run `evaluateConditionGroup()` from `@f-o-t/condition-evaluator` on each row server-side
- Filter to rows where `result.passed === true`
- Apply pagination after filtering

---

## File Structure

```
apps/web/src/features/transactions/ui/
├── transaction-filter-bar.tsx        # New: extracted filter bar component
├── transaction-filter-popover.tsx    # New: condition builder popover
└── transactions-columns.tsx          # Unchanged
```

The `FilterBar` defined inline in `transactions.tsx` is extracted into `transaction-filter-bar.tsx`. The route file only renders `<TransactionFilterBar />`.

---

## Rollout

1. **Transactions** — implement full feature (this spec)
2. **Other pages** — repeat the pattern with page-specific `PropertyDef[]` configs

The `TransactionFilterPopover` component is designed generically enough to be moved to `@packages/ui` in a future pass once 2–3 pages use it.

---

## Out of Scope

- Moving generic filter popover to `@packages/ui` (future)
- Server-side condition evaluation for standard mode beyond SQL translation
- Saving/loading named filter presets
