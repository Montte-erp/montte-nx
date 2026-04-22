# Contacts — Native Table Create, Move Columns File

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace `ContactForm` credenza with native `onAddRow`. Move `contacts-columns.tsx` from `features/contacts/ui/` to colocated `-contacts/` folder. Delete `features/contacts/ui/contacts-form.tsx`.

**Architecture:** Add `cellComponent: "text"` to `name` column and `cellComponent: "select"` to `type` column for inline creation. Wire `isDraftRowActive`/`onAddRow`/`onDiscardAddRow` on `DataTableRoot`. Remove the "Novo Contato" button from `DefaultHeader.actions` (replaced by native add row in toolbar). Move `contacts-columns.tsx` to the colocated `-contacts/` folder and update all imports.

**Tech Stack:** TanStack Query, `DataTableRoot`, `orpc.contacts.create`

---

### Task 1: Move `contacts-columns.tsx` to colocated folder

**Files:**
- Source: `apps/web/src/features/contacts/ui/contacts-columns.tsx`
- Destination: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-contacts/contacts-columns.tsx`

**Step 1: Create destination directory if needed and copy the file**

```bash
mkdir -p "apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/-contacts"
cp "apps/web/src/features/contacts/ui/contacts-columns.tsx" "apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/-contacts/contacts-columns.tsx"
```

**Step 2: Verify the import path in `contacts.tsx`**

The current import is:
```typescript
import {
   buildContactColumns,
   type ContactRow,
} from "@/features/contacts/ui/contacts-columns";
```

This will be updated in Task 2 to:
```typescript
import {
   buildContactColumns,
   type ContactRow,
} from "./-contacts/contacts-columns";
```

---

### Task 2: Update `contacts-columns.tsx` — add `cellComponent` meta

**Files:**
- Modify: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-contacts/contacts-columns.tsx`

**Step 1: Add z import**

Add at the top:
```typescript
import { z } from "zod";
```

**Step 2: Update `name` column — add meta**

```typescript
{
   accessorKey: "name",
   header: "Nome",
   meta: {
      label: "Nome",
      cellComponent: "text" as const,
      editSchema: z.string().min(1, "Nome é obrigatório."),
   },
   cell: ({ row }) => (
      <span className="font-medium">{row.original.name}</span>
   ),
},
```

**Step 3: Update `type` column — add meta**

```typescript
{
   accessorKey: "type",
   header: "Tipo",
   meta: {
      label: "Tipo",
      cellComponent: "select" as const,
      editOptions: [
         { value: "cliente", label: "Cliente" },
         { value: "fornecedor", label: "Fornecedor" },
         { value: "ambos", label: "Ambos" },
      ],
      editSchema: z.enum(["cliente", "fornecedor", "ambos"]),
   },
   cell: ({ row }) => (
      <Badge variant={TYPE_VARIANTS[row.original.type]}>
         {TYPE_LABELS[row.original.type]}
      </Badge>
   ),
},
```

---

### Task 3: Rewrite `contacts.tsx` — remove form, add native create

**Files:**
- Modify: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/contacts.tsx`

**Step 1: Replace the file content**

```tsx
import { Button } from "@packages/ui/components/button";
import {
   Empty,
   EmptyDescription,
   EmptyHeader,
   EmptyMedia,
   EmptyTitle,
} from "@packages/ui/components/empty";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Plus, Trash2, Users } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { DefaultHeader } from "@/components/default-header";
import {
   EarlyAccessBanner,
   type EarlyAccessBannerTemplate,
} from "@/features/billing/ui/early-access-banner";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { QueryBoundary } from "@/components/query-boundary";
import {
   DataTableBulkActions,
   SelectionActionButton,
} from "@/components/data-table/data-table-bulk-actions";
import { DataTableContent } from "@/components/data-table/data-table-content";
import { DataTableEmptyState } from "@/components/data-table/data-table-empty-state";
import {
   DataTableExternalFilter,
   DataTableRoot,
} from "@/components/data-table/data-table-root";
import { DataTableSkeleton } from "@/components/data-table/data-table-skeleton";
import { DataTableToolbar } from "@/components/data-table/data-table-toolbar";
import { orpc } from "@/integrations/orpc/client";
import {
   buildContactColumns,
   type ContactRow,
} from "./-contacts/contacts-columns";

