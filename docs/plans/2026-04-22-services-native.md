# Services — Native Table Create & Import, Move Files

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace `ServiceForm` + `ServiceImportCredenza` + export CSV button with native `onAddRow` + `DataTableImportButton` + native `DataTableExportButton`. Move `services-columns.tsx` and `services-analytics-header.tsx` from `features/services/ui/` to colocated `erp/-services/` folder. Delete all deprecated files.

**Architecture:** Add `cellComponent: "text"` to `name` column and `cellComponent: "money"` to `basePrice` column for inline creation. Wire `isDraftRowActive`/`onAddRow`/`onDiscardAddRow` on `DataTableRoot`. Add `DataTableImportButton` inside `DataTableToolbar`. Remove all manual import/export/create buttons. Move route-specific files out of `features/`.

**Tech Stack:** TanStack Query, `DataTableRoot`, `DataTableImportButton`, `orpc.services.create`

---

### Task 1: Move files from features/ to colocated folder

**Files:**
- Source: `apps/web/src/features/services/ui/services-columns.tsx`
- Destination: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/erp/-services/services-columns.tsx`
- Source: `apps/web/src/features/services/ui/services-analytics-header.tsx`
- Destination: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/erp/-services/services-analytics-header.tsx`

**Step 1: Create destination directory and copy files**

```bash
mkdir -p "apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/erp/-services"
cp "apps/web/src/features/services/ui/services-columns.tsx" "apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/erp/-services/services-columns.tsx"
cp "apps/web/src/features/services/ui/services-analytics-header.tsx" "apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/erp/-services/services-analytics-header.tsx"
```

**Step 2: Note import path changes**

`services.tsx` currently imports from:
- `@/features/services/ui/services-columns` → will change to `./-services/services-columns`
- `@/features/services/ui/services-analytics-header` → will change to `./-services/services-analytics-header`

---

### Task 2: Update `services-columns.tsx` — add `cellComponent` meta

**Files:**
- Modify: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/erp/-services/services-columns.tsx`

**Step 1: Add z import**

Add at top of file:
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

**Step 3: Update `basePrice` column — add meta**

```typescript
{
   accessorKey: "basePrice",
   header: "Preço padrão",
   meta: {
      label: "Preço padrão",
      cellComponent: "money" as const,
   },
   cell: ({ row }) => (
      <span>{format(of(row.original.basePrice, "BRL"), "pt-BR")}</span>
   ),
},
```

---

### Task 3: Rewrite `erp/services.tsx` — remove forms/credenzas, add native create/import

**Files:**
- Modify: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/erp/services.tsx`

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
import { Briefcase, Pencil, Plus, Trash2 } from "lucide-react";
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
   DataTableContent,
} from "@/components/data-table/data-table-content";
import { DataTableEmptyState } from "@/components/data-table/data-table-empty-state";
import {
   DataTableExternalFilter,
   DataTableRoot,
} from "@/components/data-table/data-table-root";
import { DataTableSkeleton } from "@/components/data-table/data-table-skeleton";
import { DataTableToolbar } from "@/components/data-table/data-table-toolbar";
import {
   DataTableImportButton,
   type DataTableImportConfig,
} from "@/components/data-table/data-table-import";
import { useCsvFile } from "@/hooks/use-csv-file";
import { useXlsxFile } from "@/hooks/use-xlsx-file";
import { orpc } from "@/integrations/orpc/client";
import {
   buildServiceColumns,
   type ServiceRow,
} from "./-services/services-columns";
import { ServicesAnalyticsHeader } from "./-services/services-analytics-header";

const SERVICES_BANNER: EarlyAccessBannerTemplate = {
   badgeLabel: "Serviços",
   message: "Esta funcionalidade está em conceito.",
   ctaLabel: "Deixar feedback",
   stage: "concept",
   icon: Briefcase,
   bullets: [
      "Cadastre serviços e defina preços",
      "Vincule serviços a cobranças e projetos",
      "Seu feedback nos ajuda a melhorar",
   ],
};

const TYPE_FILTER_OPTIONS = [
   { value: "service", label: "Prestação de serviço" },
   { value: "product", label: "Produto" },
   { value: "subscription", label: "Assinatura" },
] as const;

type ServiceType = (typeof TYPE_FILTER_OPTIONS)[number]["value"];

const servicesSearchSchema = z.object({
   search: z.string().catch("").default(""),
   type: z.enum(["service", "product", "subscription"]).optional().catch(undefined),
   categoryId: z.string().optional().catch(undefined),
});

