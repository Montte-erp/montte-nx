# Data Table Inline Editing via ColumnMeta — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add generic inline cell editing to `DataTable` via `ColumnMeta` — no modals, TanStack Form per cell with dynamic Zod schema validation, optimistic updates, Tab navigation, optional popover mode for larger inputs (e.g. textarea for description). Wire it into Centro de Custo (tags) table, removing the edit credenza.

**Architecture:** Extend `ColumnMeta` with `isEditable`, `cellComponent`, `editMode`, `editOptions`, `editSchema` (Zod), `onSave`, and `isEditableForRow`. Add an `EditableCell` component inside `data-table.tsx` that uses `useForm` from `@tanstack/react-form` for submission/reset/validation, owns a `localValue` for optimistic display, and renders either inline or inside a `Popover`. Zod v4 implements Standard Schema, so schemas pass directly to `form.Field validators.onChange` — no adapter needed. Wire it into `DataTableBodyRow` by detecting `meta.isEditable && meta.cellComponent`. For tags: remove the Pencil edit button, remove `handleEdit`/`useCredenza` for edits, add an `update` mutation, pass `onUpdate` to `buildTagColumns`.

**Tech Stack:** `@tanstack/react-form` v1.29 + Zod v4 Standard Schema (native, no adapter), `packages/ui/src/components/data-table.tsx`, `packages/ui/src/components/popover.tsx`, shadcn `Input`, `Select`, `Textarea`.

---

## Task 1: Extend ColumnMeta

**Files:**
- Modify: `packages/ui/src/components/data-table.tsx:99-107`

**Step 1: Replace the ColumnMeta declaration block**

Lines 99–107 become:

```ts
import type { ZodTypeAny } from "zod";

declare module "@tanstack/react-table" {
   // oxlint-ignore @typescript-eslint/no-unused-vars
   interface ColumnMeta<TData extends RowData, TValue> {
      label?: string;
      filterVariant?: "text" | "select" | "range" | "date";
      align?: "left" | "center" | "right";
      exportable?: boolean;
      isEditable?: boolean;
      cellComponent?: "text" | "textarea" | "select";
      editMode?: "inline" | "popover";
      editOptions?: Array<{ label: string; value: string }>;
      editSchema?: ZodTypeAny;
      onSave?: (rowId: string, value: unknown) => Promise<void>;
      isEditableForRow?: (row: TData) => boolean;
   }
}
```

The `import type { ZodTypeAny } from "zod"` must go at the top of `data-table.tsx` with the other imports. Add it there.

