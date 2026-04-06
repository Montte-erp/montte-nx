# Import Wizard Polish Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Three targeted improvements — rename `useCnpjData` → `useCnpj` with internal helpers, redesign the MapStep layout to use the wide credenza space properly, and fix `SelectionActionBar` overlapping the modal action buttons.

**Architecture:** `useCnpj` becomes a single hook that owns all CNPJ logic internally — callers get `{ data, minDate, minDateStr }` from the hook directly. MapStep layout switches from a cramped 3-col inline grid to a 2-col card layout with sample values shown below each selector. `SelectionActionBar` gets an `inline` variant that flows in-document instead of `fixed` viewport-bottom.

**Tech Stack:** React hooks, Tailwind CSS, foxact, `@tanstack/react-query`

---

### Task 1: Refactor `useCnpjData` → `useCnpj`

**Files:**

- Rename + rewrite: `apps/web/src/hooks/use-cnpj-data.ts` → `apps/web/src/hooks/use-cnpj.ts`
- Modify: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-transactions/use-statement-import.ts`
- Modify: `apps/web/src/features/bank-accounts/ui/bank-accounts-form.tsx`

**What to do:**

Delete `apps/web/src/hooks/use-cnpj-data.ts` and create `apps/web/src/hooks/use-cnpj.ts`:

```typescript
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import { orpc } from "@/integrations/orpc/client";

dayjs.extend(customParseFormat);

export type CnpjData = {
   cnpj?: string;
   razao_social?: string;
   nome_fantasia?: string | null;
   cnae_fiscal?: number;
   cnae_fiscal_descricao?: string | null;
   porte?: string | null;
   natureza_juridica?: string | null;
   municipio?: string;
   uf?: string;
   data_inicio_atividade?: string;
   descricao_situacao_cadastral?: string;
};

function parseCnpjRaw(raw: unknown): CnpjData | null {
   if (!raw || typeof raw !== "object") return null;
   return raw as CnpjData;
}

function parseDateOfCreation(raw: string | undefined): {
   minDate: Date | undefined;
   minDateStr: string | null;
} {
   if (!raw) return { minDate: undefined, minDateStr: null };
   const formats = ["DD/MM/YYYY", "YYYY-MM-DD", "DD-MM-YYYY"];
   for (const fmt of formats) {
      const d = dayjs(raw, fmt, true);
      if (d.isValid()) {
         const minDateStr = d.format("YYYY-MM-DD");
         return { minDate: d.toDate(), minDateStr };
      }
   }
   return { minDate: undefined, minDateStr: null };
}

export function useCnpj(teamId: string | null): {
   data: CnpjData | null;
   minDate: Date | undefined;
   minDateStr: string | null;
} {
   const { data: teamData } = useQuery({
      ...orpc.team.get.queryOptions({ input: { teamId: teamId ?? "" } }),
      enabled: !!teamId,
   });

   const data = parseCnpjRaw(teamData?.cnpjData);
   const { minDate, minDateStr } = parseDateOfCreation(
      data?.data_inicio_atividade,
   );

   return { data, minDate, minDateStr };
}
```

**Update `use-statement-import.ts`:**

Replace:

```typescript
import { getMinImportDate, useCnpjData } from "@/hooks/use-cnpj-data";
```

With:

```typescript
import { useCnpj } from "@/hooks/use-cnpj";
```

Replace:

```typescript
const cnpjData = useCnpjData(teamId);
const { minDateStr: minImportDate } = getMinImportDate(cnpjData);
```

With:

```typescript
const { minDateStr: minImportDate } = useCnpj(teamId);
```

**Update `bank-accounts-form.tsx`:**

Replace:

```typescript
import { getMinImportDate, useCnpjData } from "@/hooks/use-cnpj-data";
```

With:

```typescript
import { useCnpj } from "@/hooks/use-cnpj";
```

Replace:

```typescript
const cnpjData = useCnpjData(activeTeamId ?? null);
const { minDate } = getMinImportDate(cnpjData);
```

> Note: the actual code may look slightly different — find the `useCnpjData`/`getMinImportDate` calls and replace them with `const { minDate } = useCnpj(activeTeamId ?? null);`

**Commit:**

```bash
git add apps/web/src/hooks/use-cnpj.ts apps/web/src/hooks/use-cnpj-data.ts apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/-transactions/use-statement-import.ts apps/web/src/features/bank-accounts/ui/bank-accounts-form.tsx
git commit -m "refactor(hooks): rename useCnpjData → useCnpj, internalize date helpers"
```

---

### Task 2: Redesign MapStep layout

**Files:**

- Modify: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-transactions/statement-import-credenza.tsx` (MapStep function, lines ~391–481)

