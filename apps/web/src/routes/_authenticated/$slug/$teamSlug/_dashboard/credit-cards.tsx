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
import { CreditCard, Plus, Trash2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { DefaultHeader } from "@/components/default-header";
import { QueryBoundary } from "@/components/query-boundary";
import {
   DataTableBulkActions,
   SelectionActionButton,
} from "@/components/data-table/data-table-bulk-actions";
import { DataTableContent } from "@/components/data-table/data-table-content";
import { DataTableEmptyState } from "@/components/data-table/data-table-empty-state";
import { DataTablePagination } from "@/components/data-table/data-table-pagination";
import { DataTableRoot } from "@/components/data-table/data-table-root";
import { DataTableSkeleton } from "@/components/data-table/data-table-skeleton";
import { DataTableToolbar } from "@/components/data-table/data-table-toolbar";
import {
   DataTableImportButton,
   type DataTableImportConfig,
} from "@/components/data-table/data-table-import";
import { useCsvFile } from "@/hooks/use-csv-file";
import { useXlsxFile } from "@/hooks/use-xlsx-file";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { orpc } from "@/integrations/orpc/client";
import {
   buildCreditCardColumns,
   type CreditCardRow,
} from "./-credit-cards/credit-cards-columns";
import { CreditCardFaturaRow } from "./-credit-cards/credit-card-fatura-row";

const creditCardsSearchSchema = z.object({
   columnFilters: z
      .array(z.object({ id: z.string(), value: z.unknown() }))
      .catch([])
      .default([]),
   search: z.string().max(100).catch("").default(""),
   status: z
      .enum(["active", "blocked", "cancelled"])
      .optional()
      .catch(undefined),
   page: z.number().int().min(1).catch(1).default(1),
   pageSize: z.number().int().catch(20).default(20),
});

const skeletonColumns = buildCreditCardColumns();

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/credit-cards",
)({
   validateSearch: creditCardsSearchSchema,
   loaderDeps: ({ search: { page, pageSize, search, status } }) => ({
      page,
      pageSize,
      search,
      status,
   }),
   loader: ({ context, deps }) => {
      context.queryClient.prefetchQuery(
         orpc.creditCards.getAll.queryOptions({
            input: {
               page: deps.page,
               pageSize: deps.pageSize,
               search: deps.search || undefined,
               status: deps.status,
            },
         }),
      );
      context.queryClient.prefetchQuery(
         orpc.bankAccounts.getAll.queryOptions({}),
      );
   },
   pendingMs: 300,
   pendingComponent: CreditCardsSkeleton,
   head: () => ({
      meta: [{ title: "Cartões de Crédito — Montte" }],
   }),
   component: CreditCardsPage,
});

function CreditCardsSkeleton() {
   return <DataTableSkeleton columns={skeletonColumns} />;
}

