import { Button } from "@packages/ui/components/button";
import { Checkbox } from "@packages/ui/components/checkbox";
import {
   Empty,
   EmptyDescription,
   EmptyHeader,
   EmptyMedia,
   EmptyTitle,
} from "@packages/ui/components/empty";
import { SelectionActionButton } from "@packages/ui/components/selection-action-bar";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
   getCoreRowModel,
   useReactTable,
   type ColumnDef,
   type PaginationState,
   type RowSelectionState,
   type SortingState,
} from "@tanstack/react-table";
import dayjs from "dayjs";
import { Landmark, Plus, ReceiptText, Trash2 } from "lucide-react";
import { startTransition, useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { DataTableBody } from "@/components/data-table-v2/data-table-body";
import { DataTableBulkActionBar } from "@/components/data-table-v2/data-table-bulk-action-bar";
import { DataTableColumnVisibility } from "@/components/data-table-v2/data-table-column-visibility";
import { DataTableContainer } from "@/components/data-table-v2/data-table-container";
import { DataTableEmptyState } from "@/components/data-table-v2/data-table-empty-state";
import { DataTableHeader } from "@/components/data-table-v2/data-table-header";
import { DataTablePagination } from "@/components/data-table-v2/data-table-pagination";
import { DataTableRoot } from "@/components/data-table-v2/data-table-root";
import { DataTableSearch } from "@/components/data-table-v2/data-table-search";
import { DataTableSkeleton } from "@/components/data-table-v2/data-table-skeleton";
import {
   DataTableToolbar,
   DataTableToolbarGroup,
} from "@/components/data-table-v2/data-table-toolbar";
import { useDataTableLayout } from "@/components/data-table-v2/use-data-table-layout";
import { DataImportButton } from "@/features/data-import/data-import-button";
import { DataImportSection } from "@/features/data-import/data-import-section";
import { useDataImport } from "@/features/data-import/use-data-import";
import type { DataImportConfig } from "@/features/data-import/types";
import { PageFilters } from "@/components/page-filters/page-filters";
import { PageFilter } from "@/components/page-filters/page-filter";
import { QueryBoundary } from "@/components/query-boundary";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useCsvFile } from "@/hooks/use-csv-file";
import { useDashboardSlugs } from "@/hooks/use-dashboard-slugs";
import { useSheet } from "@/hooks/use-sheet";
import { useXlsxFile } from "@/hooks/use-xlsx-file";
import { orpc } from "@/integrations/orpc/client";
import { DefaultHeader } from "../-layout/default-header";
import { BankAccountFormSheet } from "./-bank-accounts/bank-account-form-sheet";
import {
   buildBankAccountColumns,
   type BankAccountRow,
} from "./-bank-accounts/bank-accounts-columns";

const TYPES = ["checking", "savings", "investment", "payment", "cash"] as const;
const typeSchema = z.enum(TYPES);

const TYPE_LABELS: Record<(typeof TYPES)[number], string> = {
   checking: "Conta Corrente",
   savings: "Conta Poupança",
   investment: "Conta Investimento",
   payment: "Conta Pagamento",
   cash: "Caixa Físico",
};

function normalizeImportLabel(raw: unknown): string {
   return String(raw ?? "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "");
}

function resolveType(raw: unknown): BankAccountRow["type"] | undefined {
   if (raw === null || raw === undefined || raw === "") return "checking";
   const str = normalizeImportLabel(raw);
   if (!str) return "checking";
   const parsed = typeSchema.safeParse(str);
   if (parsed.success) return parsed.data;
   if (normalizeImportLabel(TYPE_LABELS.checking) === str) return "checking";
   if (normalizeImportLabel(TYPE_LABELS.savings) === str) return "savings";
   if (normalizeImportLabel(TYPE_LABELS.investment) === str)
      return "investment";
   if (normalizeImportLabel(TYPE_LABELS.payment) === str) return "payment";
   if (normalizeImportLabel(TYPE_LABELS.cash) === str) return "cash";
   return undefined;
}

const searchSchema = z.object({
   sorting: z
      .array(z.object({ id: z.string(), desc: z.boolean() }))
      .catch([])
      .default([]),
   columnFilters: z
      .array(z.object({ id: z.string(), value: z.unknown() }))
      .catch([])
      .default([]),
   type: z.union([typeSchema, z.undefined()]).catch(() => undefined),
   search: z.string().max(100).catch("").default(""),
   page: z.number().int().min(1).catch(1).default(1),
   pageSize: z.number().int().catch(20).default(20),
});

const skeletonColumns = buildBankAccountColumns();

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/bank-accounts",
)({
   validateSearch: searchSchema,
   loaderDeps: ({ search: { page, pageSize, search, type } }) => ({
      page,
      pageSize,
      search,
      type,
   }),
   loader: ({ context, deps }) => {
      context.queryClient.prefetchQuery(
         orpc.bankAccounts.list.queryOptions({
            input: {
               page: deps.page,
               pageSize: deps.pageSize,
               search: deps.search || undefined,
               type: deps.type,
            },
         }),
      );
   },
   pendingMs: 300,
   pendingComponent: BankAccountsSkeleton,
   head: () => ({
      meta: [{ title: "Contas Bancárias — Montte" }],
   }),
   component: BankAccountsPage,
});

