# Transactions Filter Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the spread-out transactions FilterBar with a compact `[Search] [Date] [Type Select] [Filters Popover] [Clear]` pattern backed by `@f-o-t/condition-evaluator` ConditionGroup, with server-side translation to Drizzle WHERE clauses (standard) or post-filter evaluation (advanced/weighted).

**Architecture:**

- New `transaction-filter-popover.tsx`: condition builder using `ConditionGroup` from `@f-o-t/condition-evaluator`, supports standard AND/OR mode and advanced weighted mode
- New `transaction-filter-bar.tsx`: slim bar that composes search + date + type select + filter popover, extracted from `transactions.tsx`
- Backend: `getAll` router accepts optional `conditionGroup`, repository translates to SQL (binary) or post-filters via `evaluateConditionGroup` (weighted)

**Tech Stack:** React, `@f-o-t/condition-evaluator`, oRPC, Drizzle ORM, `@packages/ui` components (Popover, Select, Combobox, Badge, Slider, Switch)

---

## Parallelization Map

```
Wave 1 (parallel):
  Task 1 — transaction-filter-popover.tsx  (pure UI, no deps)
  Task 2 — listTransactions repository     (pure backend, no deps)
  Task 3 — getAll router schema            (pure backend, no deps)

Wave 2 (after Wave 1):
  Task 4 — transaction-filter-bar.tsx      (imports Task 1 popover)

Wave 3 (after Wave 2):
  Task 5 — transactions.tsx route wiring   (imports Task 4 bar)
```

---

## Task 1: Create `transaction-filter-popover.tsx`

**Files:**

- Create: `apps/web/src/features/transactions/ui/transaction-filter-popover.tsx`

This is a new condition builder popover for the transactions domain.

### Key Types

```typescript
import type {
   ConditionGroup,
   StringCondition,
   NumberCondition,
} from "@f-o-t/condition-evaluator";
```

The component exports:

```typescript
interface TransactionFilterPopoverProps {
   value: ConditionGroup | undefined;
   onChange: (group: ConditionGroup | undefined) => void;
}

export function TransactionFilterPopover({
   value,
   onChange,
}: TransactionFilterPopoverProps);
```

### Property Definitions

```typescript
// Replace FILTER_PROPERTIES from dashboard-filter-popover.tsx with ERP-domain properties:
const FILTER_PROPERTIES: PropertyDef[] = [
   {
      field: "categoryId",
      label: "Categoria",
      type: "select",
      selectType: "category",
   },
   {
      field: "bankAccountId",
      label: "Conta",
      type: "select",
      selectType: "bankAccount",
   },
   {
      field: "creditCardId",
      label: "Cartão",
      type: "select",
      selectType: "creditCard",
   },
   { field: "amount", label: "Valor", type: "number" },
   { field: "name", label: "Nome", type: "string" },
];

type PropertyType = "string" | "number" | "select";

type PropertyDef = {
   field: string;
   label: string;
   type: PropertyType;
   selectType?: "category" | "bankAccount" | "creditCard";
};
```

### Operators by Type

```typescript
const STRING_OPERATORS = [
   { value: "contains", label: "contém" },
   { value: "not_contains", label: "não contém" },
   { value: "eq", label: "é igual a" },
   { value: "neq", label: "não é igual a" },
   { value: "starts_with", label: "começa com" },
   { value: "ends_with", label: "termina com" },
   { value: "is_empty", label: "está vazio" },
   { value: "is_not_empty", label: "não está vazio" },
];

const SELECT_OPERATORS = [
   { value: "eq", label: "é igual a" },
   { value: "neq", label: "não é igual a" },
   { value: "is_empty", label: "está vazio" },
   { value: "is_not_empty", label: "não está vazio" },
];

const NUMBER_OPERATORS = [
   { value: "eq", label: "=" },
   { value: "neq", label: "≠" },
   { value: "gt", label: ">" },
   { value: "gte", label: "≥" },
   { value: "lt", label: "<" },
   { value: "lte", label: "≤" },
];
```

