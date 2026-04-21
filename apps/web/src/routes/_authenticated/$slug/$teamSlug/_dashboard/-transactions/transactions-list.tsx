import { Button } from "@packages/ui/components/button";
import {
   Empty,
   EmptyDescription,
   EmptyHeader,
   EmptyMedia,
   EmptyTitle,
} from "@packages/ui/components/empty";
import {
   useMutation,
   useQueryClient,
   useSuspenseQuery,
} from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import dayjs from "dayjs";
import {
   AlertTriangle,
   ArrowLeftRight,
   Ban,
   CheckCircle2,
   FolderOpen,
   Landmark,
   Plus,
   RotateCcw,
   Trash2,
   Undo2,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import {
   DataTableBulkActions,
   SelectionActionButton,
} from "@/components/data-table/data-table-bulk-actions";
import { DataTableContent } from "@/components/data-table/data-table-content";
import { DataTableEmptyState } from "@/components/data-table/data-table-empty-state";
import { DataTableImportButton } from "@/components/data-table/data-table-import";
import type { DataTableImportConfig } from "@/components/data-table/data-table-import";
import { DataTablePagination } from "@/components/data-table/data-table-pagination";
import {
   DataTableExternalFilter,
   DataTableRoot,
} from "@/components/data-table/data-table-root";
import { DataTableToolbar } from "@/components/data-table/data-table-toolbar";
import { useCsvFile } from "@/hooks/use-csv-file";
import { useXlsxFile } from "@/hooks/use-xlsx-file";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useCredenza } from "@/hooks/use-credenza";
import { orpc } from "@/integrations/orpc/client";
import { BulkCategorizeForm } from "./bulk-categorize-form";
import { BulkMoveAccountForm } from "./bulk-move-account-form";
import { MarkPaidCredenza } from "./mark-paid-credenza";
import {
   buildTransactionColumns,
   type TransactionRow,
} from "./transactions-columns";

const routeApi = getRouteApi(
   "/_authenticated/$slug/$teamSlug/_dashboard/transactions",
);