**Current layout problem:** `grid-cols-[7rem_1fr_6rem]` puts label | selector | sample all on one line. The sample is capped at 6rem and truncated. The wide credenza has room for much more.

**New layout:** 2-column grid (`grid-cols-[10rem_1fr]`). Label with required indicator on the left. Right side: selector on top, sample values in a subtle hint row below.

Replace the entire `<div className="flex flex-col gap-2">` mapping block (and its children) inside MapStep with:

```tsx
<div className="flex flex-col gap-1">
   <div className="grid grid-cols-[10rem_1fr] items-center gap-2 px-1 pb-1">
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
         Campo
      </span>
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
         Coluna do arquivo
      </span>
   </div>
   {COLUMN_FIELDS.map((field) => {
      const sample = mapping[field]
         ? getSampleValues(raw, mapping[field])
         : null;
      return (
         <div
            className="grid grid-cols-[10rem_1fr] items-start gap-2 rounded-lg border bg-muted/20 px-3 py-2.5"
            key={field}
         >
            <div className="flex flex-col gap-0.5 pt-1">
               <span className="text-sm font-medium">
                  {FIELD_LABELS[field]}
               </span>
            </div>
            <div className="flex flex-col gap-1">
               <Combobox
                  options={[
                     { value: "__none__", label: "— Não mapear —" },
                     ...raw.headers.map((h) => ({ value: h, label: h })),
                  ]}
                  onValueChange={(v) =>
                     onMappingChange({
                        ...mapping,
                        [field]: v === "__none__" ? "" : v,
                     })
                  }
                  value={mapping[field] || "__none__"}
               />
               {sample && (
                  <p className="text-xs text-muted-foreground px-1 truncate">
                     {sample}
                  </p>
               )}
            </div>
         </div>
      );
   })}
</div>
```

Also update the row count / columns footer — replace:

```tsx
<p className="text-xs text-muted-foreground">
   {raw.rows.length} linha(s) · Colunas: {raw.headers.join(", ")}
</p>
```

With:

```tsx
<p className="text-xs text-muted-foreground">
   {raw.rows.length} linha(s) · {raw.headers.length} colunas detectadas
</p>
```

**Commit:**

```bash
git add apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/-transactions/statement-import-credenza.tsx
git commit -m "refactor(transactions): redesign MapStep layout for wide credenza"
```

---

### Task 3: Create `useSelectionToolbar` hook

**Files:**

- Create: `apps/web/src/hooks/use-selection-toolbar.tsx`
- Modify: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-transactions/statement-import-credenza.tsx` (PreviewStep)

**What it is:** A hook that owns a `Set<number>` selection state (via `useSet` from foxact) and renders the floating `SelectionActionBar` globally (same `fixed bottom-4 left-1/2` position — it appears above everything). Callers never touch `SelectionActionBar` or `useSet` directly — the hook manages both.

The hook accepts a `children` render prop for the action buttons, so the caller stays in control of what actions are available.

**Create `apps/web/src/hooks/use-selection-toolbar.tsx`:**

```typescript
import { useSet } from "foxact/use-set";
import { SelectionActionBar, SelectionActionButton } from "@packages/ui/components/selection-action-bar";
import { createPortal } from "react-dom";
import { createClientOnlyFn } from "@tanstack/react-start";