### Row State

```typescript
const NO_VALUE_OPERATORS = new Set(["is_empty", "is_not_empty"]);

interface FilterRow {
   id: string; // stable row key
   field: string; // e.g. "categoryId"
   operator: string; // e.g. "eq"
   value: string; // string representation of the value (id for selects, number as string)
   weight: number; // 0-100, used in advanced mode, default: 50
}
```

### Internal State

```typescript
const [open, setOpen] = useState(false);
const [rows, setRows] = useState<FilterRow[]>([]);
const [groupOperator, setGroupOperator] = useState<"AND" | "OR">("AND");
const [advanced, setAdvanced] = useState(false);
const [threshold, setThreshold] = useState(70); // 0-100
```

### On Open

```typescript
const handleOpenChange = (next: boolean) => {
   if (next && value) {
      // hydrate rows from existing ConditionGroup
      setRows(value.conditions.map(conditionToRow));
      setGroupOperator(value.operator);
      setAdvanced(value.scoringMode === "weighted");
      setThreshold(
         value.threshold !== undefined ? Math.round(value.threshold * 100) : 70,
      );
   } else if (next) {
      setRows([]);
      setGroupOperator("AND");
      setAdvanced(false);
      setThreshold(70);
   }
   setOpen(next);
};
```

### conditionToRow / rowToCondition

```typescript
function conditionToRow(c: Condition): FilterRow {
   const rawValue =
      "value" in c && c.value !== undefined && c.value !== null
         ? String(c.value)
         : "";
   const weight =
      c.options?.weight !== undefined ? Math.round(c.options.weight * 100) : 50;
   return {
      id: c.id,
      field: c.field,
      operator: c.operator as string,
      value: rawValue,
      weight,
   };
}

function rowToCondition(row: FilterRow, advanced: boolean): Condition {
   const def = FILTER_PROPERTIES.find((p) => p.field === row.field) ?? {
      type: "string",
   };
   const options = advanced ? { weight: row.weight / 100 } : undefined;
   const noValue = NO_VALUE_OPERATORS.has(row.operator);

   if (def.type === "number") {
      return {
         id: row.id,
         type: "number",
         field: row.field,
         operator: row.operator as z.infer<typeof NumberCondition>["operator"],
         value: noValue || row.value === "" ? undefined : Number(row.value),
         options,
      };
   }
   return {
      id: row.id,
      type: "string",
      field: row.field,
      operator: row.operator as z.infer<typeof StringCondition>["operator"],
      value: noValue ? undefined : row.value || undefined,
      options,
   };
}
```

### handleApply

```typescript
const handleApply = () => {
   if (rows.length === 0) {
      onChange(undefined);
      setOpen(false);
      return;
   }
   const group: ConditionGroup = {
      id: "transaction-filters",
      operator: groupOperator,
      ...(advanced
         ? { scoringMode: "weighted", threshold: threshold / 100 }
         : { scoringMode: "binary" }),
      conditions: rows.map((r) => rowToCondition(r, advanced)),
   };
   onChange(group);
   setOpen(false);
};
```

### Popover Structure (JSX)