**Why Zod v4 + TanStack Form v1 works without an adapter:** Zod v4 implements the [Standard Schema spec](https://standardschema.dev). TanStack Form v1 accepts any Standard Schema value directly in `validators.onChange` — the same object shape works for validation. No `@tanstack/zod-form-adapter` needed.

**Step 2: Add Popover + Textarea to the import block at the top of the file**

`data-table.tsx` already imports from `./select`. Add:

```ts
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { Textarea } from "./textarea";
```

Also add `useForm` to existing imports (add a new import line):

```ts
import { useForm } from "@tanstack/react-form";
```

**Step 3: Run typecheck**

```bash
bun run typecheck
```

Expected: passes (only added optional fields, and new imports resolve).

**Step 4: Commit**

```bash
git add packages/ui/src/components/data-table.tsx
git commit -m "feat(data-table): extend ColumnMeta with inline editing fields"
```

---

## Task 2: Build EditableCell component

**Files:**
- Modify: `packages/ui/src/components/data-table.tsx` — insert `EditableCell` after the helpers section (after `getPageNumbers`, before `SortableHeaderCell`)

### Architecture

`EditableCell` owns:
- `editing` boolean — controls whether to show display or edit UI
- `localValue` — optimistic display value; updated immediately on save, reverted on error
- A `useForm` instance per edit session — handles submission, async error boundary, reset on cancel
- Inline or popover rendering based on `editMode`

**Display mode** (shared between inline and popover — always renders as a clickable div):

```tsx
<div
   data-editable-cell
   data-editable-cell-id={cellId}
   className="cursor-pointer rounded px-1 -mx-1 hover:bg-muted/50 min-h-[1.5rem] flex items-center w-full"
   onClick={() => setEditing(true)}
   onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setEditing(true); }}
   role="button"
   tabIndex={0}
>
   {cellComponent === "select"
      ? options?.find((o) => o.value === displayValue)?.label ?? displayValue
      : displayValue}
</div>
```

**Edit fields** (reused by both inline and popover):

- `"text"` → `<input type="text" />` (uncontrolled, reads `e.currentTarget.value` on blur/submit)
- `"textarea"` → `<Textarea />` (popover only — auto-focus, submit on Ctrl+Enter or the Save button)
- `"select"` → `<Select open onOpenChange={...} />` — commits immediately on value change, no explicit Save

**Step 1: Insert EditableCell component**

Insert this entire block after the `getPageNumbers` function and before `SortableHeaderCell`:

```tsx
// =============================================================================
// Editable cell
// =============================================================================

function EditableCell<TData>({
   value: initialValue,
   cellComponent,
   editMode = "inline",
   options,
   schema,
   onSave,
   rowId,
   cellId,
}: {
   value: unknown;
   cellComponent: "text" | "textarea" | "select";
   editMode?: "inline" | "popover";
   options?: Array<{ label: string; value: string }>;
   schema?: ZodTypeAny;
   onSave?: (rowId: string, value: unknown) => Promise<void>;
   rowId: string;
   cellId: string;
}) {
   const [editing, setEditing] = useState(false);
   const [localValue, setLocalValue] = useState<unknown>(initialValue);
   const inputRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);

   useEffect(() => {
      setLocalValue(initialValue);
   }, [initialValue]);

   useEffect(() => {
      if (editing && editMode === "inline") {
         inputRef.current?.focus();
      }
   }, [editing, editMode]);

   const form = useForm({
      defaultValues: { value: String(localValue ?? "") },
      onSubmitAsync: async ({ value }) => {
         const prev = localValue;
         setLocalValue(value.value);
         setEditing(false);
         try {
            await onSave?.(rowId, value.value);
         } catch {
            setLocalValue(prev);
         }
      },
   });

   const cancel = useCallback(() => {
      form.reset();
      setEditing(false);
   }, [form]);

   const focusNext = useCallback(() => {
      const all = Array.from(
         document.querySelectorAll<HTMLElement>("[data-editable-cell]"),
      );
      const idx = all.findIndex(
         (el) => el.dataset.editableCellId === cellId,
      );
      all[idx + 1]?.click();
   }, [cellId]);

   const displayValue = String(localValue ?? "");

   const displayNode = (
      <div
         data-editable-cell
         data-editable-cell-id={cellId}
         className="cursor-pointer rounded px-1 -mx-1 hover:bg-muted/50 min-h-[1.5rem] flex items-center w-full text-sm"
         onClick={() => setEditing(true)}
         onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") setEditing(true);
         }}
         role="button"
         tabIndex={0}
      >
         {cellComponent === "select"
            ? (options?.find((o) => o.value === displayValue)?.label ??
               displayValue)
            : displayValue || (
               <span className="text-muted-foreground/40">—</span>
            )}
      </div>
   );

   if (!editing) return displayNode;

   const editFields = (
      <form
         onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
         }}
      >
         {cellComponent === "select" && (
            <Select
               value={String(localValue ?? "")}
               onValueChange={(v) => {
                  setLocalValue(v);
                  setEditing(false);
                  onSave?.(rowId, v).catch(() => setLocalValue(localValue));
               }}
               open
               onOpenChange={(open) => {
                  if (!open) cancel();
               }}
            >
               <SelectTrigger className="h-7 text-sm">
                  <SelectValue />
               </SelectTrigger>
               <SelectContent>
                  {options?.map((opt) => (
                     <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                     </SelectItem>
                  ))}
               </SelectContent>
            </Select>
         )}

         {cellComponent === "text" && (
            <form.Field
               name="value"
               validators={schema ? { onChange: schema, onBlur: schema } : undefined}
            >
               {(field) => (
                  <div className="flex flex-col gap-1">
                     <input
                        ref={inputRef}
                        type="text"
                        aria-invalid={
                           field.state.meta.isTouched &&
                           field.state.meta.errors.length > 0
                        }
                        className="h-7 w-full rounded border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring/50 aria-invalid:border-destructive"
                        defaultValue={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={(e) => {
                           field.handleChange(e.target.value);
                           field.handleBlur();
                           form.handleSubmit();
                        }}
                        onKeyDown={(e) => {
                           if (e.key === "Escape") {
                              e.preventDefault();
                              cancel();
                           }
                           if (e.key === "Tab") {
                              e.preventDefault();
                              field.handleChange(
                                 (e.target as HTMLInputElement).value,
                              );
                              form.handleSubmit().then(focusNext);
                           }
                        }}
                     />
                     {field.state.meta.isTouched &&
                        field.state.meta.errors.length > 0 && (
                           <span className="text-xs text-destructive">
                              {field.state.meta.errors[0]?.message}
                           </span>
                        )}
                  </div>
               )}
            </form.Field>
         )}

         {cellComponent === "textarea" && (
            <div className="flex flex-col gap-2">
               <form.Field
                  name="value"
                  validators={schema ? { onChange: schema, onBlur: schema } : undefined}
               >
                  {(field) => (
                     <>
                        <Textarea
                           ref={inputRef}
                           aria-invalid={
                              field.state.meta.isTouched &&
                              field.state.meta.errors.length > 0
                           }
                           className="min-h-[80px] text-sm resize-none aria-invalid:border-destructive"
                           defaultValue={field.state.value}
                           onChange={(e) => field.handleChange(e.target.value)}
                           onBlur={() => field.handleBlur()}
                           onKeyDown={(e) => {
                              if (e.key === "Escape") {
                                 e.preventDefault();
                                 cancel();
                              }
                              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                                 e.preventDefault();
                                 field.handleChange(
                                    (e.target as HTMLTextAreaElement).value,
                                 );
                                 form.handleSubmit();
                              }
                           }}
                           placeholder="Adicionar descrição..."
                        />
                        {field.state.meta.isTouched &&
                           field.state.meta.errors.length > 0 && (
                              <span className="text-xs text-destructive">
                                 {field.state.meta.errors[0]?.message}
                              </span>
                           )}
                     </>
                  )}
               </form.Field>
               <div className="flex justify-end gap-2">
                  <Button
                     type="button"
                     variant="outline"
                     size="sm"
                     onClick={cancel}
                  >
                     Cancelar
                  </Button>
                  <Button type="submit" size="sm">
                     Salvar
                  </Button>
               </div>
            </div>
         )}
      </form>
   );

   if (editMode === "popover") {
      return (
         <Popover
            open
            onOpenChange={(open) => {
               if (!open) cancel();
            }}
         >
            <PopoverTrigger asChild>{displayNode}</PopoverTrigger>
            <PopoverContent
               className="w-80"
               onOpenAutoFocus={(e) => {
                  e.preventDefault();
                  inputRef.current?.focus();
               }}
            >
               {editFields}
            </PopoverContent>
         </Popover>
      );
   }

   return editFields;
}
```

**Step 2: Run typecheck**

```bash
bun run typecheck
```

Expected: passes.

**Step 3: Commit**

```bash
git add packages/ui/src/components/data-table.tsx
git commit -m "feat(data-table): add EditableCell with TanStack Form and popover support"
```

---

## Task 3: Wire EditableCell into DataTableBodyRow

**Files:**
- Modify: `packages/ui/src/components/data-table.tsx` — the depth-0 cell rendering in `DataTableBodyRow` (~line 497)

Currently:

```tsx
{row.getVisibleCells().map((cell) => (
   <TableCell ...>
      {flexRender(cell.column.columnDef.cell, cell.getContext())}
   </TableCell>
))}
```

**Step 1: Replace with editable-aware rendering**

```tsx
{row.getVisibleCells().map((cell) => {
   const meta = cell.column.columnDef.meta;
   const isEditable =
      meta?.isEditable &&
      meta.cellComponent &&
      (!meta.isEditableForRow ||
         meta.isEditableForRow(row.original));
   return (
      <TableCell
         className={cn(
            "truncate",
            cell.column.getIsPinned() && "sticky z-[1] bg-inherit",
            meta?.align === "right" && "text-right",
            meta?.align === "center" && "text-center",
         )}
         key={cell.id}
         style={{
            maxWidth: cell.column.columnDef.maxSize,
            ...getPinningOffsets(cell.column),
         }}
      >
         {isEditable ? (
            <EditableCell
               cellComponent={meta!.cellComponent!}
               cellId={cell.id}
               editMode={meta?.editMode}
               options={meta?.editOptions}
               schema={meta?.editSchema}
               onSave={meta?.onSave}
               rowId={row.id}
               value={cell.getValue()}
            />
         ) : (
            flexRender(cell.column.columnDef.cell, cell.getContext())
         )}
      </TableCell>
   );
})}
```

**Step 2: Run typecheck**

```bash
bun run typecheck
```

Expected: passes.

**Step 3: Commit**

```bash
git add packages/ui/src/components/data-table.tsx
git commit -m "feat(data-table): wire EditableCell into DataTableBodyRow"
```

---

## Task 4: Verify generic implementation

**Step 1: Run full typecheck + lint**

```bash
bun run typecheck && bun run check
```

Expected: both pass. No existing column defs break because all new fields are optional.

**Step 2: Commit any lint auto-fixes**

```bash
git add -p
git commit -m "fix(data-table): lint after inline editing implementation"
```

---

## Task 5: Update Centro de Custo table

**Files:**
- Modify: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-tags/tags-columns.tsx`
- Modify: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/tags.tsx`

### 5a — Rewrite tags-columns.tsx

Remove the `color` column entirely. Add inline editing for `name` and popover-textarea editing for `description`. `buildTagColumns` now accepts an optional `onUpdate` (optional so skeleton usage at module level still works without args).

Full replacement:

```tsx
import {
   Tooltip,
   TooltipContent,
   TooltipTrigger,
} from "@packages/ui/components/tooltip";
import type { ColumnDef } from "@tanstack/react-table";
import { Archive, ShieldCheck, Tags } from "lucide-react";
import { z } from "zod";
import {
   Announcement,
   AnnouncementTag,
   AnnouncementTitle,
} from "@/components/blocks/announcement";
import type { Outputs } from "@/integrations/orpc/client";

const tagNameSchema = z
   .string()
   .min(2, "Mínimo 2 caracteres")
   .max(120, "Máximo 120 caracteres");

const tagDescriptionSchema = z
   .string()
   .max(255, "Máximo 255 caracteres")
   .optional();

export type TagRow = Outputs["tags"]["getAll"]["data"][number];

type OnUpdate = (
   id: string,
   patch: { name?: string; description?: string | null },
) => Promise<void>;

export function buildTagColumns(options?: {
   onUpdate?: OnUpdate;
}): ColumnDef<TagRow>[] {
   return [
      {
         accessorKey: "name",
         header: "Nome",
         meta: {
            label: "Nome",
            exportable: true,
            isEditable: true,
            cellComponent: "text",
            editMode: "inline",
            editSchema: tagNameSchema,
            isEditableForRow: (row: TagRow) =>
               !row.isDefault && !row.isArchived,
            onSave: options?.onUpdate
               ? async (rowId, value) => {
                    await options.onUpdate!(rowId, { name: String(value) });
                 }
               : undefined,
         },
         enableSorting: false,
         cell: ({ row }) => {
            const { name, isDefault, isArchived } = row.original;
            if (isDefault) {
               return (
                  <Announcement className="cursor-default w-fit">
                     <AnnouncementTag>
                        <ShieldCheck aria-hidden="true" className="size-4" />
                        <span className="sr-only">Padrão</span>
                     </AnnouncementTag>
                     <AnnouncementTitle>
                        {name}
                        {isArchived && (
                           <Tooltip>
                              <TooltipTrigger asChild>
                                 <span
                                    aria-label="Arquivado"
                                    className="inline-flex shrink-0 cursor-default"
                                    tabIndex={0}
                                 >
                                    <Archive
                                       aria-hidden="true"
                                       className="size-4 text-muted-foreground"
                                    />
                                 </span>
                              </TooltipTrigger>
                              <TooltipContent>Arquivado</TooltipContent>
                           </Tooltip>
                        )}
                     </AnnouncementTitle>
                  </Announcement>
               );
            }
            return (
               <div className="flex items-center gap-2">
                  <span className="text-sm">{name}</span>
                  {isArchived && (
                     <Tooltip>
                        <TooltipTrigger asChild>
                           <span
                              aria-label="Arquivado"
                              className="inline-flex shrink-0 cursor-default"
                              tabIndex={0}
                           >
                              <Archive
                                 aria-hidden="true"
                                 className="size-4 text-muted-foreground"
                              />
                           </span>
                        </TooltipTrigger>
                        <TooltipContent>Arquivado</TooltipContent>
                     </Tooltip>
                  )}
               </div>
            );
         },
      },
      {
         accessorKey: "description",
         header: "Descrição",
         meta: {
            label: "Descrição",
            exportable: true,
            isEditable: true,
            cellComponent: "textarea",
            editMode: "popover",
            editSchema: tagDescriptionSchema,
            isEditableForRow: (row: TagRow) => !row.isArchived,
            onSave: options?.onUpdate
               ? async (rowId, value) => {
                    const trimmed = String(value).trim();
                    await options.onUpdate!(rowId, {
                       description: trimmed.length > 0 ? trimmed : null,
                    });
                 }
               : undefined,
         },
         enableSorting: false,
         cell: ({ row }) =>
            row.original.description ? (
               <span className="text-sm text-muted-foreground truncate">
                  {row.original.description}
               </span>
            ) : (
               <span className="text-sm text-muted-foreground/40">—</span>
            ),
      },
      {
         id: "keywords",
         header: "Palavras-chave",
         meta: { label: "Palavras-chave" },
         enableSorting: false,
         accessorFn: (row) => row.keywords?.join(", ") ?? "",
         cell: ({ row }) => {
            const keywords = row.original.keywords;
            const count = keywords?.length ?? 0;
            if (count === 0)
               return (
                  <span className="text-sm text-muted-foreground">—</span>
               );
            return (
               <Tooltip>
                  <TooltipTrigger asChild>
                     <Announcement className="cursor-default w-fit">
                        <AnnouncementTag>
                           <Tags className="size-4" />
                        </AnnouncementTag>
                        <AnnouncementTitle className="text-xs">
                           {count} {count === 1 ? "palavra" : "palavras"}
                        </AnnouncementTitle>
                     </Announcement>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-72">
                     <p className="font-semibold text-sm">Palavras-chave IA</p>
                     <p className="text-xs text-muted-foreground">
                        Geradas automaticamente com base no nome e descrição do
                        centro de custo.
                     </p>
                     <p className="text-xs">{keywords!.join(", ")}</p>
                  </TooltipContent>
               </Tooltip>
            );
         },
      },
   ];
}
```

**Key decisions:**
- `color` column dropped entirely
- `name`: `editMode: "inline"`, only for `!isDefault && !isArchived`; default tags keep their `Announcement` badge (rendered by `cell` function since `isEditableForRow` returns false)
- `description`: `editMode: "popover"` with `cellComponent: "textarea"`, editable for all non-archived; empty string → `null`
- `onUpdate` optional — skeleton call at module level (`buildTagColumns()`) works without args

### 5b — Update tags.tsx

Changes needed:
1. Remove `handleEdit` callback and its `openCredenza` / `TagForm` usage for the edit case
2. Remove `Pencil` import from lucide-react (keep `Archive`, `ArchiveRestore`, `Trash2`, `Plus`, `Tag`)
3. Remove `useCredenza` import and usage (if not used elsewhere — check; it's used for `handleCreate`, so keep it)
4. Add `updateMutation` using `orpc.tags.update`
5. Pass `onUpdate` to `buildTagColumns` inside `useMemo`
6. Remove the Pencil button from `renderActions` for non-archived rows

**The `renderActions` for non-archived rows** goes from three buttons (Pencil, Archive, Trash) to two (Archive, Trash):

```tsx
// Non-archived rows — remove Pencil button
return (
   <>
      <Button
         onClick={() => handleArchive(row.original)}
         tooltip="Arquivar"
         variant="outline"
      >
         <Archive />
      </Button>
      <Button
         className="text-destructive hover:text-destructive"
         onClick={() => handleDelete(row.original)}
         tooltip="Excluir"
         variant="outline"
      >
         <Trash2 />
      </Button>
   </>
);
```

**Add `updateMutation`** (alongside existing mutations):

```tsx
const updateMutation = useMutation(
   orpc.tags.update.mutationOptions({
      onError: (e) =>
         toast.error(e.message || "Erro ao atualizar centro de custo."),
   }),
);
```

**Update `columns` useMemo**:

```tsx
const teamId = useActiveTeam().id; // or however teamId is accessed in this component

const columns = useMemo(
   () =>
      buildTagColumns({
         onUpdate: async (id, patch) => {
            await updateMutation.mutateAsync({ id, teamId, ...patch });
         },
      }),
   [updateMutation, teamId],
);
```

**Check how `teamId` is obtained in this file:** Look for existing `useActiveTeam` or `Route.useParams()` usage in the file. The route is `/_authenticated/$slug/$teamSlug/_dashboard/tags` — use `useTeamSlug()` from `@/hooks/use-dashboard-slugs` if needed, or look for existing team context usage in the component.

**Remove unused imports** after the above changes:
- `Pencil` from `lucide-react`
- `handleEdit` callback and its body
- `TagForm` import from `./-tags/tags-form` (only if not used elsewhere in the file — the create credenza still uses it, so keep it)

**Step 1: Apply tags-columns.tsx replacement**

Replace file content with the full version from 5a above.

**Step 2: Apply tags.tsx changes**

- Add `updateMutation`
- Remove `handleEdit` and the Pencil button
- Update `columns` useMemo with `onUpdate`
- Remove `Pencil` from lucide imports

**Step 3: Run typecheck**

```bash
bun run typecheck
```

Expected: passes.

**Step 4: Run lint**

```bash
bun run check
```

Expected: passes.

**Step 5: Commit**

```bash
git add \
  packages/ui/src/components/data-table.tsx \
  apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-tags/tags-columns.tsx \
  apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/tags.tsx
git commit -m "feat(tags): inline editing for name and description, remove edit credenza"
```

---

## Summary of changes

| File | Change |
|------|--------|
| `packages/ui/src/components/data-table.tsx` | Extend `ColumnMeta`, add `EditableCell` (TanStack Form + popover), wire in `DataTableBodyRow` |
| `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-tags/tags-columns.tsx` | Drop color column, add inline editing for name, popover-textarea for description |
| `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/tags.tsx` | Remove Pencil/edit credenza, add `updateMutation`, wire `onUpdate` into columns |

No new files. No new dependencies (all already in `packages/ui/package.json`). No modals or credenzas added.

## Consumer pattern (for reference — other tables)

Schemas must be defined at **module level** (never inside a component/useMemo — CLAUDE.md rule).

```tsx
import { z } from "zod";

// Module level — never inside useMemo or component
const nameSchema = z.string().min(2, "Mínimo 2 caracteres").max(120);
const notesSchema = z.string().max(500, "Máximo 500 caracteres").optional();

function MyTable() {
   const columns = useMemo(
      () => [
         {
            accessorKey: "name",
            header: "Nome",
            meta: {
               isEditable: true,
               cellComponent: "text" as const,
               editMode: "inline" as const,
               editSchema: nameSchema,
               onSave: async (rowId: string, value: unknown) => {
                  await updateMutation.mutateAsync({ id: rowId, name: String(value) });
               },
            },
         },
         {
            accessorKey: "notes",
            header: "Observações",
            meta: {
               isEditable: true,
               cellComponent: "textarea" as const,
               editMode: "popover" as const,
               editSchema: notesSchema,
               onSave: async (rowId: string, value: unknown) => {
                  await updateMutation.mutateAsync({ id: rowId, notes: String(value) || null });
               },
            },
         },
         {
            accessorKey: "status",
            header: "Status",
            meta: {
               isEditable: true,
               cellComponent: "select" as const,
               editMode: "inline" as const,
               // select has no editSchema — validation is implicit (must be one of editOptions)
               editOptions: [
                  { label: "Ativo", value: "active" },
                  { label: "Inativo", value: "inactive" },
               ],
               onSave: async (rowId: string, value: unknown) => {
                  await updateMutation.mutateAsync({ id: rowId, status: String(value) });
               },
            },
         },
      ],
      [updateMutation],
   );
}
```

### How validation works

- `editSchema` is a Zod v4 schema — passed to `form.Field validators={{ onChange: schema, onBlur: schema }}`
- Zod v4 implements Standard Schema — TanStack Form v1 accepts it natively, no adapter
- Field shows `field.state.meta.errors[0]?.message` when `isTouched && errors.length > 0`
- `onSubmitAsync` is NOT called when validation fails — TanStack Form blocks it automatically
- For `"select"`, `editSchema` is ignored (commits immediately on change, no input to validate)