const renderPortal = createClientOnlyFn((children: React.ReactNode) =>
   createPortal(children, document.body),
);

export { SelectionActionButton };

export function useSelectionToolbar(
   renderActions: (ctx: {
      selectedIndices: Set<number>;
      clear: () => void;
   }) => React.ReactNode,
) {
   const [selectedIndices, addIndex, removeIndex, clearIndices, replaceIndices] =
      useSet<number>();

   function toggle(index: number) {
      if (selectedIndices.has(index)) {
         removeIndex(index);
      } else {
         addIndex(index);
      }
   }

   const toolbar = renderPortal(
      <SelectionActionBar
         selectedCount={selectedIndices.size}
         onClear={clearIndices}
      >
         {renderActions({ selectedIndices, clear: clearIndices })}
      </SelectionActionBar>,
   );

   return {
      selectedIndices,
      toggle,
      add: addIndex,
      remove: removeIndex,
      clear: clearIndices,
      replace: replaceIndices,
      toolbar,
   };
}
```

> **Note on SSR:** `createPortal` requires the DOM. `createClientOnlyFn` from `@tanstack/react-start` returns `null` on the server and runs the fn on the client. If `createClientOnlyFn` can't be used for this pattern (it's meant for functions not render), use a `useIsomorphicLayoutEffect` guard instead — check `typeof document !== "undefined"` before rendering the portal, defaulting to `null` on SSR.

**Alternative SSR-safe approach** (use this if `createClientOnlyFn` causes issues):

```typescript
import { useSet } from "foxact/use-set";
import { useIsomorphicLayoutEffect } from "foxact/use-isomorphic-layout-effect";
import { useState } from "react";
import { createPortal } from "react-dom";
import { SelectionActionBar, SelectionActionButton } from "@packages/ui/components/selection-action-bar";

export { SelectionActionButton };

export function useSelectionToolbar(
   renderActions: (ctx: {
      selectedIndices: Set<number>;
      clear: () => void;
   }) => React.ReactNode,
) {
   const [mounted, setMounted] = useState(false);
   useIsomorphicLayoutEffect(() => { setMounted(true); }, []);

   const [selectedIndices, addIndex, removeIndex, clearIndices, replaceIndices] =
      useSet<number>();

   function toggle(index: number) {
      if (selectedIndices.has(index)) {
         removeIndex(index);
      } else {
         addIndex(index);
      }
   }

   const toolbar = mounted
      ? createPortal(
           <SelectionActionBar
              selectedCount={selectedIndices.size}
              onClear={clearIndices}
           >
              {renderActions({ selectedIndices, clear: clearIndices })}
           </SelectionActionBar>,
           document.body,
        )
      : null;

   return {
      selectedIndices,
      toggle,
      add: addIndex,
      remove: removeIndex,
      clear: clearIndices,
      replace: replaceIndices,
      toolbar,
   };
}
```

**Update `PreviewStep`** in `statement-import-credenza.tsx`:

Remove:

- `useSet` import from foxact
- `SelectionActionBar`, `SelectionActionButton` imports
- All manual `const [selectedIndices, addIndex, removeIndex, clearIndices, replaceIndices] = useSet<number>();` usage

Add import:

```typescript
import {
   useSelectionToolbar,
   SelectionActionButton,
} from "@/hooks/use-selection-toolbar";
```

Replace the `useSet` call and `SelectionActionBar` JSX with:

```typescript
const { selectedIndices, toggle, clear, replace, toolbar } = useSelectionToolbar(
   ({ selectedIndices: sel, clear }) => (
      <>
         <Popover>
            <PopoverTrigger asChild>
               <SelectionActionButton>Alterar data</SelectionActionButton>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="center" side="top">
               <DatePicker
                  date={bulkDate}
                  onSelect={(d) => { if (d) applyBulkDate(d); }}
                  placeholder="Selecionar data"
               />
            </PopoverContent>
         </Popover>
         <Popover>
            <PopoverTrigger asChild>
               <SelectionActionButton>Alterar categoria</SelectionActionButton>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-2" align="center" side="top">
               <Combobox
                  options={categoryOptions}
                  onValueChange={(v) => { if (v) { applyBulkCategory(v); setBulkCategoryId(""); } }}
                  value={bulkCategoryId}
                  placeholder="Alterar categoria"
                  searchPlaceholder="Buscar categoria..."
                  emptyMessage="Nenhuma categoria"
                  className="w-full"
               />
            </PopoverContent>
         </Popover>
      </>
   ),
);
```

Replace all `addIndex` → `add`, `removeIndex` → `remove`, `clearIndices` → `clear`, `replaceIndices` → `replace` in the component body.

Render `{toolbar}` anywhere in the JSX return (e.g. just before `</CredenzaBody>`) — it will portal to `document.body`.

Remove the old `<SelectionActionBar>...</SelectionActionBar>` block entirely.

**Commit:**

```bash
git add apps/web/src/hooks/use-selection-toolbar.tsx apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/-transactions/statement-import-credenza.tsx
git commit -m "feat(hooks): useSelectionToolbar — selection state + global floating toolbar"
```

---

### Task 4: Add Categoria column to PreviewStep table

**Files:**

- Modify: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-transactions/statement-import-credenza.tsx` (PreviewStep table, lines ~767–994)