```tsx
<Popover open={open} onOpenChange={handleOpenChange}>
  <PopoverTrigger asChild>
    <Button variant="outline" className="h-8 gap-1.5">
      <Filter className="size-3.5" />
      Filtros
      {activeCount > 0 && (
        <Badge variant="secondary" className="h-4 px-1 text-xs">{activeCount}</Badge>
      )}
    </Button>
  </PopoverTrigger>

  <PopoverContent align="start" className="w-[580px] p-0">
    {/* Header */}
    <div className="flex items-center justify-between px-3 py-2.5 border-b">
      <span className="text-sm font-medium">Filtros</span>
      <div className="flex items-center gap-3">
        {/* AND/OR toggle */}
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <span>Combinar:</span>
          <ToggleGroup type="single" value={groupOperator} onValueChange={...} size="sm">
            <ToggleGroupItem value="AND">E</ToggleGroupItem>
            <ToggleGroupItem value="OR">OU</ToggleGroupItem>
          </ToggleGroup>
        </div>
        {/* Advanced toggle */}
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-muted-foreground">Avançado</span>
          <Switch checked={advanced} onCheckedChange={setAdvanced} />
        </div>
      </div>
    </div>

    {/* Column headers (when rows present) */}
    {rows.length > 0 && (
      <div className="grid grid-cols-[160px_140px_1fr_auto] gap-2 px-3 pt-2 pb-1">
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Propriedade</span>
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Condição</span>
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Valor</span>
        {advanced && <span className="text-[11px] uppercase tracking-wide text-muted-foreground w-16">Peso</span>}
        <span />
      </div>
    )}

    {/* Rows */}
    <div className="flex flex-col gap-1.5 px-3 pt-1 pb-2.5 max-h-[320px] overflow-y-auto">
      {rows.length === 0 ? (
        <EmptyState /> /* "Nenhum filtro ativo" */
      ) : (
        rows.map(row => <FilterRowComponent key={row.id} row={row} advanced={advanced} ... />)
      )}
    </div>

    <Separator />

    {/* Advanced threshold */}
    {advanced && (
      <div className="px-3 py-2 flex items-center gap-3 border-b">
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          Correspondência mínima:
        </span>
        <Slider
          min={0} max={100} step={5}
          value={[threshold]}
          onValueChange={([v]) => setThreshold(v)}
          className="flex-1"
        />
        <span className="text-xs font-medium tabular-nums w-8">{threshold}%</span>
      </div>
    )}

    {/* Footer */}
    <div className="flex items-center justify-between px-3 py-2">
      <Button variant="ghost" className="h-7 text-xs gap-1" onClick={handleAddRow}>
        <Plus className="size-3.5" /> Adicionar filtro
      </Button>
      <div className="flex gap-1.5">
        <Button variant="ghost" className="h-7 text-xs" onClick={handleClear}>Limpar</Button>
        <Button className="h-7 text-xs" onClick={handleApply}>Aplicar</Button>
      </div>
    </div>
  </PopoverContent>
</Popover>
```

### Value Input by Property Type

- `type: "select"` + `selectType: "category"` → `<CategoryValueSelect value={row.value} onChange={...} />`
- `type: "select"` + `selectType: "bankAccount"` → `<AccountValueSelect value={row.value} onChange={...} />`
- `type: "select"` + `selectType: "creditCard"` → `<CardValueSelect value={row.value} onChange={...} />`
- `type: "number"` → `<Input type="number" className="h-7 text-xs" />`
- `type: "string"` → `<Input type="text" className="h-7 text-xs" />`

Each `*ValueSelect` is a small `Suspense`-wrapped `Combobox` that calls the relevant `useSuspenseQuery`.

### Trigger Badge Count

```typescript
const activeCount = value?.conditions.length ?? 0;
```

### Step 1: Implement the component

Write the complete file at `apps/web/src/features/transactions/ui/transaction-filter-popover.tsx` following the structure above.

Important notes:

- Import `Slider` from `@packages/ui/components/slider`
- Import `Switch` from `@packages/ui/components/switch`
- Import `ToggleGroup`, `ToggleGroupItem` from `@packages/ui/components/toggle-group`
- Import `Combobox` from `@packages/ui/components/combobox`
- Import `Popover`, `PopoverContent`, `PopoverTrigger` from `@packages/ui/components/popover`
- Import `Badge` from `@packages/ui/components/badge`
- Import `Separator` from `@packages/ui/components/separator`
- Import `type { ConditionGroup, Condition, StringCondition, NumberCondition } from "@f-o-t/condition-evaluator"`
- Import `type { z } from "zod"` for operator casting
- Use `orpc.categories.getAll`, `orpc.bankAccounts.getAll`, `orpc.creditCards.getAll` for value selects
- No value input shown when operator is in `NO_VALUE_OPERATORS`
- Default field when adding a new row: first property (`categoryId`)
- When `advanced` is toggled off, preserve existing rows but ignore weights on apply

