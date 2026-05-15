import { ScrollArea } from "@packages/ui/components/scroll-area";
import { SearchInput } from "@packages/ui/components/search-input";
import { Table } from "@packages/ui/components/table";
import { Button } from "@packages/ui/components/button";
import { Calendar } from "@packages/ui/components/calendar";
import { Checkbox } from "@packages/ui/components/checkbox";
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
   SelectionActionButton,
   useTableBulkActions,
} from "@/hooks/use-selection-toolbar";
import {
   useMutation,
   useQueryClient,
   useSuspenseQuery,
} from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import {
   getCoreRowModel,
   getExpandedRowModel,
   getGroupedRowModel,
   useReactTable,
   type ColumnDef,
} from "@tanstack/react-table";
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
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { DataTableBody } from "@/blocks/data-table/data-table-body";
import { DataTableColumnVisibility } from "@/blocks/data-table/data-table-column-visibility";
import { DataTableHeader } from "@/blocks/data-table/data-table-header";
import { DataTablePagination } from "@/blocks/data-table/data-table-pagination";
import { useDataTableLayout } from "@/blocks/data-table/use-data-table-layout";
import { useDebouncedSearch } from "@/blocks/data-table/use-debounced-search";
import { useTableUrlState } from "@/blocks/data-table/use-table-url-state";
import { DataImportButton } from "@/blocks/data-table/data-import/data-import-button";
import { DataImportSection } from "@/blocks/data-table/data-import/data-import-section";
import { ExportButton } from "@/components/export-button/export-button";
import { useDataImport } from "@/blocks/data-table/data-import/use-data-import";
import type { DataImportConfig } from "@/blocks/data-table/data-import/use-data-import";
import { PageFilters } from "@/components/page-filters/page-filters";
import { PageFilter } from "@/components/page-filters/page-filter";
import { PageFilterSelect } from "@/components/page-filters/page-filter-select";
import { useSheet } from "@/hooks/use-sheet";
import { TransactionFormSheet } from "./transaction-form-sheet";
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
import { normalizeTransactionSorting } from "./transaction-sorting";

const routeApi = getRouteApi(
   "/_authenticated/$slug/$teamSlug/_dashboard/transactions",
);

type ImportLookupItem = { id: string; name: string };
type TransactionGroupBy = "none" | "date" | "category";

function getGroupingSelectValue(
   grouping: readonly string[],
): TransactionGroupBy {
   const first = grouping[0];
   if (first === "date") return "date";
   if (first === "categoryName") return "category";
   return "none";
}

function getGroupingForSelectValue(value: string): string[] | null {
   if (value === "none") return [];
   if (value === "date") return ["date"];
   if (value === "category") return ["categoryName"];
   return null;
}