function CreditCardsList() {
   const navigate = Route.useNavigate();
   const { columnFilters, page, pageSize, search, status } = Route.useSearch();
   const { openAlertDialog } = useAlertDialog();
   const { parse: parseCsv } = useCsvFile();
   const { parse: parseXlsx } = useXlsxFile();

   const { data: result } = useSuspenseQuery(
      orpc.creditCards.getAll.queryOptions({
         input: { page, pageSize, search: search || undefined, status },
      }),
   );

   const { data: bankAccounts } = useSuspenseQuery(
      orpc.bankAccounts.getAll.queryOptions({}),
   );

   const createMutation = useMutation(
      orpc.creditCards.create.mutationOptions({
         onSuccess: () => toast.success("Cartão criado com sucesso."),
         onError: (e) => toast.error(e.message),
      }),
   );

   const deleteMutation = useMutation(
      orpc.creditCards.remove.mutationOptions({
         onSuccess: () => {
            toast.success("Cartão de crédito excluído com sucesso.");
         },
         onError: (error) => {
            toast.error(error.message || "Erro ao excluir cartão de crédito.");
         },
      }),
   );

   const bulkDeleteMutation = useMutation(
      orpc.creditCards.bulkRemove.mutationOptions({
         onSuccess: ({ deleted }) => {
            toast.success(
               `${deleted} ${deleted === 1 ? "cartão excluído" : "cartões excluídos"} com sucesso.`,
            );
         },
         onError: (error) => {
            toast.error(error.message || "Erro ao excluir cartões.");
         },
      }),
   );

   const [isDraftActive, setIsDraftActive] = useState(false);

   const handleDiscardDraft = useCallback(() => setIsDraftActive(false), []);

   const handleAddCard = useCallback(
      async (data: Record<string, string | string[]>) => {
         const name = String(data.name ?? "").trim();
         const closingDay = parseInt(String(data.closingDay ?? ""), 10);
         const dueDay = parseInt(String(data.dueDay ?? ""), 10);
         const bankAccountId = String(data.bankAccountId ?? "").trim();
         if (!name || !closingDay || !dueDay || !bankAccountId) return;
         await createMutation.mutateAsync({
            name,
            closingDay,
            dueDay,
            bankAccountId,
            color: "#6366f1",
            creditLimit: "0",
         });
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
         mapRow: (row, i): Record<string, unknown> => ({
            id: `__import_${i}`,
            name: String(row.name ?? "").trim(),
            brand: String(row.brand ?? "") || null,
            color: "#6366f1",
            creditLimit: String(row.creditLimit ?? row.limite ?? "0"),
            closingDay:
               parseInt(String(row.closingDay ?? row.fechamento ?? "1"), 10) ||
               1,
            dueDay:
               parseInt(String(row.dueDay ?? row.vencimento ?? "1"), 10) || 1,
            status: "active",
         }),
         onImport: async (rows) => {
            const firstBankAccountId = bankAccounts?.[0]?.id;
            if (!firstBankAccountId) {
               toast.error(
                  "Nenhuma conta bancária disponível para importação.",
               );
               return;
            }
            await Promise.allSettled(
               rows.map((r) =>
                  createMutation.mutateAsync({
                     name: String(r.name ?? ""),
                     closingDay:
                        typeof r.closingDay === "number" ? r.closingDay : 1,
                     dueDay: typeof r.dueDay === "number" ? r.dueDay : 1,
                     bankAccountId: firstBankAccountId,
                     color: "#6366f1",
                     creditLimit: String(r.creditLimit ?? "0"),
                  }),
               ),
            );
         },
      }),
      [createMutation, parseCsv, parseXlsx, bankAccounts],
   );

   const handleDelete = useCallback(
      (card: CreditCardRow) => {
         openAlertDialog({
            title: "Excluir cartão de crédito",
            description: `Tem certeza que deseja excluir o cartão "${card.name}"? Esta ação não pode ser desfeita.`,
            actionLabel: "Excluir",
            cancelLabel: "Cancelar",
            variant: "destructive",
            onAction: async () => {
               await deleteMutation.mutateAsync({ id: card.id });
            },
         });
      },
      [openAlertDialog, deleteMutation],
   );

   const columns = useMemo(
      () =>
         buildCreditCardColumns({
            bankAccounts: (bankAccounts ?? []) as Array<{
               id: string;
               name: string;
            }>,
         }),
      [bankAccounts],
   );

   return (
      <DataTableRoot
         columns={columns}
         data={result.data}
         getRowId={(row) => row.id}
         storageKey="montte:datatable:credit-cards"
         columnFilters={columnFilters}
         onColumnFiltersChange={(updater) => {
            const next =
               typeof updater === "function" ? updater(columnFilters) : updater;
            const statusFilter = next.find((f) => f.id === "status");
            navigate({
               search: (prev) => ({
                  ...prev,
                  columnFilters: next,
                  status:
                     (statusFilter?.value as
                        | "active"
                        | "blocked"
                        | "cancelled") ?? undefined,
                  page: 1,
               }),
               replace: true,
            });
         }}
         isDraftRowActive={isDraftActive}
         onAddRow={handleAddCard}
         onDiscardAddRow={handleDiscardDraft}
         renderExpandedRow={(props) => (
            <CreditCardFaturaRow creditCardId={props.row.original.id} />
         )}
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
         <DataTableToolbar>
            <DataTableImportButton importConfig={importConfig} />
            <Button
               onClick={() => setIsDraftActive(true)}
               size="icon-sm"
               tooltip="Novo Cartão"
               variant="outline"
            >
               <Plus />
            </Button>
         </DataTableToolbar>
         <DataTableEmptyState>
            <Empty>
               <EmptyHeader>
                  <EmptyMedia variant="icon">
                     <CreditCard className="size-6" />
                  </EmptyMedia>
                  <EmptyTitle>Nenhum cartão de crédito</EmptyTitle>
                  <EmptyDescription>
                     Adicione um cartão de crédito para controlar seus gastos.
                  </EmptyDescription>
               </EmptyHeader>
            </Empty>
         </DataTableEmptyState>
         <DataTableContent />
         <DataTableBulkActions<CreditCardRow>>
            {({ selectedRows, clearSelection }) => (
               <SelectionActionButton
                  icon={<Trash2 className="size-3.5" />}
                  variant="destructive"
                  onClick={() => {
                     const ids = selectedRows.map((r) => r.id);
                     openAlertDialog({
                        title: `Excluir ${ids.length} ${ids.length === 1 ? "cartão" : "cartões"}`,
                        description:
                           "Tem certeza que deseja excluir os cartões selecionados? Esta ação não pode ser desfeita.",
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
      </DataTableRoot>
   );
}

function CreditCardsPage() {
   return (
      <main className="flex flex-col gap-4">
         <DefaultHeader
            description="Gerencie seus cartões de crédito"
            title="Cartões de Crédito"
         />
         <QueryBoundary
            fallback={<CreditCardsSkeleton />}
            errorTitle="Erro ao carregar cartões"
         >
            <CreditCardsList />
         </QueryBoundary>
      </main>
   );
}