### Step 2: Verify imports exist

Run: `bun run typecheck 2>&1 | grep transaction-filter-popover`

---

## Task 2: Update `listTransactions` repository

**Files:**

- Modify: `packages/database/src/repositories/transactions-repository.ts`

### Step 1: Add `conditionGroup` to `ListTransactionsFilter`

```typescript
import type { ConditionGroup } from "@f-o-t/condition-evaluator";
import { evaluateConditionGroup } from "@f-o-t/condition-evaluator";

export interface ListTransactionsFilter {
   // ... existing fields unchanged ...
   conditionGroup?: ConditionGroup;
}
```

### Step 2: Add SQL translation helper

Add this function after the existing imports, before `createTransaction`:

```typescript
import {
   and,
   between,
   count,
   desc,
   eq,
   getTableColumns,
   gt,
   gte,
   ilike,
   inArray,
   isNotNull,
   isNull,
   lte,
   lt,
   ne,
   or,
} from "drizzle-orm";

// Maps a single Condition to a Drizzle SQL expression.
// Returns null if the condition cannot be translated (will be post-filtered).
function conditionToSql(condition: Condition) {
   const col = (transactions as Record<string, unknown>)[condition.field];
   if (!col) return null; // unknown field — skip in SQL, handle in post-filter

   const { operator } = condition;
   const value = "value" in condition ? condition.value : undefined;

   switch (operator) {
      case "eq":
         return eq(col as AnyColumn, value as string);
      case "neq":
         return ne(col as AnyColumn, value as string);
      case "gt":
         return gt(col as AnyColumn, value as number);
      case "gte":
         return gte(col as AnyColumn, value as number);
      case "lt":
         return lt(col as AnyColumn, value as number);
      case "lte":
         return lte(col as AnyColumn, value as number);
      case "is_empty":
         return isNull(col as AnyColumn);
      case "is_not_empty":
         return isNotNull(col as AnyColumn);
      case "contains":
         return ilike(col as AnyColumn, `%${value}%`);
      case "not_contains":
         // negate ilike — drizzle has no built-in, use not(ilike(...))
         return sql`${col} NOT ILIKE ${`%${value}%`}`;
      case "starts_with":
         return ilike(col as AnyColumn, `${value}%`);
      case "ends_with":
         return ilike(col as AnyColumn, `%${value}`);
      default:
         return null;
   }
}
```

Note: add `import { sql } from "drizzle-orm"` and `import type { AnyColumn } from "drizzle-orm"` and `import type { Condition } from "@f-o-t/condition-evaluator"`.

### Step 3: Add conditionGroup handling in `listTransactions`

In `listTransactions`, after the existing filter conditions are built and before the query is executed:

**Standard mode** (`!conditionGroup || conditionGroup.scoringMode !== "weighted"`):

```typescript
if (filter.conditionGroup && filter.conditionGroup.scoringMode !== "weighted") {
   const group = filter.conditionGroup;
   const sqlExprs = group.conditions
      .filter((c) => !("conditions" in c)) // only Condition, not nested ConditionGroup
      .map((c) => conditionToSql(c as Condition))
      .filter(Boolean);

   if (sqlExprs.length > 0) {
      const combined =
         group.operator === "AND" ? and(...sqlExprs) : or(...sqlExprs);
      if (combined) conditions.push(combined);
   }
}
```

**Advanced/weighted mode**: fetch without condition SQL, post-filter in memory:

```typescript
const isWeighted = filter.conditionGroup?.scoringMode === "weighted";

// ... build whereClause from conditions (without conditionGroup) ...

if (isWeighted && filter.conditionGroup) {
   // Fetch ALL matching rows (ignore pagination), post-filter, then paginate in memory
   const allRows = await db
      .select({
         ...getTableColumns(transactions),
         categoryName: categories.name,
         cardName: creditCards.name,
      })
      .from(transactions)
      .leftJoin(categories, eq(transactions.categoryId, categories.id))
      .leftJoin(creditCards, eq(transactions.creditCardId, creditCards.id))
      .where(whereClause)
      .orderBy(desc(transactions.date));

   const filtered = allRows.filter((row) => {
      const result = evaluateConditionGroup(filter.conditionGroup!, {
         data: {
            categoryId: row.categoryId ?? null,
            bankAccountId: row.bankAccountId,
            creditCardId: row.creditCardId ?? null,
            amount: Number(row.amount),
            name: row.name ?? row.description ?? "",
         },
      });
      return result.passed;
   });

   const total = filtered.length;
   const offset = (page - 1) * pageSize;
   return { data: filtered.slice(offset, offset + pageSize), total };
}
```

### Step 4: Verify types compile

Run: `bun run typecheck 2>&1 | grep transactions-repository`

---

## Task 3: Update `getAll` router input schema

**Files:**

- Modify: `apps/web/src/integrations/orpc/router/transactions.ts`

### Step 1: Add conditionGroup to input schema

```typescript
import { ConditionGroup } from "@f-o-t/condition-evaluator";

// In getAll input schema, add:
conditionGroup: ConditionGroup.optional(),
```

### Step 2: Pass conditionGroup to repository

```typescript
.handler(async ({ context, input }) => {
  const { db, teamId } = context;
  return listTransactions(db, { teamId, ...input });
});
```

The `...input` spread already includes `conditionGroup` since it's in the Zod schema — no other changes needed.

### Step 3: Verify types

Run: `bun run typecheck 2>&1 | grep "router/transactions"`

---

## Task 4: Create `transaction-filter-bar.tsx`

**Files:**

- Create: `apps/web/src/features/transactions/ui/transaction-filter-bar.tsx`

This component extracts the filter bar from `transactions.tsx` and replaces category/account/card comboboxes with `TransactionFilterPopover`.

### Exported Interface

```typescript
import type { ConditionGroup } from "@f-o-t/condition-evaluator";

type TransactionType = "income" | "expense" | "transfer";

export interface TransactionFilters {
   type?: TransactionType;
   dateFrom?: string;
   dateTo?: string;
   datePreset?: string;
   search: string;
   conditionGroup?: ConditionGroup;
   page: number;
   pageSize: number;
}

export const DEFAULT_FILTERS: TransactionFilters = {
   search: "",
   page: 1,
   pageSize: 20,
};

export interface TransactionFilterBarProps {
   filters: TransactionFilters;
   onFiltersChange: (filters: TransactionFilters) => void;
}

export function TransactionFilterBar({
   filters,
   onFiltersChange,
}: TransactionFilterBarProps);
```

### Bar Layout

```tsx
<div className="flex flex-wrap items-center gap-2">
  {/* Search */}
  <div className="relative">
    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
    <Input className="pl-8 h-8 w-[220px]" ... />
  </div>

  {/* Date range - reuse all existing date logic */}
  <DateRangePicker ... />

  {/* Type select (replaces ToggleGroup) */}
  <Select value={filters.type ?? ""} onValueChange={v =>
    onFiltersChange({ ...filters, type: (v as TransactionType) || undefined, page: 1 })
  }>
    <SelectTrigger className="h-8 w-[130px]">
      <SelectValue placeholder="Tipo" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="">Todos</SelectItem>
      <SelectItem value="income">Receita</SelectItem>
      <SelectItem value="expense">Despesa</SelectItem>
      <SelectItem value="transfer">Transferência</SelectItem>
    </SelectContent>
  </Select>

  {/* Condition builder popover */}
  <TransactionFilterPopover
    value={filters.conditionGroup}
    onChange={group => onFiltersChange({ ...filters, conditionGroup: group, page: 1 })}
  />

  {/* Clear all */}
  {hasActiveFilters && (
    <Button variant="ghost" className="h-8 gap-1" onClick={handleClear}>
      <X className="size-3.5" /> Limpar
    </Button>
  )}
</div>
```