const tableSearchSchema = z.object({
   sorting: z
      .array(z.object({ id: z.string(), desc: z.boolean() }))
      .catch([])
      .default([]),
   columnFilters: z
      .array(z.object({ id: z.string(), value: z.unknown() }))
      .catch([])
      .default([]),
   typeFilter: z
      .enum(["all", "cliente", "fornecedor", "ambos"])
      .catch("all")
      .default("all"),
});

type TypeFilter = "all" | "cliente" | "fornecedor" | "ambos";

const TYPE_FILTER_LABELS: Record<TypeFilter, string> = {
   all: "Todos",
   cliente: "Clientes",
   fornecedor: "Fornecedores",
   ambos: "Ambos",
};

const CONTACTS_BANNER: EarlyAccessBannerTemplate = {
   badgeLabel: "Contatos",
   message: "Esta funcionalidade está em fase alpha.",
   ctaLabel: "Deixar feedback",
   stage: "alpha",
   icon: Users,
   bullets: [
      "Cadastre clientes e fornecedores",
      "Vincule contatos a transações e cobranças",
      "Seu feedback nos ajuda a melhorar",
   ],
};

const skeletonColumns = buildContactColumns();

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/contacts",
)({
   validateSearch: tableSearchSchema,
   loader: ({ context }) => {
      context.queryClient.prefetchQuery(orpc.contacts.getAll.queryOptions({}));
   },
   pendingMs: 300,
   pendingComponent: ContactsSkeleton,
   head: () => ({
      meta: [{ title: "Contatos — Montte" }],
   }),
   component: ContactsPage,
});

function ContactsSkeleton() {
   return <DataTableSkeleton columns={skeletonColumns} />;
}

function ContactsList() {
   const navigate = Route.useNavigate();
   const { sorting, columnFilters, typeFilter } = Route.useSearch();
   const { openAlertDialog } = useAlertDialog();

   const { data: contacts } = useSuspenseQuery(
      orpc.contacts.getAll.queryOptions({
         input: typeFilter !== "all" ? { type: typeFilter } : {},
      }),
   );

   const createMutation = useMutation(
      orpc.contacts.create.mutationOptions({
         onSuccess: () => toast.success("Contato criado com sucesso."),
         onError: (e) => toast.error(e.message),
      }),
   );

   const deleteMutation = useMutation(
      orpc.contacts.remove.mutationOptions({
         onSuccess: () => {
            toast.success("Contato excluído com sucesso.");
         },
         onError: (error) => {
            toast.error(error.message || "Erro ao excluir contato.");
         },
      }),
   );

   const bulkDeleteMutation = useMutation(
      orpc.contacts.bulkRemove.mutationOptions({
         onSuccess: () => {
            toast.success("Contatos excluídos com sucesso");
         },
         onError: () => {
            toast.error("Erro ao excluir contatos");
         },
      }),
   );

   const [isDraftActive, setIsDraftActive] = useState(false);

   const handleDiscardDraft = useCallback(() => setIsDraftActive(false), []);

   const handleAddContact = useCallback(
      async (data: Record<string, string | string[]>) => {
         const name = String(data.name ?? "").trim();
         const type = String(data.type ?? "") as ContactRow["type"];
         if (!name || !type) return;
         await createMutation.mutateAsync({ name, type });
         setIsDraftActive(false);
      },
      [createMutation],
   );

   const handleDelete = useCallback(
      (contact: ContactRow) => {
         openAlertDialog({
            title: "Excluir contato",
            description: `Tem certeza que deseja excluir "${contact.name}"? Esta ação não pode ser desfeita.`,
            actionLabel: "Excluir",
            cancelLabel: "Cancelar",
            variant: "destructive",
            onAction: async () => {
               await deleteMutation.mutateAsync({ id: contact.id });
            },
         });
      },
      [openAlertDialog, deleteMutation],
   );

   const columns = useMemo(() => buildContactColumns(), []);

   return (
      <DataTableRoot
         columns={columns}
         data={contacts as ContactRow[]}
         getRowId={(row) => row.id}
         storageKey="montte:datatable:contacts"
         sorting={sorting}
         onSortingChange={(updater) => {
            const next =
               typeof updater === "function" ? updater(sorting) : updater;
            navigate({
               search: (prev) => ({ ...prev, sorting: next }),
               replace: true,
            });
         }}
         columnFilters={columnFilters}
         onColumnFiltersChange={(updater) => {
            const next =
               typeof updater === "function"
                  ? updater(columnFilters)
                  : updater;
            navigate({
               search: (prev) => ({ ...prev, columnFilters: next }),
               replace: true,
            });
         }}
         isDraftRowActive={isDraftActive}
         onAddRow={handleAddContact}
         onDiscardAddRow={handleDiscardDraft}
         renderActions={({ row }) => (
            <>
               <Button
                  className="text-destructive hover:text-destructive"
                  onClick={() => handleDelete(row.original)}
                  tooltip="Excluir"
                  variant="outline"
               >
                  <Trash2 className="size-4" />
               </Button>
            </>
         )}
      >
         {(["cliente", "fornecedor", "ambos"] as const).map((key) => (
            <DataTableExternalFilter
               key={key}
               id={`type:${key}`}
               label={TYPE_FILTER_LABELS[key]}
               group="Tipo de contato"
               active={typeFilter === key}
               onToggle={(active) =>
                  navigate({
                     search: (prev) => ({
                        ...prev,
                        typeFilter: active ? key : "all",
                     }),
                     replace: true,
                  })
               }
            />
         ))}
         <DataTableToolbar>
            <Button
               onClick={() => setIsDraftActive(true)}
               size="icon-sm"
               tooltip="Novo Contato"
               variant="outline"
            >
               <Plus />
            </Button>
         </DataTableToolbar>
         <DataTableContent />
         <DataTableEmptyState>
            <Empty>
               <EmptyHeader>
                  <EmptyMedia variant="icon">
                     <Users className="size-6" />
                  </EmptyMedia>
                  <EmptyTitle>Nenhum contato</EmptyTitle>
                  <EmptyDescription>
                     Cadastre clientes e fornecedores para organizar suas
                     transações.
                  </EmptyDescription>
               </EmptyHeader>
            </Empty>
         </DataTableEmptyState>
         <DataTableBulkActions<ContactRow>>
            {({ selectedRows, clearSelection }) => (
               <SelectionActionButton
                  icon={<Trash2 className="size-3.5" />}
                  variant="destructive"
                  onClick={() => {
                     const ids = selectedRows.map((r) => r.id);
                     openAlertDialog({
                        title: `Excluir ${ids.length} ${ids.length === 1 ? "contato" : "contatos"}`,
                        description:
                           "Tem certeza que deseja excluir os contatos selecionados? Esta ação não pode ser desfeita.",
                        actionLabel: "Excluir",
                        cancelLabel: "Cancelar",
                        variant: "destructive",
                        onAction: async () => {
                           await bulkDeleteMutation.mutateAsync({ ids });
                           clearSelection();
                        },
                     });
                  }}
               >
                  Excluir
               </SelectionActionButton>
            )}
         </DataTableBulkActions>
      </DataTableRoot>
   );
}