const skeletonColumns = buildServiceColumns();

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/erp/services",
)({
   validateSearch: servicesSearchSchema,
   loader: ({ context }) => {
      context.queryClient.prefetchQuery(orpc.services.getAll.queryOptions({}));
      context.queryClient.prefetchQuery(orpc.categories.getAll.queryOptions({}));
   },
   pendingMs: 300,
   pendingComponent: ServicesSkeleton,
   head: () => ({
      meta: [{ title: "Gestão de Serviços — Montte" }],
   }),
   component: ServicesPage,
});

function ServicesSkeleton() {
   return <DataTableSkeleton columns={skeletonColumns} />;
}

function ServicesList() {
   const navigate = Route.useNavigate();
   const { search, type, categoryId } = Route.useSearch();
   const { openAlertDialog } = useAlertDialog();
   const { parse: parseCsv } = useCsvFile();
   const { parse: parseXlsx } = useXlsxFile();

   const { data: servicesList } = useSuspenseQuery(
      orpc.services.getAll.queryOptions({}),
   );
   const { data: categories } = useSuspenseQuery(
      orpc.categories.getAll.queryOptions({}),
   );

   const createMutation = useMutation(
      orpc.services.create.mutationOptions({
         onSuccess: () => toast.success("Serviço criado com sucesso."),
         onError: (e) => toast.error(e.message),
      }),
   );

   const deleteMutation = useMutation(
      orpc.services.remove.mutationOptions({
         onSuccess: () => toast.success("Serviço excluído com sucesso."),
         onError: (e) => toast.error(e.message || "Erro ao excluir serviço."),
      }),
   );

   const filtered = useMemo(() => {
      let result = servicesList as ServiceRow[];
      if (search) {
         const q = search.toLowerCase();
         result = result.filter(
            (s) =>
               s.name.toLowerCase().includes(q) ||
               s.description?.toLowerCase().includes(q),
         );
      }
      if (type) {
         result = result.filter((s) => s.type === type);
      }
      if (categoryId) {
         result = result.filter((s) => s.categoryId === categoryId);
      }
      return result;
   }, [servicesList, search, type, categoryId]);

   const [isDraftActive, setIsDraftActive] = useState(false);

   const handleDiscardDraft = useCallback(() => setIsDraftActive(false), []);

   const handleAddService = useCallback(
      async (data: Record<string, string | string[]>) => {
         const name = String(data.name ?? "").trim();
         if (!name) return;
         const basePrice = String(data.basePrice ?? "0") || "0";
         await createMutation.mutateAsync({ name, basePrice });
         setIsDraftActive(false);
      },
      [createMutation],
   );

   const importConfig: DataTableImportConfig = useMemo(
      () => ({
         accept: {
            "text/csv": [".csv"],
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
               [".xlsx"],
            "application/vnd.ms-excel": [".xls"],
         },
         parseFile: async (file: File) => {
            const ext = file.name.split(".").pop()?.toLowerCase();
            if (ext === "xlsx" || ext === "xls") return parseXlsx(file);
            return parseCsv(file);
         },
         mapRow: (row, i): ServiceRow => ({
            id: `__import_${i}`,
            name: String(row.name ?? "").trim(),
            description: String(row.description ?? "").trim() || null,
            basePrice: String(row.basePrice ?? row.price ?? "0").replace(
               /[R$\s.]/g,
               "",
            ).replace(",", ".") || "0",
            categoryId: null,
            categoryName: null,
            categoryColor: null,
            tagId: null,
            tagName: null,
            tagColor: null,
            isActive: true,
         }),
         onImport: async (rows) => {
            await Promise.allSettled(
               rows.map((r) =>
                  createMutation.mutateAsync({
                     name: r.name,
                     basePrice: r.basePrice || "0",
                     description: r.description ?? undefined,
                  }),
               ),
            );
         },
      }),
      [createMutation, parseCsv, parseXlsx],
   );

   const handleDelete = useCallback(
      (row: ServiceRow) => {
         openAlertDialog({
            title: "Excluir serviço",
            description: `Tem certeza que deseja excluir o serviço "${row.name}"? Esta ação não pode ser desfeita.`,
            actionLabel: "Excluir",
            cancelLabel: "Cancelar",
            variant: "destructive",
            onAction: async () => {
               await deleteMutation.mutateAsync({ id: row.id });
            },
         });
      },
      [openAlertDialog, deleteMutation],
   );

   const columns = useMemo(() => buildServiceColumns(), []);

   return (
      <DataTableRoot
         columns={columns}
         data={filtered}
         getRowId={(row) => row.id}
         storageKey="montte:datatable:services"
         isDraftRowActive={isDraftActive}
         onAddRow={handleAddService}
         onDiscardAddRow={handleDiscardDraft}
         renderActions={({ row }) => (
            <Button
               className="text-destructive hover:text-destructive"
               onClick={() => handleDelete(row.original)}
               tooltip="Excluir"
               variant="outline"
            >
               <Trash2 className="size-4" />
            </Button>
         )}
      >
         {TYPE_FILTER_OPTIONS.map((opt) => (
            <DataTableExternalFilter
               key={opt.value}
               id={`type:${opt.value}`}
               label={opt.label}
               group="Tipo"
               active={type === opt.value}
               onToggle={(active) =>
                  navigate({
                     search: (prev) => ({
                        ...prev,
                        type: active ? opt.value : undefined,
                     }),
                     replace: true,
                  })
               }
            />
         ))}
         {categories?.map((cat) => (
            <DataTableExternalFilter
               key={cat.id}
               id={`category:${cat.id}`}
               label={cat.name}
               group="Categoria"
               active={categoryId === cat.id}
               onToggle={(active) =>
                  navigate({
                     search: (prev) => ({
                        ...prev,
                        categoryId: active ? cat.id : undefined,
                     }),
                     replace: true,
                  })
               }
            />
         ))}
         <DataTableToolbar
            searchPlaceholder="Buscar serviços..."
            searchDefaultValue={search}
            onSearch={(value) =>
               navigate({
                  search: (prev) => ({ ...prev, search: value }),
                  replace: true,
               })
            }
         >
            <DataTableImportButton importConfig={importConfig} />
            <Button
               onClick={() => setIsDraftActive(true)}
               size="icon-sm"
               tooltip="Novo Serviço"
               variant="outline"
            >
               <Plus />
            </Button>
         </DataTableToolbar>
         <DataTableContent />
         <DataTableEmptyState>
            <Empty>
               <EmptyMedia>
                  <Briefcase className="size-10" />
               </EmptyMedia>
               <EmptyHeader>
                  <EmptyTitle>Nenhum serviço cadastrado</EmptyTitle>
                  <EmptyDescription>
                     Adicione serviços para começar a gerenciar seu catálogo.
                  </EmptyDescription>
               </EmptyHeader>
            </Empty>
         </DataTableEmptyState>
      </DataTableRoot>
   );
}