**What to add:** A "Categoria" column between Tipo and Valor. Show the category name when `row.categoryId` is set, "—" otherwise. Categories are already available as `categoryOptions` inside `PreviewStep`.

Build a lookup map at the top of `PreviewStep` (after `categoryOptions`):

```typescript
const categoryMap = new Map(categories.map((c) => [c.id, c.name]));
```

**Update the header grid** — current: `grid-cols-[2rem_6rem_1fr_4rem_5.5rem_2rem]`

New: `grid-cols-[2rem_6rem_1fr_4rem_6rem_5.5rem_2rem]`

Add the header cell after Tipo:

```tsx
<span className="text-xs font-medium text-muted-foreground">Categoria</span>
```

**Update each row grid** — same columns change on the row `className`.

Add the category cell after the Badge (Tipo):

```tsx
<span className="text-xs text-muted-foreground truncate">
   {row.categoryId ? (categoryMap.get(row.categoryId) ?? "—") : "—"}
</span>
```

**Commit:**

```bash
git add apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/-transactions/statement-import-credenza.tsx
git commit -m "feat(transactions): add Categoria column to import preview table"
```

---

### Task 5: Verify `categoryId` flows through to import

**Files:**

- Read: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-transactions/use-statement-import.ts` — `buildImportPayload`
- Read: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-transactions/statement-import-credenza.tsx` — `ConfirmStep` import call

Check that `buildImportPayload` includes `categoryId` and that `ConfirmStep`'s `importStatement` mutation passes it through. If `categoryId` is missing from the payload or the mutation input, add it. The router at `apps/web/src/integrations/orpc/router/transactions.ts` (`importStatement`) already accepts `categoryId: z.string().uuid().optional()`.

**Commit only if a bug is found:**

```bash
git add apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/-transactions/use-statement-import.ts apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/-transactions/statement-import-credenza.tsx
git commit -m "fix(transactions): ensure categoryId flows through import payload"
```

---

## Done

```
apps/web/src/hooks/
  use-cnpj.ts              ← renamed from use-cnpj-data, internal helpers, unified return

statement-import-credenza.tsx
  ← MapStep: 2-col card layout, sample values inline below selector
  ← PreviewStep: SelectionActionBar variant="inline" (no viewport overlap)
  ← PreviewStep: Categoria column in table

packages/ui/src/components/selection-action-bar.tsx
  ← variant="fixed" (default) | "inline" (for modals)
```
