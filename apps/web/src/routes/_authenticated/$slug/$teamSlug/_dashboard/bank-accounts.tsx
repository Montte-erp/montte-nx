import { Button } from "@packages/ui/components/button";
import {
   Empty,
   EmptyDescription,
   EmptyHeader,
   EmptyMedia,
   EmptyTitle,
} from "@packages/ui/components/empty";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import dayjs from "dayjs";
import { Landmark, Plus, ReceiptText, Trash2 } from "lucide-react";
import { useCallback, useMemo } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { QueryBoundary } from "@/components/query-boundary";
import { DefaultHeader } from "../-layout/default-header";
import {
   DataTableBulkActions,
   SelectionActionButton,
} from "@/components/data-table/data-table-bulk-actions";
import { DataTableContent } from "@/components/data-table/data-table-content";
import { DataTableEmptyState } from "@/components/data-table/data-table-empty-state";
import {
   DataTableImportButton,
   type DataTableImportConfig,
} from "@/components/data-table/data-table-import";
import { DataTablePagination } from "@/components/data-table/data-table-pagination";
import {
   DataTableExternalFilter,
   DataTableRoot,
} from "@/components/data-table/data-table-root";
import { DataTableSkeleton } from "@/components/data-table/data-table-skeleton";
import { DataTableToolbar } from "@/components/data-table/data-table-toolbar";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useCsvFile } from "@/hooks/use-csv-file";
import { useDashboardSlugs } from "@/hooks/use-dashboard-slugs";
import { useSheet } from "@/hooks/use-sheet";
import { useXlsxFile } from "@/hooks/use-xlsx-file";
import { orpc } from "@/integrations/orpc/client";
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

function resolveType(raw: unknown): BankAccountRow["type"] | undefined {
   if (raw === null || raw === undefined || raw === "") return "checking";
   const str = String(raw).trim();
   if (!str) return "checking";
   const parsed = typeSchema.safeParse(str);
   return parsed.success ? parsed.data : undefined;
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
   const { parse: parseXlsx } = useXlsxFile();

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
         mapRow: (row, i) => ({
            id: `__import_${i}`,
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
            filename: "modelo-contas-bancarias.csv",
            label: "Baixar modelo CSV",
            description:
               "Inclui name, type e initialBalance. Use type como checking, savings, investment, payment ou cash.",
            createBlob: () =>
               generateCsv(
                  [
                     {
                        name: "Conta Corrente Principal",
                        type: "checking",
                        initialBalance: "1500.00",
                     },
                     {
                        name: "Reserva de Emergência",
                        type: "savings",
                        initialBalance: "2500.00",
                     },
                     {
                        name: "Caixa da Loja",
                        type: "cash",
                        initialBalance: "300.00",
                     },
                  ],
                  ["name", "type", "initialBalance"],
               ),
         },
         onImport: async (rows) => {
            const invalidType = rows.some((r) => !resolveType(r.type));
            if (invalidType) {
               throw new Error(
                  "Arquivo contém tipo de conta inválido. Use checking, savings, investment, payment ou cash.",
               );
            }
            const accounts = rows.flatMap((r) => {
               const type = resolveType(r.type);
               if (!type) return [];
               return [
                  {
                     name: String(r.name ?? "").trim(),
                     type,
                     color: "#6366f1",
                     initialBalance: String(r.initialBalance ?? "0"),
                  },
               ];
            });
            await bulkCreateMutation.mutateAsync({
               accounts,
            });
         },
      }),
      [bulkCreateMutation, generateCsv, parseCsv, parseXlsx],
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

   const columns = useMemo(
      () =>
         buildBankAccountColumns({
            logoDevToken: publicEnv?.LOGO_DEV_TOKEN,
            onRenameAccount: handleRenameAccount,
         }),
      [handleRenameAccount, publicEnv?.LOGO_DEV_TOKEN],
   );

   return (
      <div className="flex flex-1 flex-col gap-4 min-h-0">
         <DataTableRoot
            columns={columns}
            data={result.data}
            getRowId={(row) => row.id}
            storageKey="montte:datatable:bank-accounts"
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
                  search: (prev) => ({ ...prev, columnFilters: next, page: 1 }),
                  replace: true,
               });
            }}
            renderActions={({ row }) => (
               <>
                  <Button
                     asChild
                     size="icon"
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
                     size="icon"
                     tooltip="Excluir"
                     variant="outline"
                  >
                     <Trash2 className="size-4" />
                     <span className="sr-only">Excluir</span>
                  </Button>
               </>
            )}
         >
            {TYPES.map((key) => (
               <DataTableExternalFilter
                  key={key}
                  id={`type:${key}`}
                  label={TYPE_LABELS[key]}
                  group="Tipo"
                  active={type === key}
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
            <DataTableToolbar
               searchPlaceholder="Buscar conta por nome..."
               searchDefaultValue={search}
               onSearch={(value) =>
                  navigate({
                     search: (prev) => ({ ...prev, search: value, page: 1 }),
                     replace: true,
                  })
               }
            >
               <DataTableImportButton importConfig={importConfig} />
               <Button
                  onClick={handleOpenCreate}
                  size="icon-sm"
                  tooltip="Nova Conta"
                  variant="outline"
               >
                  <Plus />
               </Button>
            </DataTableToolbar>
            <DataTableContent className="flex-1 overflow-auto min-h-0" />
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
            <DataTableBulkActions<BankAccountRow>>
               {({ selectedRows, clearSelection }) => (
                  <SelectionActionButton
                     icon={<Trash2 className="size-4" />}
                     variant="destructive"
                     onClick={() => {
                        const ids = selectedRows.map((r) => r.id);
                        openAlertDialog({
                           title: `Excluir ${ids.length} ${ids.length === 1 ? "conta" : "contas"}`,
                           description:
                              "Tem certeza que deseja excluir as contas selecionadas? Esta ação não pode ser desfeita.",
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
         {result.totalCount > 0 && (
            <DataTablePagination
               currentPage={page}
               pageSize={pageSize}
               totalPages={result.totalPages}
               totalCount={result.totalCount}
               onPageChange={(p) =>
                  navigate({
                     search: (prev) => ({ ...prev, page: p }),
                     replace: true,
                  })
               }
               onPageSizeChange={(s) =>
                  navigate({
                     search: (prev) => ({ ...prev, pageSize: s, page: 1 }),
                     replace: true,
                  })
               }
            />
         )}
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