function BankAccountsSkeleton() {
   return <DataTableSkeleton columns={skeletonColumns} />;
}

function BankAccountsList() {
   const navigate = Route.useNavigate();
   const { slug, teamSlug } = useDashboardSlugs();
   const { sorting, columnFilters, type, search, page, pageSize } =
      Route.useSearch();
   const { openAlertDialog } = useAlertDialog();
   const { openSheet } = useSheet();
   const { publicEnv } = Route.useRouteContext();
   const { parse: parseCsv, generate: generateCsv } = useCsvFile();
   const { parse: parseXlsx, generate: generateXlsx } = useXlsxFile();
   const layout = useDataTableLayout("bank-accounts");

   const { data: result } = useSuspenseQuery(
      orpc.bankAccounts.list.queryOptions({
         input: { page, pageSize, search: search || undefined, type },
      }),
   );

   const bulkCreateMutation = useMutation(
      orpc.bankAccounts.bulkCreate.mutationOptions({
         onError: (e) => toast.error(e.message),
      }),
   );
   const updateMutation = useMutation(
      orpc.bankAccounts.update.mutationOptions({
         onError: (e) => toast.error(e.message),
      }),
   );
   const deleteMutation = useMutation(
      orpc.bankAccounts.remove.mutationOptions({
         onSuccess: () => toast.success("Conta excluída com sucesso."),
         onError: (e) => toast.error(e.message),
      }),
   );
   const bulkDeleteMutation = useMutation(
      orpc.bankAccounts.bulkRemove.mutationOptions({
         onSuccess: ({ deleted }) =>
            toast.success(
               `${deleted} ${deleted === 1 ? "conta excluída" : "contas excluídas"} com sucesso.`,
            ),
         onError: (e) => toast.error(e.message),
      }),
   );

   const handleRenameAccount = useCallback(
      async (id: string, name: string) => {
         await updateMutation.mutateAsync({ id, name });
      },
      [updateMutation],
   );

   const handleOpenCreate = useCallback(() => {
      openSheet({ renderChildren: () => <BankAccountFormSheet /> });
   }, [openSheet]);

   const importConfig: DataImportConfig = useMemo(
      () => ({
         parseFile: async (file: File) => {
            const ext = file.name.split(".").pop()?.toLowerCase();
            if (ext === "xlsx" || ext === "xls") return parseXlsx(file);
            return parseCsv(file);
         },
         mapRow: (row, i) => ({
            id: `__import_${i + 1}`,
            teamId: "",
            name: String(row.name ?? "").trim(),
            type: resolveType(row.type),
            color: "#6366f1",
            iconUrl: null,
            bankCode: null,
            bankName: null,
            initialBalance: String(row.initialBalance ?? "0"),
            currentBalance: "0",
            projectedBalance: "0",
            createdAt: dayjs().toISOString(),
            updatedAt: dayjs().toISOString(),
         }),
         template: {
            label: "Baixar modelo",
            description:
               "Inclui Nome, Tipo e Saldo Inicial. Use Tipo como Conta Corrente, Conta Poupança, Conta Investimento, Conta Pagamento ou Caixa Físico.",
            formats: [
               {
                  filename: "modelo-contas-bancarias.csv",
                  label: "CSV",
                  createBlob: () =>
                     generateCsv(
                        [
                           {
                              Nome: "Conta Corrente Principal",
                              Tipo: "Conta Corrente",
                              "Saldo Inicial": "1500.00",
                           },
                           {
                              Nome: "Reserva de Emergência",
                              Tipo: "Conta Poupança",
                              "Saldo Inicial": "2500.00",
                           },
                           {
                              Nome: "Caixa da Loja",
                              Tipo: "Caixa Físico",
                              "Saldo Inicial": "300.00",
                           },
                        ],
                        ["Nome", "Tipo", "Saldo Inicial"],
                     ),
               },
               {
                  filename: "modelo-contas-bancarias.xlsx",
                  label: "XLSX",
                  createBlob: () =>
                     generateXlsx(
                        [
                           {
                              Nome: "Conta Corrente Principal",
                              Tipo: "Conta Corrente",
                              "Saldo Inicial": "1500.00",
                           },
                           {
                              Nome: "Reserva de Emergência",
                              Tipo: "Conta Poupança",
                              "Saldo Inicial": "2500.00",
                           },
                           {
                              Nome: "Caixa da Loja",
                              Tipo: "Caixa Físico",
                              "Saldo Inicial": "300.00",
                           },
                        ],
                        ["Nome", "Tipo", "Saldo Inicial"],
                     ),
               },
            ],
         },
         onImport: async (rows) => {
            const invalidType = rows.some((r) => !resolveType(r.type));
            if (invalidType) {
               throw new Error(
                  "Arquivo contém tipo de conta inválido. Use Conta Corrente, Conta Poupança, Conta Investimento, Conta Pagamento ou Caixa Físico.",
               );
            }
            const accounts = rows.flatMap((r) => {
               const t = resolveType(r.type);
               if (!t) return [];
               return [
                  {
                     name: String(r.name ?? "").trim(),
                     type: t,
                     color: "#6366f1",
                     initialBalance: String(r.initialBalance ?? "0"),
                  },
               ];
            });
            await bulkCreateMutation.mutateAsync({ accounts });
         },
      }),
      [bulkCreateMutation, generateCsv, generateXlsx, parseCsv, parseXlsx],
   );

   const handleDelete = useCallback(
      (account: BankAccountRow) => {
         openAlertDialog({
            title: "Excluir conta",
            description: `Tem certeza que deseja excluir a conta "${account.name}"? Esta ação não pode ser desfeita.`,
            actionLabel: "Excluir",
            cancelLabel: "Cancelar",
            variant: "destructive",
            onAction: async () => {
               await deleteMutation.mutateAsync({ id: account.id });
            },
         });
      },
      [openAlertDialog, deleteMutation],
   );

   const columns = useMemo<ColumnDef<BankAccountRow>[]>(() => {
      const base = buildBankAccountColumns({
         logoDevToken: publicEnv?.LOGO_DEV_TOKEN,
         onRenameAccount: handleRenameAccount,
      });
      const selectColumn: ColumnDef<BankAccountRow> = {
         id: "__select",
         size: 40,
         enableSorting: false,
         enableHiding: false,
         meta: { importIgnore: true },
         header: ({ table }) => (
            <Checkbox
               aria-label="Selecionar todas"
               checked={
                  table.getIsAllPageRowsSelected()
                     ? true
                     : table.getIsSomePageRowsSelected()
                       ? "indeterminate"
                       : false
               }
               onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
            />
         ),
         cell: ({ row }) => (
            <Checkbox
               aria-label="Selecionar linha"
               checked={row.getIsSelected()}
               disabled={!row.getCanSelect()}
               onCheckedChange={(v) => row.toggleSelected(!!v)}
            />
         ),
      };
      const actionsColumn: ColumnDef<BankAccountRow> = {
         id: "__actions",
         size: 100,
         enableSorting: false,
         enableHiding: false,
         meta: { importIgnore: true, align: "right" },
         cell: ({ row }) => (
            <div className="flex justify-end gap-2">
               <Button
                  asChild
                  size="icon-sm"
                  tooltip="Ver lançamentos"
                  variant="outline"
               >
                  <Link
                     params={{ slug, teamSlug }}
                     search={{
                        bankId: row.original.id,
                        contactId: "",
                        overdueOnly: false,
                        page: 1,
                        pageSize: 20,
                        search: "",
                        status: [],
                        view: "all",
                     }}
                     to="/$slug/$teamSlug/transactions"
                  >
                     <ReceiptText className="size-4" />
                     <span className="sr-only">Ver lançamentos</span>
                  </Link>
               </Button>
               <Button
                  className="text-destructive hover:text-destructive"
                  onClick={() => handleDelete(row.original)}
                  size="icon-sm"
                  tooltip="Excluir"
                  variant="outline"
               >
                  <Trash2 className="size-4" />
                  <span className="sr-only">Excluir</span>
               </Button>
            </div>
         ),
      };
      return [selectColumn, ...base, actionsColumn];
   }, [
      handleDelete,
      handleRenameAccount,
      publicEnv?.LOGO_DEV_TOKEN,
      slug,
      teamSlug,
   ]);

   const handleSortingChange = useCallback(
      (updater: SortingState | ((prev: SortingState) => SortingState)) => {
         const next =
            typeof updater === "function" ? updater(sorting) : updater;
         startTransition(() => {
            navigate({
               search: (prev) => ({ ...prev, sorting: next, page: 1 }),
               replace: true,
            });
         });
      },
      [navigate, sorting],
   );

   const handlePaginationChange = useCallback(
      (
         updater:
            | PaginationState
            | ((prev: PaginationState) => PaginationState),
      ) => {
         const current: PaginationState = {
            pageIndex: page - 1,
            pageSize,
         };
         const next =
            typeof updater === "function" ? updater(current) : updater;
         startTransition(() => {
            navigate({
               search: (prev) => ({
                  ...prev,
                  page: next.pageIndex + 1,
                  pageSize: next.pageSize,
               }),
               replace: true,
            });
         });
      },
      [navigate, page, pageSize],
   );

   const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

   const table = useReactTable({
      data: result.data,
      columns,
      getRowId: (row) => row.id,
      pageCount: result.totalPages || 1,
      manualPagination: true,
      manualSorting: true,
      manualFiltering: true,
      state: {
         sorting,
         columnFilters,
         pagination: { pageIndex: page - 1, pageSize },
         rowSelection,
      },
      onSortingChange: handleSortingChange,
      onPaginationChange: handlePaginationChange,
      onRowSelectionChange: setRowSelection,
      onColumnSizingChange: layout.onColumnSizingChange,
      onColumnOrderChange: layout.onColumnOrderChange,
      onColumnVisibilityChange: layout.onColumnVisibilityChange,
      onColumnPinningChange: layout.onColumnPinningChange,
      initialState: {
         columnSizing: layout.initialState.columnSizing,
         columnOrder: layout.initialState.columnOrder,
         columnVisibility: layout.initialState.columnVisibility,
         columnPinning: layout.initialState.columnPinning,
      },
      getCoreRowModel: getCoreRowModel(),
   });

   const importApi = useDataImport({ table, config: importConfig });

   return (
      <div className="flex flex-1 flex-col gap-4 min-h-0">
         <DataTableRoot table={table}>
            <DataTableToolbar>
               <DataTableSearch
                  onChange={(value) =>
                     startTransition(() => {
                        navigate({
                           search: (prev) => ({
                              ...prev,
                              search: value,
                              page: 1,
                           }),
                           replace: true,
                        });
                     })
                  }
                  placeholder="Buscar conta por nome..."
                  value={search}
               />
               <DataTableToolbarGroup>
                  <PageFilters>
                     {TYPES.map((key) => (
                        <PageFilter
                           active={type === key}
                           group="Tipo"
                           id={`type:${key}`}
                           key={key}
                           label={TYPE_LABELS[key]}
                           onToggle={(active) =>
                              navigate({
                                 search: (prev) => ({
                                    ...prev,
                                    type: active ? key : undefined,
                                    page: 1,
                                 }),
                                 replace: true,
                              })
                           }
                        />
                     ))}
                  </PageFilters>
                  <DataTableColumnVisibility />
                  <DataImportButton api={importApi} config={importConfig} />
                  <Button
                     onClick={handleOpenCreate}
                     size="icon-sm"
                     tooltip="Nova Conta"
                     variant="outline"
                  >
                     <Plus />
                  </Button>
               </DataTableToolbarGroup>
            </DataTableToolbar>
            <DataTableContainer>
               <DataTableHeader />
               <DataTableBody<BankAccountRow> />
            </DataTableContainer>
            <DataImportSection
               api={importApi}
               config={importConfig}
               table={table}
            />
            <DataTableEmptyState>
               <Empty>
                  <EmptyMedia>
                     <Landmark className="size-10" />
                  </EmptyMedia>
                  <EmptyHeader>
                     <EmptyTitle>Nenhuma conta bancária</EmptyTitle>
                     <EmptyDescription>
                        Adicione uma conta para começar a gerenciar suas
                        finanças.
                     </EmptyDescription>
                  </EmptyHeader>
               </Empty>
            </DataTableEmptyState>
            {result.totalCount > 0 && <DataTablePagination />}
            <DataTableBulkActionBar<BankAccountRow>>
               {({ rows, clear }) => (
                  <SelectionActionButton
                     icon={<Trash2 className="size-4" />}
                     onClick={() => {
                        const ids = rows.map((r) => r.original.id);
                        openAlertDialog({
                           title: `Excluir ${ids.length} ${ids.length === 1 ? "conta" : "contas"}`,
                           description:
                              "Tem certeza que deseja excluir as contas selecionadas? Esta ação não pode ser desfeita.",
                           actionLabel: "Excluir",
                           cancelLabel: "Cancelar",
                           variant: "destructive",
                           onAction: async () => {
                              await bulkDeleteMutation.mutateAsync({ ids });
                              clear();
                           },
                        });
                     }}
                     variant="destructive"
                  >
                     Excluir
                  </SelectionActionButton>
               )}
            </DataTableBulkActionBar>
         </DataTableRoot>
      </div>
   );
}

function BankAccountsPage() {
   return (
      <main className="flex flex-1 min-h-0 flex-col gap-4 overflow-hidden">
         <DefaultHeader
            description="Gerencie suas contas bancárias"
            title="Contas Bancárias"
         />
         <div className="flex flex-1 flex-col min-h-0">
            <QueryBoundary
               fallback={<BankAccountsSkeleton />}
               errorTitle="Erro ao carregar contas"
            >
               <BankAccountsList />
            </QueryBoundary>
         </div>
      </main>
   );
}