export function TransactionsList() {
   const navigate = routeApi.useNavigate();
   const { page, pageSize, view, overdueOnly, status, search } =
      routeApi.useSearch();

   const { openCredenza, closeCredenza } = useCredenza();
   const { openAlertDialog } = useAlertDialog();
   const queryClient = useQueryClient();
   const [isDraftActive, setIsDraftActive] = useState(false);
   const { parse: parseCsv } = useCsvFile();
   const { parse: parseXlsx } = useXlsxFile();

   const handleSearch = useCallback(
      (value: string) => {
         navigate({
            search: (prev) => ({ ...prev, search: value, page: 1 }),
            replace: true,
         });
      },
      [navigate],
   );

   const handleOverdueToggle = useCallback(
      (checked: boolean) => {
         navigate({
            search: (prev) => ({ ...prev, overdueOnly: checked, page: 1 }),
            replace: true,
         });
      },
      [navigate],
   );

   const handlePageChange = useCallback(
      (newPage: number) => {
         navigate({
            search: (prev) => ({ ...prev, page: newPage }),
            replace: true,
         });
      },
      [navigate],
   );

   const handlePageSizeChange = useCallback(
      (newPageSize: number) => {
         navigate({
            search: (prev) => ({ ...prev, pageSize: newPageSize, page: 1 }),
            replace: true,
         });
      },
      [navigate],
   );

   const { data: result } = useSuspenseQuery(
      orpc.transactions.getAll.queryOptions({
         input: {
            search: search || undefined,
            view,
            overdueOnly,
            status: status.length > 0 ? status : undefined,
            page,
            pageSize,
         },
      }),
   );

   const { data: bankAccounts } = useSuspenseQuery(
      orpc.bankAccounts.getAll.queryOptions({}),
   );

   const { data: contacts } = useSuspenseQuery(
      orpc.contacts.getAll.queryOptions({}),
   );

   const { data: categoriesResult } = useSuspenseQuery(
      orpc.categories.getAll.queryOptions({}),
   );

   const { data: creditCardsResult } = useSuspenseQuery(
      orpc.creditCards.getAll.queryOptions({ input: { pageSize: 100 } }),
   );

   const transactionData = result.data;
   const total = result.total;
   const totalPages = Math.max(1, Math.ceil(total / pageSize));

   const createMutation = useMutation(
      orpc.transactions.create.mutationOptions({
         onSuccess: () => {
            toast.success("Lançamento criado com sucesso.");
            setIsDraftActive(false);
         },
         onError: (error) =>
            toast.error(error.message || "Erro ao criar lançamento."),
      }),
   );

   const importMutation = useMutation(
      orpc.transactions.create.mutationOptions({
         meta: { skipGlobalInvalidation: true },
      }),
   );

   const deleteMutation = useMutation(
      orpc.transactions.remove.mutationOptions({
         onSuccess: () => toast.success("Lançamento excluído com sucesso."),
         onError: (error) =>
            toast.error(error.message || "Erro ao excluir lançamento."),
      }),
   );

   const updateMutation = useMutation(
      orpc.transactions.update.mutationOptions({
         onError: (error) =>
            toast.error(error.message || "Erro ao atualizar lançamentos."),
      }),
   );

   const markAsPaidMutation = useMutation(
      orpc.transactions.markAsPaid.mutationOptions({
         onSuccess: () => toast.success("Lançamento marcado como pago."),
         onError: (error) =>
            toast.error(error.message || "Erro ao marcar como pago."),
      }),
   );

   const markAsUnpaidMutation = useMutation(
      orpc.transactions.markAsUnpaid.mutationOptions({
         onSuccess: () => toast.success("Pagamento desmarcado."),
         onError: (error) =>
            toast.error(error.message || "Erro ao desmarcar pagamento."),
      }),
   );

   const cancelMutation = useMutation(
      orpc.transactions.cancel.mutationOptions({
         onSuccess: () => toast.success("Lançamento cancelado."),
         onError: (error) =>
            toast.error(error.message || "Erro ao cancelar lançamento."),
      }),
   );

   const reactivateMutation = useMutation(
      orpc.transactions.reactivate.mutationOptions({
         onSuccess: () => toast.success("Lançamento reativado."),
         onError: (error) =>
            toast.error(error.message || "Erro ao reativar lançamento."),
      }),
   );

   const createBankAccountMutation = useMutation(
      orpc.bankAccounts.create.mutationOptions({
         onError: (error) =>
            toast.error(error.message || "Erro ao criar conta bancária."),
      }),
   );

   const createContactMutation = useMutation(
      orpc.contacts.create.mutationOptions({
         onError: (error) =>
            toast.error(error.message || "Erro ao criar contato."),
      }),
   );

   const createCategoryMutation = useMutation(
      orpc.categories.create.mutationOptions({
         onError: (error) =>
            toast.error(error.message || "Erro ao criar categoria."),
      }),
   );

   const handleUpdate = useCallback(
      async (id: string, patch: Record<string, unknown>) => {
         await updateMutation.mutateAsync({ id, ...patch });
      },
      [updateMutation],
   );

   const handleCreateBankAccount = useCallback(
      async (name: string): Promise<string> => {
         const result = await createBankAccountMutation.mutateAsync({
            name,
            type: "checking",
         });
         return result.id;
      },
      [createBankAccountMutation],
   );

   const handleCreateContact = useCallback(
      async (name: string): Promise<string> => {
         const result = await createContactMutation.mutateAsync({
            name,
            type: "ambos",
         });
         return result.id;
      },
      [createContactMutation],
   );

   const handleCreateCategory = useCallback(
      async (name: string): Promise<string> => {
         const result = await createCategoryMutation.mutateAsync({
            name,
            type: "expense",
         });
         return result.id;
      },
      [createCategoryMutation],
   );

   const handleCreate = useCallback(() => {
      setIsDraftActive(true);
   }, []);

   const handleDiscardDraft = useCallback(() => {
      setIsDraftActive(false);
   }, []);

   const handleAddTransaction = useCallback(
      async (data: Record<string, string | string[]>) => {
         const type = String(data.type || "expense") as
            | "income"
            | "expense"
            | "transfer";
         const name = String(data.name ?? "").trim() || null;
         const amount = String(data.amount || "");
         const date =
            String(data.date || "").trim() || dayjs().format("YYYY-MM-DD");
         const bankAccountId = String(data.bankAccountName || "") || null;
         const contactId = String(data.contactName || "") || null;
         const categoryId = String(data.categoryName || "") || null;
         const creditCardId = String(data.creditCardName || "") || null;
         const dueDate = String(data.dueDate || "").trim() || null;
         const txStatus = String(data.status || "pending") as
            | "pending"
            | "paid"
            | "cancelled";

         await createMutation.mutateAsync({
            type,
            name,
            amount,
            date,
            bankAccountId,
            destinationBankAccountId: null,
            categoryId,
            attachments: [],
            description: null,
            contactId,
            creditCardId,
            paymentMethod: null,
            status: txStatus,
            dueDate,
         });
      },
      [createMutation],
   );

   const handleDelete = useCallback(
      (transaction: TransactionRow) => {
         openAlertDialog({
            title: "Excluir lançamento",
            description:
               "Tem certeza que deseja excluir este lançamento? Esta ação não pode ser desfeita.",
            actionLabel: "Excluir",
            cancelLabel: "Cancelar",
            variant: "destructive",
            onAction: async () => {
               await deleteMutation.mutateAsync({ id: transaction.id });
            },
         });
      },
      [openAlertDialog, deleteMutation],
   );

   const handleMarkPaid = useCallback(
      (tx: TransactionRow) => {
         markAsPaidMutation.mutate({
            id: tx.id,
            paidDate: dayjs().format("YYYY-MM-DD"),
         });
      },
      [markAsPaidMutation],
   );

   const handleMarkUnpaid = useCallback(
      (tx: TransactionRow) => {
         markAsUnpaidMutation.mutate({ id: tx.id });
      },
      [markAsUnpaidMutation],
   );

   const handleCancel = useCallback(
      (tx: TransactionRow) => {
         openAlertDialog({
            title: "Cancelar lançamento",
            description:
               "Tem certeza que deseja cancelar este lançamento? Ele ficará marcado como cancelado.",
            actionLabel: "Cancelar lançamento",
            cancelLabel: "Voltar",
            variant: "destructive",
            onAction: async () => {
               await cancelMutation.mutateAsync({ id: tx.id });
            },
         });
      },
      [openAlertDialog, cancelMutation],
   );

   const handleReactivate = useCallback(
      (tx: TransactionRow) => {
         reactivateMutation.mutate({ id: tx.id, paid: false });
      },
      [reactivateMutation],
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
         mapRow: (row, i) => {
            const rawDate = String(row.date ?? "").trim();
            const rawAmount = String(row.amount ?? "").trim();
            const rawType = String(row.type ?? "").trim();

            const dateMatch = rawDate.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
            const date = dateMatch
               ? `${dateMatch[3]}-${dateMatch[2].padStart(2, "0")}-${dateMatch[1].padStart(2, "0")}`
               : rawDate;

            const amountNum = parseFloat(
               rawAmount.replace(/[R$\s.]/g, "").replace(",", "."),
            );
            const amount = Number.isNaN(amountNum)
               ? ""
               : Math.abs(amountNum).toString();

            const lower = rawType.toLowerCase();
            let type: "income" | "expense" = "expense";
            if (
               lower.includes("créd") ||
               lower.includes("cred") ||
               lower === "c" ||
               lower.includes("entrada") ||
               lower.includes("receita")
            ) {
               type = "income";
            } else if (
               !(
                  lower.includes("déb") ||
                  lower.includes("deb") ||
                  lower === "d" ||
                  lower.includes("saíd") ||
                  lower.includes("said") ||
                  lower.includes("despesa")
               )
            ) {
               type = amountNum < 0 ? "expense" : "income";
            }

            return {
               id: `__import_${i}`,
               date,
               amount,
               type,
               name: String(row.name ?? "").trim() || null,
               status: "pending",
               dueDate: null,
               bankAccountName: null,
               bankAccountId: null,
               contactName: null,
               categoryName: null,
               creditCardName: null,
               suggestedCategoryId: null,
               suggestedCategoryName: null,
            };
         },
         onImport: async (rows) => {
            const results = await Promise.allSettled(
               rows.map((r) => {
                  const date = String(r.date ?? "");
                  const amount = String(r.amount ?? "");
                  if (!date || !amount)
                     return Promise.reject(new Error("skip"));
                  return importMutation.mutateAsync({
                     type: (r.type as "income" | "expense") ?? "expense",
                     amount,
                     date,
                     name: r.name ? String(r.name) : null,
                     bankAccountId: null,
                     destinationBankAccountId: null,
                     categoryId: null,
                     attachments: [],
                     description: null,
                     contactId: null,
                     creditCardId: null,
                     paymentMethod: null,
                     status: "pending",
                     dueDate: null,
                     autoCategorize: true,
                  });
               }),
            );
            const ok = results.filter((r) => r.status === "fulfilled").length;
            const failed = results.filter(
               (r) =>
                  r.status === "rejected" &&
                  (r.reason as Error)?.message !== "skip",
            ).length;
            if (ok > 0) toast.success(`${ok} lançamento(s) importado(s).`);
            if (failed > 0) toast.error(`${failed} lançamento(s) com erro.`);
            await queryClient.invalidateQueries({
               queryKey: orpc.transactions.getAll.queryKey(),
            });
         },
      }),
      [parseCsv, parseXlsx, importMutation, queryClient],
   );

   const columns = useMemo(
      () =>
         buildTransactionColumns({
            bankAccounts,
            contacts,
            categories: categoriesResult,
            creditCards: creditCardsResult.data,
            onUpdate: handleUpdate,
            onCreateBankAccount: handleCreateBankAccount,
            onCreateContact: handleCreateContact,
            onCreateCategory: handleCreateCategory,
         }),
      [
         bankAccounts,
         contacts,
         categoriesResult,
         creditCardsResult,
         handleUpdate,
         handleCreateBankAccount,
         handleCreateContact,
         handleCreateCategory,
      ],
   );

   return (
      <div className="flex flex-1 flex-col gap-4 min-h-0">
         <DataTableRoot
            columns={columns}
            data={transactionData}
            getRowId={(row) => row.id}
            isDraftRowActive={isDraftActive}
            onAddRow={handleAddTransaction}
            onDiscardAddRow={handleDiscardDraft}
            renderActions={({ row }) => {
               const tx = row.original;
               const { status: rowStatus } = tx;
               return (
                  <>
                     {rowStatus === "pending" && (
                        <Button
                           className="text-green-600 hover:text-green-700"
                           onClick={() => handleMarkPaid(tx)}
                           size="icon"
                           tooltip="Marcar como pago"
                           variant="ghost"
                        >
                           <CheckCircle2 className="size-4" />
                           <span className="sr-only">Marcar como pago</span>
                        </Button>
                     )}
                     {rowStatus === "paid" && (
                        <Button
                           onClick={() => handleMarkUnpaid(tx)}
                           size="icon"
                           tooltip="Desmarcar pago"
                           variant="ghost"
                        >
                           <Undo2 className="size-4" />
                           <span className="sr-only">Desmarcar pago</span>
                        </Button>
                     )}
                     {rowStatus === "cancelled" && (
                        <Button
                           onClick={() => handleReactivate(tx)}
                           size="icon"
                           tooltip="Reativar"
                           variant="ghost"
                        >
                           <RotateCcw className="size-4" />
                           <span className="sr-only">Reativar</span>
                        </Button>
                     )}
                     {(rowStatus === "pending" || rowStatus === "paid") && (
                        <Button
                           onClick={() => handleCancel(tx)}
                           size="icon"
                           tooltip="Cancelar"
                           variant="ghost"
                        >
                           <Ban className="size-4" />
                           <span className="sr-only">Cancelar</span>
                        </Button>
                     )}
                     <Button
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDelete(tx)}
                        size="icon"
                        tooltip="Excluir"
                        variant="ghost"
                     >
                        <Trash2 className="size-4" />
                        <span className="sr-only">Excluir</span>
                     </Button>
                  </>
               );
            }}
            storageKey="montte:datatable:transactions"
         >
            <DataTableExternalFilter
               id="overdueOnly"
               label="Somente vencidos"
               group="Filtros"
               active={overdueOnly}
               renderIcon={() => <AlertTriangle className="size-4" />}
               onToggle={handleOverdueToggle}
            />
            <DataTableToolbar
               searchPlaceholder="Buscar por nome, descrição ou contato..."
               searchDefaultValue={search}
               onSearch={handleSearch}
            >
               <DataTableImportButton importConfig={importConfig} />
               <Button
                  onClick={handleCreate}
                  tooltip="Novo Lançamento"
                  variant="outline"
                  size="icon-sm"
               >
                  <Plus />
                  <span className="sr-only">Novo Lançamento</span>
               </Button>
            </DataTableToolbar>
            <DataTableEmptyState>
               <Empty>
                  <EmptyHeader>
                     <EmptyMedia variant="icon">
                        <ArrowLeftRight className="size-6" />
                     </EmptyMedia>
                     <EmptyTitle>Nenhum lançamento</EmptyTitle>
                     <EmptyDescription>
                        {search
                           ? "Nenhum lançamento encontrado para os filtros aplicados."
                           : "Registre um novo lançamento para começar a controlar suas finanças."}
                     </EmptyDescription>
                  </EmptyHeader>
               </Empty>
            </DataTableEmptyState>
            <DataTableContent className="flex-1 overflow-auto min-h-0" />
            <DataTableBulkActions<TransactionRow>>
               {({ selectedRows, clearSelection }) => {
                  const pendingIds = selectedRows
                     .filter((r) => r.status === "pending")
                     .map((r) => r.id);
                  const selectedIds = selectedRows.map((r) => r.id);
                  const allPending =
                     pendingIds.length === selectedIds.length &&
                     selectedIds.length > 0;
                  return (
                     <>
                        {allPending && (
                           <SelectionActionButton
                              icon={<CheckCircle2 />}
                              onClick={() =>
                                 openCredenza({
                                    renderChildren: () => (
                                       <MarkPaidCredenza
                                          ids={selectedIds}
                                          onSuccess={() => {
                                             clearSelection();
                                             closeCredenza();
                                          }}
                                       />
                                    ),
                                 })
                              }
                           >
                              Marcar como pagas
                           </SelectionActionButton>
                        )}
                        <SelectionActionButton
                           icon={<FolderOpen />}
                           onClick={() =>
                              openCredenza({
                                 renderChildren: () => (
                                    <BulkCategorizeForm
                                       onApply={async (categoryId) => {
                                          await Promise.all(
                                             selectedIds.map((id) =>
                                                updateMutation.mutateAsync({
                                                   id,
                                                   categoryId,
                                                }),
                                             ),
                                          );
                                          clearSelection();
                                          closeCredenza();
                                          toast.success(
                                             `${selectedIds.length} ${selectedIds.length === 1 ? "lançamento categorizado" : "lançamentos categorizados"}.`,
                                          );
                                       }}
                                       onCancel={closeCredenza}
                                       selectedCount={selectedIds.length}
                                    />
                                 ),
                              })
                           }
                        >
                           Categorizar
                        </SelectionActionButton>
                        <SelectionActionButton
                           icon={<Landmark />}
                           onClick={() =>
                              openCredenza({
                                 renderChildren: () => (
                                    <BulkMoveAccountForm
                                       bankAccounts={bankAccounts}
                                       onApply={async (
                                          bankAccountId,
                                          destinationBankAccountId,
                                       ) => {
                                          await Promise.all(
                                             selectedIds.map((id) =>
                                                updateMutation.mutateAsync({
                                                   id,
                                                   bankAccountId,
                                                   destinationBankAccountId,
                                                }),
                                             ),
                                          );
                                          clearSelection();
                                          closeCredenza();
                                          toast.success(
                                             `${selectedIds.length} ${selectedIds.length === 1 ? "lançamento convertido" : "lançamentos convertidos"} em transferências.`,
                                          );
                                       }}
                                       onCancel={closeCredenza}
                                       selectedCount={selectedIds.length}
                                    />
                                 ),
                              })
                           }
                        >
                           Mover conta
                        </SelectionActionButton>
                        <SelectionActionButton
                           icon={<Trash2 />}
                           onClick={() =>
                              openAlertDialog({
                                 title: `Excluir ${selectedIds.length} ${selectedIds.length === 1 ? "lançamento" : "lançamentos"}`,
                                 description:
                                    "Tem certeza que deseja excluir os lançamentos selecionados? Esta ação não pode ser desfeita.",
                                 actionLabel: "Excluir",
                                 cancelLabel: "Cancelar",
                                 variant: "destructive",
                                 onAction: async () => {
                                    await Promise.all(
                                       selectedIds.map((id) =>
                                          deleteMutation.mutateAsync({ id }),
                                       ),
                                    );
                                    clearSelection();
                                 },
                              })
                           }
                           variant="destructive"
                        >
                           Excluir
                        </SelectionActionButton>
                     </>
                  );
               }}
            </DataTableBulkActions>
         </DataTableRoot>
         <DataTablePagination
            currentPage={page}
            totalPages={totalPages}
            totalCount={total}
            pageSize={pageSize}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
         />
      </div>
   );
}