function ServicesPage() {
   return (
      <main className="flex flex-col gap-4">
         <DefaultHeader
            description="Gerencie o catálogo de serviços"
            title="Serviços"
         />
         <ServicesAnalyticsHeader />
         <EarlyAccessBanner template={SERVICES_BANNER} />
         <QueryBoundary fallback={<ServicesSkeleton />}>
            <ServicesList />
         </QueryBoundary>
      </main>
   );
}
```

Note: if `ServiceRow` doesn't have a `type` field (server may not return it), remove the `type` filter and `TYPE_FILTER_OPTIONS` logic. Check by looking at the oRPC services.getAll output type.

**Step 2: Typecheck**

```bash
cd /home/yorizel/Documents/montte-nx && bun run typecheck 2>&1 | grep -i "services" | head -20
```

---

### Task 4: Delete deprecated files

**Files to delete:**
- `apps/web/src/features/services/ui/services-form.tsx`
- `apps/web/src/features/services/ui/service-import-credenza.tsx`
- `apps/web/src/features/services/utils/export-services-csv.ts`
- `apps/web/src/features/services/ui/services-columns.tsx` (moved in Task 1)
- `apps/web/src/features/services/ui/services-analytics-header.tsx` (moved in Task 1)

**Step 1: Verify no imports remain**

```bash
cd /home/yorizel/Documents/montte-nx && grep -r "services-form\|service-import-credenza\|export-services-csv\|features/services/ui/services-columns\|features/services/ui/services-analytics" apps/web/src --include="*.tsx" --include="*.ts" | grep -v "node_modules"
```

Expected: 0 results.

**Step 2: Delete**

```bash
rm "apps/web/src/features/services/ui/services-form.tsx"
rm "apps/web/src/features/services/ui/service-import-credenza.tsx"
rm "apps/web/src/features/services/utils/export-services-csv.ts"
rm "apps/web/src/features/services/ui/services-columns.tsx"
rm "apps/web/src/features/services/ui/services-analytics-header.tsx"
rmdir "apps/web/src/features/services/ui" 2>/dev/null || true
rmdir "apps/web/src/features/services/utils" 2>/dev/null || true
rmdir "apps/web/src/features/services" 2>/dev/null || true
```

**Step 3: Final typecheck**

```bash
cd /home/yorizel/Documents/montte-nx && bun run typecheck 2>&1 | grep -i "services" | head -20
```

**Step 4: Commit**

```bash
cd /home/yorizel/Documents/montte-nx
git add apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/erp/-services/
git add apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/erp/services.tsx
git add -u
git commit -m "feat(services): native inline create, import, move files, remove deprecated"
```