function normalizeImportLookup(value: unknown): string {
   return String(value ?? "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "");
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
   if (value instanceof Date) {
      return dayjs(value).isValid() ? dayjs(value).format("YYYY-MM-DD") : "";
   }
   const raw = String(value ?? "").trim();
   if (!raw) return "";
   const slash = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
   if (slash) {
      const day = Number.parseInt(slash[1], 10);
      const month = Number.parseInt(slash[2], 10);
      const year = Number.parseInt(slash[3], 10);
      const monthStart = dayjs(`${slash[3]}-${slash[2].padStart(2, "0")}-01`);
      if (
         month < 1 ||
         month > 12 ||
         day < 1 ||
         day > monthStart.daysInMonth()
      ) {
         return "";
      }
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
   }
   if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
   if (/^\d+(\.\d+)?$/.test(raw)) {
      const serial = Number.parseFloat(raw);
      const fromSerial = dayjs("1899-12-30").add(Math.trunc(serial), "day");
      if (fromSerial.isValid()) return fromSerial.format("YYYY-MM-DD");
   }
   return raw;
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

function parseImportStatus(value: unknown): {
   status: "pending" | "paid";
   ignored: boolean;
} {
   const normalized = normalizeImportLookup(value);
   if (
      normalized === "cancelled" ||
      normalized.includes("cancelado") ||
      normalized.includes("ignorado")
   ) {
      return { status: "pending", ignored: true };
   }
   if (normalized === "paid" || normalized.includes("efetivado")) {
      return { status: "paid", ignored: false };
   }
   return { status: "pending", ignored: false };
}

export function TransactionsList() {
   const navigate = routeApi.useNavigate();
   const {
      sorting,
      columnFilters,
      page,
      pageSize,
      view,
      overdueOnly,
      status,
      search,
      contactId,
      bankId,
      grouping,
   } = routeApi.useSearch();

   const { openAlertDialog } = useAlertDialog();
   const { openSheet } = useSheet();
   const queryClient = useQueryClient();
   const { parse: parseCsv, generate: generateCsv } = useCsvFile();
   const { parse: parseXlsx, generate: generateXlsx } = useXlsxFile();
   const { parse: parseOfx } = useOfxFile();
   const layout = useDataTableLayout("transactions");

   const searchInput = useDebouncedSearch({
      value: search,
      onCommit: (value) =>
         navigate({
            search: (prev) => ({ ...prev, search: value, page: 1 }),
            replace: true,
         }),
   });

   const handleViewChange = useCallback(
      (nextView: string) => {
         navigate({
            search: (prev) => ({
               ...prev,
               view: nextView as
                  | "all"
                  | "payable"
                  | "receivable"
                  | "settled"
                  | "ignored",
               page: 1,
            }),
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

   const handleGroupByChange = useCallback(
      (next: string) => {
         const nextGrouping = getGroupingForSelectValue(next);
         if (!nextGrouping) return;
         navigate({
            search: (prev) => ({ ...prev, grouping: nextGrouping, page: 1 }),
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

   const { data: result } = useSuspenseQuery(
      orpc.transactions.getAll.queryOptions({
         input: {
            search: search || undefined,
            view,
            overdueOnly,
            status: status.length > 0 ? status : undefined,
            page,
            pageSize,
            sorting: normalizeTransactionSorting(sorting),
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
         const created = await createBankAccountMutation.mutateAsync({
            name,
            type: "checking",
         });
         return created.id;
      },
      [createBankAccountMutation],
   );

   const handleCreateContact = useCallback(
      async (name: string): Promise<string> => {
         const created = await createContactMutation.mutateAsync({
            name,
            type: "ambos",
         });
         return created.id;
      },
      [createContactMutation],
   );

   const handleCreateCategory = useCallback(
      async (name: string): Promise<string> => {
         const created = await createCategoryMutation.mutateAsync({
            name,
            type: "expense",
         });
         return created.id;
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

   const importConfig: DataImportConfig = useMemo(
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
            const parsedStatus = parseImportStatus(row.status);

            return {
               id: `__import_${i}`,
               date: parseImportDate(row.date),
               amount: parsedAmount.amount,
               type,
               name: String(row.name ?? "").trim() || null,
               status: parsedStatus.status,
               ignored: parsedStatus.ignored,
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
         extraBulkActions: ({ selectedIndices, bulkUpdate, clear }) => (
            <>
               <ImportBulkStatusButton
                  bulkUpdate={bulkUpdate}
                  clear={clear}
                  selectedIndices={selectedIndices}
               />
               <ImportBulkDateButton
                  bulkUpdate={bulkUpdate}
                  clear={clear}
                  selectedIndices={selectedIndices}
               />
               <ImportBulkCategoryButton
                  bulkUpdate={bulkUpdate}
                  categories={categoriesResult ?? []}
                  clear={clear}
                  selectedIndices={selectedIndices}
               />
               <ImportBulkAccountButton
                  bankAccounts={bankAccounts}
                  bulkUpdate={bulkUpdate}
                  clear={clear}
                  selectedIndices={selectedIndices}
               />
            </>
         ),
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
                     status: parseImportStatus(r.status).status,
                     ignored:
                        r.ignored === true ||
                        parseImportStatus(r.status).ignored,
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

   const importUpdateRef = useRef<
      ((index: number, patch: Record<string, unknown>) => void) | null
   >(null);

   const columns = useMemo<ColumnDef<TransactionRow>[]>(() => {
      const base = buildTransactionColumns({
         bankAccounts,
         contacts,
         categories: categoriesResult,
         creditCards: creditCardsResult.data,
         onUpdate: handleUpdate,
         onUpdateImport: (idx, patch) => importUpdateRef.current?.(idx, patch),
         onCreateBankAccount: handleCreateBankAccount,
         onCreateContact: handleCreateContact,
         onCreateCategory: handleCreateCategory,
         getRowStatus: (id) => transactionData.find((t) => t.id === id)?.status,
      });
      const selectColumn: ColumnDef<TransactionRow> = {
         id: "__select",
         size: 40,
         enableSorting: false,
         enableHiding: false,
         header: ({ table }) => (
            <Checkbox
               aria-label="Selecionar todos"
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
      const actionsColumn: ColumnDef<TransactionRow> = {
         id: "__actions",
         size: 180,
         enableSorting: false,
         enableHiding: false,
         meta: { align: "right" },
         cell: ({ row }) => {
            const tx = row.original;
            const { status: rowStatus, ignored } = tx;
            return (
               <div className="flex justify-end gap-2">
                  {!ignored && rowStatus === "pending" && (
                     <Button
                        className="text-green-600 hover:text-green-700"
                        onClick={() => handleMarkPaid(tx)}
                        size="icon-sm"
                        tooltip="Marcar como efetivado"
                        variant="ghost"
                     >
                        <CheckCircle2 />
                        <span className="sr-only">Marcar como efetivado</span>
                     </Button>
                  )}
                  {!ignored && rowStatus === "paid" && (
                     <Button
                        onClick={() => handleMarkUnpaid(tx)}
                        size="icon-sm"
                        tooltip="Marcar como pendente"
                        variant="ghost"
                     >
                        <Undo2 />
                        <span className="sr-only">Marcar como pendente</span>
                     </Button>
                  )}
                  {ignored ? (
                     <Button
                        onClick={() => handleReactivate(tx)}
                        size="icon-sm"
                        tooltip="Reativar"
                        variant="ghost"
                     >
                        <RotateCcw />
                        <span className="sr-only">Reativar</span>
                     </Button>
                  ) : (
                     <Button
                        onClick={() => handleCancel(tx)}
                        size="icon-sm"
                        tooltip="Ignorar lançamento"
                        variant="ghost"
                     >
                        <Ban />
                        <span className="sr-only">Ignorar lançamento</span>
                     </Button>
                  )}
                  <Button
                     className="text-destructive hover:text-destructive"
                     onClick={() => handleDelete(tx)}
                     size="icon-sm"
                     tooltip="Excluir"
                     variant="ghost"
                  >
                     <Trash2 />
                     <span className="sr-only">Excluir</span>
                  </Button>
               </div>
            );
         },
      };
      return [selectColumn, ...base, actionsColumn];
   }, [
      bankAccounts,
      contacts,
      categoriesResult,
      creditCardsResult,
      transactionData,
      handleUpdate,
      handleCreateBankAccount,
      handleCreateContact,
      handleCreateCategory,
      handleMarkPaid,
      handleMarkUnpaid,
      handleReactivate,
      handleCancel,
      handleDelete,
   ]);

   const urlState = useTableUrlState({
      search: { sorting, columnFilters, page, pageSize, grouping },
      onUpdate: (next) =>
         navigate({
            search: (prev) => ({ ...prev, ...next }),
            replace: true,
         }),
      totalRows: total,
   });

   const table = useReactTable({
      data: transactionData,
      columns,
      getRowId: (row) => row.id,
      pageCount: urlState.pageCount,
      manualPagination: true,
      manualSorting: true,
      manualFiltering: true,
      columnResizeMode: "onChange",
      defaultColumn: { minSize: 80, size: 160, maxSize: 600 },
      state: { ...urlState.state, ...layout.state },
      onSortingChange: urlState.onSortingChange,
      onColumnFiltersChange: urlState.onColumnFiltersChange,
      onPaginationChange: urlState.onPaginationChange,
      onRowSelectionChange: urlState.onRowSelectionChange,
      onColumnSizingChange: layout.onColumnSizingChange,
      onColumnOrderChange: layout.onColumnOrderChange,
      onColumnVisibilityChange: layout.onColumnVisibilityChange,
      onColumnPinningChange: layout.onColumnPinningChange,
      onGroupingChange: urlState.onGroupingChange,
      onExpandedChange: urlState.onExpandedChange,
      getCoreRowModel: getCoreRowModel(),
      getGroupedRowModel: getGroupedRowModel(),
      getExpandedRowModel: getExpandedRowModel(),
   });

   const importApi = useDataImport({ table, config: importConfig });
   importUpdateRef.current = importApi.updateRow;

   const selectedRows = table.getSelectedRowModel().rows;
   const selectedIds = selectedRows.map((r) => r.original.id);
   const resetSelection = () => table.resetRowSelection();

   useTableBulkActions({
      selectedCount: selectedRows.length,
      onClear: resetSelection,
      children: (
         <>
            <BulkIgnoreButton ids={selectedIds} onSuccess={resetSelection} />
            <BulkStatusButton ids={selectedIds} onSuccess={resetSelection} />
            <BulkDateButton ids={selectedIds} onSuccess={resetSelection} />
            <BulkCategoryButton
               categories={categoriesResult ?? []}
               ids={selectedIds}
               onSuccess={resetSelection}
            />
            <BulkAccountButton
               bankAccounts={bankAccounts}
               ids={selectedIds}
               onSuccess={resetSelection}
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
                        resetSelection();
                     },
                  })
               }
            >
               Excluir
            </SelectionActionButton>
         </>
      ),
   });

   return (
      <div className="flex flex-1 flex-col gap-4 min-h-0">
         <div className="flex flex-1 flex-col gap-4 min-h-0">
            <div className="flex flex-wrap items-center gap-2 justify-between">
               <SearchInput
                  className="max-w-sm"
                  aria-label="Buscar lançamentos"
                  onChange={(e) => searchInput.onChange(e.target.value)}
                  placeholder="Buscar por nome, descrição ou contato..."
                  value={searchInput.value}
               />
               <div className="flex flex-wrap items-center gap-2">
                  <PageFilters>
                     <PageFilterSelect
                        group="Visualização"
                        id="view"
                        label="Visualização"
                        onChange={handleViewChange}
                        options={[
                           { value: "all", label: "Todos" },
                           { value: "payable", label: "A Pagar" },
                           { value: "receivable", label: "A Receber" },
                           { value: "settled", label: "Efetivados" },
                           { value: "ignored", label: "Ignorados" },
                        ]}
                        value={view}
                     />
                     <PageFilterSelect
                        group="Agrupamento"
                        id="groupBy"
                        label="Agrupar por"
                        onChange={handleGroupByChange}
                        options={[
                           { value: "none", label: "Sem agrupamento" },
                           { value: "date", label: "Data" },
                           { value: "category", label: "Categoria" },
                        ]}
                        value={getGroupingSelectValue(grouping)}
                     />
                     <PageFilter
                        active={overdueOnly}
                        group="Filtros"
                        icon={<AlertTriangle className="size-4" />}
                        id="overdueOnly"
                        label="Somente vencidos"
                        onToggle={handleOverdueToggle}
                     />
                     {bankId ? (
                        <PageFilter
                           active
                           group="Conta"
                           icon={<Landmark className="size-4" />}
                           id="bankId"
                           label={
                              selectedBankAccount?.name ?? "Conta selecionada"
                           }
                           onToggle={handleBankFilterToggle}
                        />
                     ) : null}
                  </PageFilters>
                  <DataTableColumnVisibility table={table} />
                  <ExportButton table={table} fileBase="lancamentos" />
                  <DataImportButton api={importApi} config={importConfig} />
                  <Button
                     onClick={handleCreate}
                     tooltip="Novo Lançamento"
                     variant="outline"
                     size="icon-sm"
                  >
                     <Plus />
                     <span className="sr-only">Novo Lançamento</span>
                  </Button>
               </div>
            </div>
            <ScrollArea className="flex-1 min-h-0 rounded-md border bg-card">
               <Table>
                  <DataTableHeader table={table} />
                  <DataTableBody<TransactionRow> table={table} />
                  <DataImportSection
                     api={importApi}
                     config={importConfig}
                     table={table}
                  />
               </Table>
               {table.getRowCount() === 0 && (
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
               )}
            </ScrollArea>
            <DataTablePagination table={table} />
         </div>
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
                        mutation.mutateAsync({ id, ignored: true }),
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

type ImportBulkProps = {
   selectedIndices: Set<number>;
   bulkUpdate: (
      indices: Set<number>,
      keyOrPatch: string | Record<string, unknown>,
      value?: unknown,
   ) => void;
   clear: () => void;
};

function ImportBulkStatusButton({
   selectedIndices,
   bulkUpdate,
   clear,
}: ImportBulkProps) {
   const [open, setOpen] = useState(false);
   const opts = [
      { value: "pending", label: "Pendente" },
      { value: "paid", label: "Efetivado" },
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
               {opts.map((o) => (
                  <Button
                     key={o.value}
                     className="justify-start text-sm"
                     variant="ghost"
                     onClick={() => {
                        bulkUpdate(selectedIndices, "status", o.value);
                        setOpen(false);
                        clear();
                     }}
                  >
                     {o.label}
                  </Button>
               ))}
            </div>
         </PopoverContent>
      </Popover>
   );
}

function ImportBulkDateButton({
   selectedIndices,
   bulkUpdate,
   clear,
}: ImportBulkProps) {
   const [open, setOpen] = useState(false);
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
               onSelect={(d) => {
                  if (!d) return;
                  bulkUpdate(
                     selectedIndices,
                     "date",
                     dayjs(d).format("YYYY-MM-DD"),
                  );
                  setOpen(false);
                  clear();
               }}
            />
         </PopoverContent>
      </Popover>
   );
}

function ImportBulkCategoryButton({
   selectedIndices,
   bulkUpdate,
   clear,
   categories,
}: ImportBulkProps & { categories: CategoryOption[] }) {
   const [open, setOpen] = useState(false);
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
               onValueChange={(categoryId) => {
                  const label =
                     categories.find((c) => c.id === categoryId)?.name ?? "";
                  bulkUpdate(selectedIndices, {
                     categoryId,
                     categoryName: label,
                  });
                  setOpen(false);
                  clear();
               }}
            />
         </PopoverContent>
      </Popover>
   );
}

function ImportBulkAccountButton({
   selectedIndices,
   bulkUpdate,
   clear,
   bankAccounts,
}: ImportBulkProps & { bankAccounts: BankAccountOption[] }) {
   const [open, setOpen] = useState(false);
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
               onValueChange={(bankAccountId) => {
                  const label =
                     bankAccounts.find((a) => a.id === bankAccountId)?.name ??
                     "";
                  bulkUpdate(selectedIndices, {
                     bankAccountId,
                     bankAccountName: label,
                  });
                  setOpen(false);
                  clear();
               }}
            />
         </PopoverContent>
      </Popover>
   );
}