function ContactsPage() {
   return (
      <main className="flex flex-col gap-4">
         <DefaultHeader
            description="Gerencie clientes e fornecedores"
            title="Contatos"
         />
         <EarlyAccessBanner template={CONTACTS_BANNER} />
         <QueryBoundary fallback={<ContactsSkeleton />}>
            <ContactsList />
         </QueryBoundary>
      </main>
   );
}
```

**Step 2: Typecheck**

```bash
cd /home/yorizel/Documents/montte-nx && bun run typecheck 2>&1 | grep -i "contacts" | head -20
```

---

### Task 4: Delete deprecated files

**Files to delete:**
- `apps/web/src/features/contacts/ui/contacts-form.tsx`
- `apps/web/src/features/contacts/ui/contacts-columns.tsx` (moved to colocated folder in Task 1)

**Step 1: Verify no imports remain**

```bash
cd /home/yorizel/Documents/montte-nx && grep -r "contacts-form\|features/contacts/ui/contacts-columns" apps/web/src --include="*.tsx" --include="*.ts" | grep -v "node_modules"
```

Expected: 0 results.

**Step 2: Delete**

```bash
rm "apps/web/src/features/contacts/ui/contacts-form.tsx"
rm "apps/web/src/features/contacts/ui/contacts-columns.tsx"
rmdir "apps/web/src/features/contacts/ui" 2>/dev/null || true
rmdir "apps/web/src/features/contacts" 2>/dev/null || true
```

**Step 3: Final typecheck**

```bash
cd /home/yorizel/Documents/montte-nx && bun run typecheck 2>&1 | grep -i "contacts" | head -20
```

**Step 4: Commit**

```bash
cd /home/yorizel/Documents/montte-nx
git add apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/-contacts/
git add apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/contacts.tsx
git add -u
git commit -m "feat(contacts): native inline create, move columns file, remove deprecated files"
```
