import { Button } from "@packages/ui/components/button";
import { Calendar } from "@packages/ui/components/calendar";
import { Combobox } from "@packages/ui/components/combobox";
import {
   Empty,
   EmptyDescription,
   EmptyHeader,
   EmptyMedia,
   EmptyTitle,
} from "@packages/ui/components/empty";
import {
   Popover,
   PopoverContent,
   PopoverTrigger,
} from "@packages/ui/components/popover";
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
   CalendarDays,
   CheckCircle2,
   CircleDot,
   FolderOpen,
   Landmark,
   Plus,
   RotateCcw,
   Trash2,
   Undo2,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { useSheet } from "@/hooks/use-sheet";
import { TransactionFormSheet } from "./transaction-form-sheet";
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
import { useOfxFile } from "@/hooks/use-ofx-file";
import { useXlsxFile } from "@/hooks/use-xlsx-file";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { orpc } from "@/integrations/orpc/client";
import {
   buildTransactionColumns,
   type BankAccountOption,
   type CategoryOption,
   type TransactionRow,
} from "./transactions-columns";

const routeApi = getRouteApi(
   "/_authenticated/$slug/$teamSlug/_dashboard/transactions",
);

type ImportLookupItem = { id: string; name: string };

function normalizeImportLookup(value: unknown): string {
   return String(value ?? "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
}

function resolveImportId(
   options: ImportLookupItem[],
   value: unknown,
): string | null {
   const normalized = normalizeImportLookup(value);
   if (!normalized) return null;
   const option = options.find(
      (item) =>
         normalizeImportLookup(item.id) === normalized ||
         normalizeImportLookup(item.name) === normalized,
   );
   return option?.id ?? null;
}

function parseImportDate(value: unknown): string {
   const raw = String(value ?? "").trim();
   const match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
   if (!match) return raw;
   return `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
}

function parseImportAmount(value: unknown) {
   const cleaned = String(value ?? "")
      .replace(/[R$\s]/g, "")
      .trim();
   const raw = cleaned.includes(",")
      ? cleaned.replace(/\./g, "").replace(",", ".")
      : cleaned;
   const parsed = Number.parseFloat(raw);
   if (Number.isNaN(parsed)) return { amount: "", signedAmount: 0 };
   return { amount: Math.abs(parsed).toFixed(2), signedAmount: parsed };
}

function parseImportType(
   value: unknown,
   signedAmount: number,
): "income" | "expense" {
   const normalized = normalizeImportLookup(value);
   if (
      normalized === "income" ||
      normalized.includes("cred") ||
      normalized.includes("entrada") ||
      normalized.includes("receita")
   ) {
      return "income";
   }
   if (
      normalized === "expense" ||
      normalized.includes("deb") ||
      normalized.includes("saida") ||
      normalized.includes("despesa")
   ) {
      return "expense";
   }
   return signedAmount < 0 ? "expense" : "income";
}

function parseImportStatus(value: unknown): "pending" | "paid" | "cancelled" {
   const normalized = normalizeImportLookup(value);
   if (normalized === "paid" || normalized.includes("efetivado")) {
      return "paid";
   }
   if (normalized === "cancelled" || normalized.includes("cancelado")) {
      return "cancelled";
   }
   return "pending";
}

export function TransactionsList() {
   const navigate = routeApi.useNavigate();
   const {
      page,
      pageSize,
      view,
      overdueOnly,
      status,
      search,
      contactId,
      bankId,
   } = routeApi.useSearch();

   const { openAlertDialog } = useAlertDialog();
   const { openSheet } = useSheet();
   const queryClient = useQueryClient();
   const { parse: parseCsv, generate: generateCsv } = useCsvFile();
   const { parse: parseXlsx, generate: generateXlsx } = useXlsxFile();
   const { parse: parseOfx } = useOfxFile();

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

   const handleBankFilterToggle = useCallback(
      (active: boolean) => {
         if (active) return;
         navigate({
            search: (prev) => ({ ...prev, bankId: "", page: 1 }),
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
            contactId: contactId || undefined,
            bankAccountId: bankId || undefined,
         },
      }),
   );

   const { data: bankAccounts } = useSuspenseQuery(
      orpc.bankAccounts.getAll.queryOptions({}),
   );

   const selectedBankAccount = useMemo(
      () => bankAccounts.find((account) => account.id === bankId),
      [bankAccounts, bankId],
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

   const importMutation = useMutation(
      orpc.transactions.importBulk.mutationOptions({
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
         onSuccess: () => toast.success("Lançamento ignorado."),
         onError: (error) =>
            toast.error(error.message || "Erro ao ignorar lançamento."),
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
      openSheet({ renderChildren: () => <TransactionFormSheet /> });
   }, [openSheet]);

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
            title: "Ignorar lançamento",
            description:
               "Tem certeza que deseja ignorar este lançamento? Ele não entrará nos cálculos financeiros.",
            actionLabel: "Ignorar lançamento",
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
            "application/x-ofx": [".ofx"],
         },
         parseFile: async (file: File) => {
            const ext = file.name.split(".").pop()?.toLowerCase();
            if (ext === "ofx") return parseOfx(file);
            if (ext === "xlsx" || ext === "xls") return parseXlsx(file);
            return parseCsv(file);
         },
         mapRow: (row, i) => {
            const parsedAmount = parseImportAmount(row.amount);
            const type = parseImportType(row.type, parsedAmount.signedAmount);

            return {
               id: `__import_${i}`,
               date: parseImportDate(row.date),
               amount: parsedAmount.amount,
               type,
               name: String(row.name ?? "").trim() || null,
               status: parseImportStatus(row.status),
               dueDate: row.dueDate ? parseImportDate(row.dueDate) : null,
               bankAccountName: String(row.bankAccountName ?? "").trim(),
               bankAccountId: resolveImportId(
                  bankAccounts,
                  row.bankAccountName,
               ),
               contactName: String(row.contactName ?? "").trim(),
               contactId: resolveImportId(contacts, row.contactName),
               categoryName: String(row.categoryName ?? "").trim(),
               categoryId: resolveImportId(categoriesResult, row.categoryName),
               creditCardName: String(row.creditCardName ?? "").trim(),
               creditCardId: resolveImportId(
                  creditCardsResult.data,
                  row.creditCardName,
               ),
               suggestedCategoryId: null,
               suggestedCategoryName: null,
            };
         },
         template: {
            label: "Baixar modelo",
            description:
               "Inclui Data, Nome, Tipo, Valor, Status e referências por nome.",
            formats: [
               {
                  filename: "modelo-lancamentos.csv",
                  label: "CSV",
                  createBlob: () =>
                     generateCsv(
                        [
                           {
                              Data: dayjs().format("YYYY-MM-DD"),
                              Nome: "Venda recebida",
                              Tipo: "Receita",
                              Valor: "1500.00",
                              Status: "Efetivado",
                              Vencimento: "",
                              Conta: bankAccounts[0]?.name ?? "",
                              Cartão: "",
                              Categoria: categoriesResult[0]?.name ?? "",
                              "Fornecedor/Cliente": contacts[0]?.name ?? "",
                           },
                           {
                              Data: dayjs().format("YYYY-MM-DD"),
                              Nome: "Compra no cartão",
                              Tipo: "Despesa",
                              Valor: "250.00",
                              Status: "Pendente",
                              Vencimento: dayjs()
                                 .add(7, "day")
                                 .format("YYYY-MM-DD"),
                              Conta: "",
                              Cartão: creditCardsResult.data[0]?.name ?? "",
                              Categoria: categoriesResult[0]?.name ?? "",
                              "Fornecedor/Cliente": contacts[0]?.name ?? "",
                           },
                        ],
                        [
                           "Data",
                           "Nome",
                           "Tipo",
                           "Valor",
                           "Status",
                           "Vencimento",
                           "Conta",
                           "Cartão",
                           "Categoria",
                           "Fornecedor/Cliente",
                        ],
                     ),
               },
               {
                  filename: "modelo-lancamentos.xlsx",
                  label: "XLSX",
                  createBlob: () =>
                     generateXlsx(
                        [
                           {
                              Data: dayjs().format("YYYY-MM-DD"),
                              Nome: "Venda recebida",
                              Tipo: "Receita",
                              Valor: "1500.00",
                              Status: "Efetivado",
                              Vencimento: "",
                              Conta: bankAccounts[0]?.name ?? "",
                              Cartão: "",
                              Categoria: categoriesResult[0]?.name ?? "",
                              "Fornecedor/Cliente": contacts[0]?.name ?? "",
                           },
                           {
                              Data: dayjs().format("YYYY-MM-DD"),
                              Nome: "Compra no cartão",
                              Tipo: "Despesa",
                              Valor: "250.00",
                              Status: "Pendente",
                              Vencimento: dayjs()
                                 .add(7, "day")
                                 .format("YYYY-MM-DD"),
                              Conta: "",
                              Cartão: creditCardsResult.data[0]?.name ?? "",
                              Categoria: categoriesResult[0]?.name ?? "",
                              "Fornecedor/Cliente": contacts[0]?.name ?? "",
                           },
                        ],
                        [
                           "Data",
                           "Nome",
                           "Tipo",
                           "Valor",
                           "Status",
                           "Vencimento",
                           "Conta",
                           "Cartão",
                           "Categoria",
                           "Fornecedor/Cliente",
                        ],
                     ),
               },
            ],
         },
         onImport: async (rows) => {
            const transactions = rows.flatMap((r) => {
               const date = String(r.date ?? "");
               const amount = String(r.amount ?? "");
               if (!date || !amount) return [];
               const bankAccountId =
                  resolveImportId(bankAccounts, r.bankAccountId) ??
                  resolveImportId(bankAccounts, r.bankAccountName);
               const creditCardId =
                  resolveImportId(creditCardsResult.data, r.creditCardId) ??
                  resolveImportId(creditCardsResult.data, r.creditCardName);
               if (!bankAccountId && !creditCardId) return [];
               return [
                  {
                     type: parseImportType(r.type, 1),
                     amount,
                     date,
                     name: r.name ? String(r.name) : null,
                     bankAccountId,
                     destinationBankAccountId: null,
                     categoryId:
                        resolveImportId(categoriesResult, r.categoryId) ??
                        resolveImportId(categoriesResult, r.categoryName),
                     attachments: [],
                     description: null,
                     contactId:
                        resolveImportId(contacts, r.contactId) ??
                        resolveImportId(contacts, r.contactName),
                     creditCardId,
                     paymentMethod: null,
                     status: parseImportStatus(r.status),
                     dueDate: r.dueDate ? String(r.dueDate) : null,
                  },
               ];
            });
            if (transactions.length === 0) {
               throw new Error(
                  "Nenhum lançamento válido para importar. Preencha data, valor e conta ou cartão.",
               );
            }
            await importMutation.mutateAsync({
               transactions,
               autoCategorize: true,
            });
            await queryClient.invalidateQueries({
               queryKey: orpc.transactions.getAll.queryKey(),
            });
         },
      }),
      [
         parseCsv,
         parseXlsx,
         parseOfx,
         generateCsv,
         generateXlsx,
         bankAccounts,
         categoriesResult,
         contacts,
         creditCardsResult.data,
         importMutation,
         queryClient,
      ],
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
            getRowStatus: (id) =>
               transactionData.find((t) => t.id === id)?.status,
         }),
      [
         bankAccounts,
         contacts,
         categoriesResult,
         creditCardsResult,
         transactionData,
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
                           tooltip="Marcar como efetivado"
                           variant="ghost"
                        >
                           <CheckCircle2 className="size-4" />
                           <span className="sr-only">
                              Marcar como efetivado
                           </span>
                        </Button>
                     )}
                     {rowStatus === "paid" && (
                        <Button
                           onClick={() => handleMarkUnpaid(tx)}
                           size="icon"
                           tooltip="Marcar como pendente"
                           variant="ghost"
                        >
                           <Undo2 className="size-4" />
                           <span className="sr-only">Marcar como pendente</span>
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
                           tooltip="Ignorar lançamento"
                           variant="ghost"
                        >
                           <Ban className="size-4" />
                           <span className="sr-only">Ignorar lançamento</span>
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
            {bankId ? (
               <DataTableExternalFilter
                  id="bankId"
                  label={selectedBankAccount?.name ?? "Conta selecionada"}
                  group="Conta"
                  active
                  renderIcon={() => <Landmark className="size-4" />}
                  onToggle={handleBankFilterToggle}
               />
            ) : null}
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
                        {search || bankId
                           ? "Nenhum lançamento encontrado para os filtros aplicados."
                           : "Registre um novo lançamento para começar a controlar suas finanças."}
                     </EmptyDescription>
                  </EmptyHeader>
               </Empty>
            </DataTableEmptyState>
            <DataTableContent className="flex-1 overflow-auto min-h-0" />
            <DataTableBulkActions<TransactionRow>>
               {({ selectedRows, clearSelection }) => {
                  const selectedIds = selectedRows.map((r) => r.id);
                  return (
                     <>
                        <BulkIgnoreButton
                           ids={selectedIds}
                           onSuccess={clearSelection}
                        />
                        <BulkStatusButton
                           ids={selectedIds}
                           onSuccess={clearSelection}
                        />
                        <BulkDateButton
                           ids={selectedIds}
                           onSuccess={clearSelection}
                        />
                        <BulkCategoryButton
                           categories={categoriesResult ?? []}
                           ids={selectedIds}
                           onSuccess={clearSelection}
                        />
                        <BulkAccountButton
                           bankAccounts={bankAccounts}
                           ids={selectedIds}
                           onSuccess={clearSelection}
                        />
                        <SelectionActionButton
                           icon={<Trash2 />}
                           variant="destructive"
                           onClick={() =>
                              openAlertDialog({
                                 title: `Excluir ${selectedIds.length} ${selectedIds.length === 1 ? "lançamento" : "lançamentos"}`,
                                 description:
                                    "Tem certeza que deseja excluir os lançamentos selecionados? Esta ação não pode ser desfeita.",
                                 actionLabel: "Excluir",
                                 cancelLabel: "Cancelar",
                                 variant: "destructive",
                                 onAction: async () => {
                                    await Promise.allSettled(
                                       selectedIds.map((id) =>
                                          deleteMutation.mutateAsync({ id }),
                                       ),
                                    );
                                    clearSelection();
                                 },
                              })
                           }
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

function BulkIgnoreButton({
   ids,
   onSuccess,
}: {
   ids: string[];
   onSuccess: () => void;
}) {
   const { openAlertDialog } = useAlertDialog();
   const mutation = useMutation(
      orpc.transactions.update.mutationOptions({
         onError: (e) =>
            toast.error(e.message || "Erro ao ignorar lançamentos."),
      }),
   );

   return (
      <SelectionActionButton
         icon={<Ban />}
         onClick={() =>
            openAlertDialog({
               title: `Ignorar ${ids.length} ${ids.length === 1 ? "lançamento" : "lançamentos"}`,
               description:
                  "Os lançamentos selecionados serão marcados como ignorados e não entrarão nos cálculos.",
               actionLabel: "Ignorar",
               cancelLabel: "Cancelar",
               onAction: async () => {
                  const results = await Promise.allSettled(
                     ids.map((id) =>
                        mutation.mutateAsync({
                           id,
                           ignored: true,
                           status: "cancelled",
                        }),
                     ),
                  );
                  if (results.every((r) => r.status === "fulfilled")) {
                     onSuccess();
                  }
               },
            })
         }
      >
         Ignorar lançamentos
      </SelectionActionButton>
   );
}

function BulkStatusButton({
   ids,
   onSuccess,
}: {
   ids: string[];
   onSuccess: () => void;
}) {
   const [open, setOpen] = useState(false);
   const mutation = useMutation(
      orpc.transactions.update.mutationOptions({
         onError: (e) => toast.error(e.message || "Erro ao atualizar status."),
      }),
   );

   const apply = async (status: "pending" | "paid") => {
      const results = await Promise.allSettled(
         ids.map((id) => mutation.mutateAsync({ id, status })),
      );
      setOpen(false);
      if (results.every((r) => r.status === "fulfilled")) {
         onSuccess();
      }
   };

   const statusOptions = [
      { value: "pending" as const, label: "Pendente" },
      { value: "paid" as const, label: "Efetivado" },
   ];

   return (
      <Popover open={open} onOpenChange={setOpen}>
         <PopoverTrigger asChild>
            <SelectionActionButton icon={<CircleDot />}>
               Status
            </SelectionActionButton>
         </PopoverTrigger>
         <PopoverContent align="start" className="w-44 p-1">
            <div className="flex flex-col">
               {statusOptions.map((opt) => (
                  <Button
                     key={opt.value}
                     className="justify-start text-sm"
                     disabled={mutation.isPending}
                     variant="ghost"
                     onClick={() => apply(opt.value)}
                  >
                     {opt.label}
                  </Button>
               ))}
            </div>
         </PopoverContent>
      </Popover>
   );
}

function BulkDateButton({
   ids,
   onSuccess,
}: {
   ids: string[];
   onSuccess: () => void;
}) {
   const [open, setOpen] = useState(false);
   const mutation = useMutation(
      orpc.transactions.update.mutationOptions({
         onError: (e) => toast.error(e.message || "Erro ao atualizar data."),
      }),
   );

   return (
      <Popover open={open} onOpenChange={setOpen}>
         <PopoverTrigger asChild>
            <SelectionActionButton icon={<CalendarDays />}>
               Data
            </SelectionActionButton>
         </PopoverTrigger>
         <PopoverContent align="start" className="w-auto p-0">
            <Calendar
               mode="single"
               onSelect={async (d) => {
                  if (!d) return;
                  const date = dayjs(d).format("YYYY-MM-DD");
                  await Promise.allSettled(
                     ids.map((id) => mutation.mutateAsync({ id, date })),
                  );
                  setOpen(false);
                  onSuccess();
               }}
            />
         </PopoverContent>
      </Popover>
   );
}

function BulkCategoryButton({
   ids,
   categories,
   onSuccess,
}: {
   ids: string[];
   categories: CategoryOption[];
   onSuccess: () => void;
}) {
   const [open, setOpen] = useState(false);
   const mutation = useMutation(
      orpc.transactions.update.mutationOptions({
         onError: (e) => toast.error(e.message || "Erro ao categorizar."),
      }),
   );

   return (
      <Popover open={open} onOpenChange={setOpen}>
         <PopoverTrigger asChild>
            <SelectionActionButton icon={<FolderOpen />}>
               Categoria
            </SelectionActionButton>
         </PopoverTrigger>
         <PopoverContent align="start" className="w-64 p-2">
            <Combobox
               emptyMessage="Nenhuma categoria."
               options={categories.map((c) => ({ value: c.id, label: c.name }))}
               placeholder="Selecionar categoria..."
               searchPlaceholder="Buscar..."
               value=""
               onValueChange={async (categoryId) => {
                  await Promise.allSettled(
                     ids.map((id) => mutation.mutateAsync({ id, categoryId })),
                  );
                  setOpen(false);
                  onSuccess();
               }}
            />
         </PopoverContent>
      </Popover>
   );
}

function BulkAccountButton({
   ids,
   bankAccounts,
   onSuccess,
}: {
   ids: string[];
   bankAccounts: BankAccountOption[];
   onSuccess: () => void;
}) {
   const [open, setOpen] = useState(false);
   const mutation = useMutation(
      orpc.transactions.update.mutationOptions({
         onError: (e) => toast.error(e.message || "Erro ao alterar conta."),
      }),
   );

   return (
      <Popover open={open} onOpenChange={setOpen}>
         <PopoverTrigger asChild>
            <SelectionActionButton icon={<Landmark />}>
               Conta
            </SelectionActionButton>
         </PopoverTrigger>
         <PopoverContent align="start" className="w-64 p-2">
            <Combobox
               emptyMessage="Nenhuma conta."
               options={bankAccounts.map((a) => ({
                  value: a.id,
                  label: a.name,
               }))}
               placeholder="Selecionar conta..."
               searchPlaceholder="Buscar..."
               value=""
               onValueChange={async (bankAccountId) => {
                  await Promise.allSettled(
                     ids.map((id) =>
                        mutation.mutateAsync({ id, bankAccountId }),
                     ),
                  );
                  setOpen(false);
                  onSuccess();
               }}
            />
         </PopoverContent>
      </Popover>
   );
}