### hasActiveFilters

```typescript
const hasActiveFilters =
   filters.type ||
   hasDateFilter ||
   filters.search.length > 0 ||
   (filters.conditionGroup?.conditions.length ?? 0) > 0;
```

### handleClear

```typescript
const handleClear = () => {
   setSearchInput("");
   onFiltersChange(DEFAULT_FILTERS);
};
```

Copy the date-related helpers (`DATE_RANGE_PRESETS`, `presetToDateRange`, `dateLabel` memo, `selectedRange` memo) from `transactions.tsx` into this file since they are needed for the DateRangePicker.

### Step 1: Write the complete component

### Step 2: Verify types

Run: `bun run typecheck 2>&1 | grep transaction-filter-bar`

---

## Task 5: Update `transactions.tsx` route

**Files:**

- Modify: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/transactions.tsx`

### Step 1: Remove inline types and components that are now in separate files

Delete from `transactions.tsx`:

- `type TransactionType`
- `interface TransactionFilters`
- `const DEFAULT_FILTERS`
- `const DATE_RANGE_PRESETS`
- `function presetToDateRange`
- `function CategoryFilterCombobox`
- `function AccountFilterCombobox`
- `function CardFilterCombobox`
- `function FilterBar`

### Step 2: Import from new files

```typescript
import {
   TransactionFilterBar,
   type TransactionFilters,
   DEFAULT_FILTERS,
} from "@/features/transactions/ui/transaction-filter-bar";
```

### Step 3: Update `TransactionsListProps` and `TransactionsList`

Remove `categoryId`, `uncategorized`, `bankAccountId`, `creditCardId` from the query input and add `conditionGroup`:

```typescript
// In TransactionsList useSuspenseQuery:
orpc.transactions.getAll.queryOptions({
   input: {
      type: filters.type,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      search: filters.search || undefined,
      conditionGroup: filters.conditionGroup,
      page: filters.page,
      pageSize: filters.pageSize,
   },
});
```

### Step 4: Update empty state condition

```typescript
// The empty state "no filters applied" vs "filters applied" check:
const hasFilters =
   filters.search ||
   filters.type ||
   filters.dateFrom ||
   (filters.conditionGroup?.conditions.length ?? 0) > 0;
```

### Step 5: Replace `<FilterBar>` with `<TransactionFilterBar>`

```tsx
<TransactionFilterBar filters={filters} onFiltersChange={setFilters} />
```

### Step 6: Remove now-unused imports

Remove: `ToggleGroup`, `ToggleGroupItem`, `Combobox` (if no longer used elsewhere in the file).

### Step 7: Run typecheck

Run: `bun run typecheck 2>&1 | head -50`

If clean, done. If errors, fix them.

### Step 8: Manual smoke test

- Open the transactions page
- Verify the filter bar shows: search, date, type select, Filtros button
- Click Filtros → condition builder opens
- Add a category condition → apply → page reloads with filter
- Toggle Avançado → weight inputs and threshold slider appear
- Clear → filters reset

---

## Execution Order for Subagents

```
Wave 1 (dispatch in parallel):
  Agent A: Task 1 (transaction-filter-popover.tsx)
  Agent B: Task 2 (listTransactions repository)
  Agent C: Task 3 (getAll router schema)

Wave 2 (after Wave 1 completes):
  Agent D: Task 4 (transaction-filter-bar.tsx)

Wave 3 (after Wave 2 completes):
  Agent E: Task 5 (transactions.tsx wiring)
```
