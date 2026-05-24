import { ScrollArea } from "@packages/ui/components/scroll-area";
import { SearchInput } from "@packages/ui/components/search-input";
import { Table } from "@packages/ui/components/table";
import { TooltipProvider } from "@packages/ui/components/tooltip";
import { Button } from "@packages/ui/components/button";
import { Calendar } from "@packages/ui/components/calendar";
import { Checkbox } from "@packages/ui/components/checkbox";
import {
   Command,
   CommandEmpty,
   CommandGroup,
   CommandInput,
   CommandItem,
   CommandList,
} from "@packages/ui/components/command";
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
   createCollection,
   eq,
   ilike,
   lt,
   or,
   useLiveQuery,
} from "@tanstack/react-db";
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
import { Result } from "better-result";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "@packages/ui/hooks/use-toast";
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
import { cn } from "@packages/ui/lib/utils";
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
import { useActiveTeam } from "@/hooks/use-active-team";
import {
   bankAccountsCollectionOptions,
   buildOptimisticBankAccountRow,
   buildOptimisticBankAccountRowId,
   createBankAccountAction,
   type BankAccountCreateInput,
} from "@/integrations/tanstack-db/bank-accounts";
import {
   categoriesCollectionOptions,
   createCategoryAction,
   type CategoryCreateInput,
   type CategoriesCollectionRow,
} from "@/integrations/tanstack-db/categories";
import { creditCardsCollectionOptions } from "@/integrations/tanstack-db/credit-cards";
import {
   buildOptimisticTransactionRow,
   buildOptimisticTransactionRowId,
   acceptSuggestedTransactionCategoryAction,
   bulkRemoveTransactionsAction,
   bulkUpdateTransactionsAction,
   cancelTransactionAction,
   createTransactionAction,
   dismissSuggestedTransactionCategoryAction,
   importTransactionsAction,
   markTransactionAsPaidAction,
   markTransactionAsUnpaidAction,
   reactivateTransactionAction,
   removeTransactionAction,
   transactionsCollectionOptions,
   transactionsPageInfoCollectionOptions,
   updateTransactionAction,
   type TransactionCreateInput,
} from "@/integrations/tanstack-db/transactions";
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

function getErrorMessage(error: unknown, fallback: string) {
   if (
      typeof error === "object" &&
      error !== null &&
      "message" in error &&
      typeof error.message === "string" &&
      error.message.length > 0
   ) {
      return error.message;
   }
   return fallback;
}

function escapeIlikePattern(value: string) {
   return value
      .replace(/\\/g, "\\\\")
      .replace(/%/g, "\\%")
      .replace(/_/g, "\\_");
}

function buildInlineCategoryRow({
   id,
   name,
   teamId,
}: {
   id: string;
   name: string;
   teamId: string;
}): CategoriesCollectionRow {
   const now = dayjs().toDate();
   return {
      id,
      teamId,
      parentId: null,
      name,
      type: "expense",
      level: 0,
      description: null,
      isDefault: false,
      color: null,
      icon: null,
      isArchived: false,
      notes: null,
      participatesDre: true,
      dreGroupId: null,
      createdAt: now,
      updatedAt: now,
   };
}

export function TransactionsList() {
   const navigate = routeApi.useNavigate();
   const { publicEnv, queryClient } = routeApi.useRouteContext();
   const {
      sorting,
      columnFilters,
      page,
      pageSize,
      view,
      overdueOnly,
      status,
      search,
      bankId,
      grouping,
   } = routeApi.useSearch();

   const { openAlertDialog } = useAlertDialog();
   const { openSheet } = useSheet();
   const { activeTeamId } = useActiveTeam();
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

   const trimmedSearch = search.trim();
   const collectionTeamId = activeTeamId ?? "no-team";
   const transactionsCollection = useMemo(
      () =>
         createCollection(
            transactionsCollectionOptions({
               queryClient,
               teamId: collectionTeamId,
               search: trimmedSearch || undefined,
               view,
               overdueOnly,
               status: status.length > 0 ? status : undefined,
               bankAccountId: bankId || undefined,
            }),
         ),
      [
         bankId,
         collectionTeamId,
         overdueOnly,
         queryClient,
         status,
         trimmedSearch,
         view,
      ],
   );

   const transactionsPageInfoCollection = useMemo(
      () =>
         createCollection(
            transactionsPageInfoCollectionOptions({
               queryClient,
               teamId: collectionTeamId,
               search: trimmedSearch || undefined,
               view,
               overdueOnly,
               status: status.length > 0 ? status : undefined,
               bankAccountId: bankId || undefined,
            }),
         ),
      [
         bankId,
         collectionTeamId,
         overdueOnly,
         queryClient,
         status,
         trimmedSearch,
         view,
      ],
   );

   const bankAccountsCollection = useMemo(
      () =>
         createCollection(
            bankAccountsCollectionOptions({
               queryClient,
               teamId: collectionTeamId,
            }),
         ),
      [collectionTeamId, queryClient],
   );

   const categoriesCollection = useMemo(
      () =>
         createCollection(
            categoriesCollectionOptions({
               queryClient,
               teamId: collectionTeamId,
            }),
         ),
      [collectionTeamId, queryClient],
   );

   const creditCardsCollection = useMemo(
      () =>
         createCollection(
            creditCardsCollectionOptions({
               queryClient,
               teamId: collectionTeamId,
            }),
         ),
      [collectionTeamId, queryClient],
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

   const { data: liveTransactions } = useLiveQuery(
      (q) => {
         let query = q.from({ transaction: transactionsCollection });

         if (view === "payable") {
            query = query
               .where(({ transaction }) => eq(transaction.type, "expense"))
               .where(({ transaction }) => eq(transaction.status, "pending"))
               .where(({ transaction }) => eq(transaction.ignored, false));
         }
         if (view === "receivable") {
            query = query
               .where(({ transaction }) => eq(transaction.type, "income"))
               .where(({ transaction }) => eq(transaction.status, "pending"))
               .where(({ transaction }) => eq(transaction.ignored, false));
         }
         if (view === "settled") {
            query = query
               .where(({ transaction }) => eq(transaction.status, "paid"))
               .where(({ transaction }) => eq(transaction.ignored, false));
         }
         if (view === "ignored") {
            query = query.where(({ transaction }) =>
               eq(transaction.ignored, true),
            );
         }
         if (overdueOnly) {
            query = query
               .where(({ transaction }) => eq(transaction.status, "pending"))
               .where(({ transaction }) =>
                  lt(transaction.dueDate, dayjs().format("YYYY-MM-DD")),
               );
         }
         const selectedStatuses = status.filter(
            (selectedStatus) => selectedStatus !== undefined,
         );
         if (selectedStatuses.length === 1) {
            const firstStatus = selectedStatuses[0];
            if (firstStatus) {
               query = query.where(({ transaction }) =>
                  eq(transaction.status, firstStatus),
               );
            }
         }
         if (selectedStatuses.length > 1) {
            const [firstStatus, secondStatus, ...remainingStatuses] =
               selectedStatuses;
            if (firstStatus && secondStatus) {
               query = query.where(({ transaction }) => {
                  let statusFilter = or(
                     eq(transaction.status, firstStatus),
                     eq(transaction.status, secondStatus),
                  );
                  for (const selectedStatus of remainingStatuses) {
                     statusFilter = or(
                        statusFilter,
                        eq(transaction.status, selectedStatus),
                     );
                  }
                  return statusFilter;
               });
            }
         }
         if (bankId) {
            query = query.where(({ transaction }) =>
               eq(transaction.bankAccountId, bankId),
            );
         }
         if (trimmedSearch) {
            const pattern = `%${escapeIlikePattern(trimmedSearch)}%`;
            query = query.where(({ transaction }) =>
               or(
                  ilike(transaction.name, pattern),
                  ilike(transaction.description, pattern),
               ),
            );
         }

         const normalizedSorting = normalizeTransactionSorting(sorting);
         if (normalizedSorting.length > 0) {
            for (const rule of normalizedSorting) {
               switch (rule.id) {
                  case "amount":
                     query = query.orderBy(
                        ({ transaction }) => transaction.amount,
                        rule.desc ? "desc" : "asc",
                     );
                     break;
                  case "bankAccountName":
                     query = query.orderBy(
                        ({ transaction }) => transaction.bankAccountName,
                        rule.desc ? "desc" : "asc",
                     );
                     break;
                  case "categoryName":
                     query = query.orderBy(
                        ({ transaction }) => transaction.categoryName,
                        rule.desc ? "desc" : "asc",
                     );
                     break;
                  case "creditCardName":
                     query = query.orderBy(
                        ({ transaction }) => transaction.creditCardName,
                        rule.desc ? "desc" : "asc",
                     );
                     break;
                  case "date":
                     query = query.orderBy(
                        ({ transaction }) => transaction.date,
                        rule.desc ? "desc" : "asc",
                     );
                     break;
                  case "dueDate":
                     query = query.orderBy(
                        ({ transaction }) => transaction.dueDate,
                        rule.desc ? "desc" : "asc",
                     );
                     break;
                  case "name":
                     query = query.orderBy(
                        ({ transaction }) => transaction.name,
                        rule.desc ? "desc" : "asc",
                     );
                     break;
                  case "status":
                     query = query.orderBy(
                        ({ transaction }) => transaction.status,
                        rule.desc ? "desc" : "asc",
                     );
                     break;
                  case "type":
                     query = query.orderBy(
                        ({ transaction }) => transaction.type,
                        rule.desc ? "desc" : "asc",
                     );
                     break;
               }
            }
         } else {
            query = query
               .orderBy(({ transaction }) => transaction.date, "desc")
               .orderBy(({ transaction }) => transaction.createdAt, "desc");
         }

         return query
            .limit(pageSize)
            .offset((page - 1) * pageSize)
            .select(({ transaction }) => transaction);
      },
      [
         bankId,
         overdueOnly,
         page,
         pageSize,
         sorting,
         status,
         transactionsCollection,
         trimmedSearch,
         view,
      ],
   );

   const { data: pageInfoRows } = useLiveQuery(
      (q) =>
         q
            .from({ pageInfo: transactionsPageInfoCollection })
            .select(({ pageInfo }) => pageInfo),
      [transactionsPageInfoCollection],
   );

   const { data: bankAccounts } = useLiveQuery(
      (q) =>
         q
            .from({ bankAccount: bankAccountsCollection })
            .select(({ bankAccount }) => bankAccount),
      [bankAccountsCollection],
   );

   const { data: categoriesResult } = useLiveQuery(
      (q) =>
         q
            .from({ category: categoriesCollection })
            .where(({ category }) => eq(category.isArchived, false))
            .select(({ category }) => category),
      [categoriesCollection],
   );

   const { data: creditCardsResult } = useLiveQuery(
      (q) =>
         q
            .from({ creditCard: creditCardsCollection })
            .where(({ creditCard }) => eq(creditCard.status, "active"))
            .select(({ creditCard }) => creditCard),
      [creditCardsCollection],
   );

   const safeTransactions = useMemo(
      () => liveTransactions ?? [],
      [liveTransactions],
   );
   const safeBankAccounts = useMemo(() => bankAccounts ?? [], [bankAccounts]);
   const safeCategories = useMemo(
      () => categoriesResult ?? [],
      [categoriesResult],
   );
   const safeCreditCards = useMemo(
      () => creditCardsResult ?? [],
      [creditCardsResult],
   );

   const selectedBankAccount = useMemo(
      () => safeBankAccounts.find((account) => account.id === bankId),
      [safeBankAccounts, bankId],
   );

   const transactionData = safeTransactions;
   const isTransactionsLoaded = liveTransactions !== undefined;
   const total = pageInfoRows?.[0]?.total ?? 0;

   const handleUpdate = useCallback(
      async (id: string, patch: Record<string, unknown>) => {
         const update = updateTransactionAction(transactionsCollection);
         const transaction = update({ id, patch });
         const result = await Result.tryPromise({
            try: () => transaction.isPersisted.promise,
            catch: (error) => error,
         });
         if (Result.isError(result)) {
            toast.error(
               getErrorMessage(result.error, "Erro ao atualizar lançamento."),
            );
         }
      },
      [transactionsCollection],
   );

   const handleCreateBankAccount = useCallback(
      async (name: string): Promise<string> => {
         if (!activeTeamId) {
            toast.error("Time ativo não encontrado.");
            return "";
         }
         const input: BankAccountCreateInput = {
            name,
            type: "checking",
         };
         const createBankAccount = createBankAccountAction(
            bankAccountsCollection,
         );
         const transaction = createBankAccount({
            row: buildOptimisticBankAccountRow({
               id: buildOptimisticBankAccountRowId(),
               input,
               teamId: activeTeamId,
            }),
            input,
         });
         const result = await Result.tryPromise({
            try: () => transaction.isPersisted.promise,
            catch: (error) => error,
         });
         if (Result.isError(result)) {
            toast.error(
               getErrorMessage(result.error, "Erro ao criar conta bancária."),
            );
            return "";
         }
         return result.value.id;
      },
      [activeTeamId, bankAccountsCollection],
   );

   const handleCreateCategory = useCallback(
      async (name: string): Promise<string> => {
         if (!activeTeamId) {
            toast.error("Time ativo não encontrado.");
            return "";
         }
         const input: CategoryCreateInput = {
            name,
            type: "expense",
         };
         const id = buildOptimisticTransactionRowId("__category_");
         const createCategory = createCategoryAction(categoriesCollection);
         const transaction = createCategory({
            row: buildInlineCategoryRow({ id, name, teamId: activeTeamId }),
            input,
         });
         const result = await Result.tryPromise({
            try: () => transaction.isPersisted.promise,
            catch: (error) => error,
         });
         if (Result.isError(result)) {
            toast.error(
               getErrorMessage(result.error, "Erro ao criar categoria."),
            );
            return "";
         }
         return result.value.id;
      },
      [activeTeamId, categoriesCollection],
   );

   const handleCreateTransaction = useCallback(
      async (input: TransactionCreateInput) => {
         if (!activeTeamId) {
            toast.error("Time ativo não encontrado.");
            return false;
         }
         const createTransaction = createTransactionAction(
            transactionsCollection,
         );
         const transaction = createTransaction({
            row: buildOptimisticTransactionRow({
               id: buildOptimisticTransactionRowId(),
               input,
               teamId: activeTeamId,
               bankAccountName:
                  safeBankAccounts.find(
                     (account) => account.id === input.bankAccountId,
                  )?.name ?? null,
               categoryName:
                  safeCategories.find(
                     (category) => category.id === input.categoryId,
                  )?.name ?? null,
               creditCardName:
                  safeCreditCards.find((card) => card.id === input.creditCardId)
                     ?.name ?? null,
            }),
            input,
         });
         const result = await Result.tryPromise({
            try: () => transaction.isPersisted.promise,
            catch: (error) => error,
         });
         if (Result.isError(result)) {
            toast.error(
               getErrorMessage(result.error, "Erro ao criar lançamento."),
            );
            return false;
         }
         return true;
      },
      [
         activeTeamId,
         safeBankAccounts,
         safeCategories,
         safeCreditCards,
         transactionsCollection,
      ],
   );

   const handleCreate = useCallback(() => {
      openSheet({
         renderChildren: () => (
            <TransactionFormSheet
               bankAccounts={safeBankAccounts}
               categories={safeCategories}
               onCreate={handleCreateTransaction}
            />
         ),
      });
   }, [handleCreateTransaction, openSheet, safeBankAccounts, safeCategories]);

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
               const remove = removeTransactionAction(transactionsCollection);
               const result = await Result.tryPromise({
                  try: () => remove({ id: transaction.id }).isPersisted.promise,
                  catch: (error) => error,
               });
               if (Result.isError(result)) {
                  toast.error(
                     getErrorMessage(
                        result.error,
                        "Erro ao excluir lançamento.",
                     ),
                  );
                  return;
               }
               toast.success("Lançamento excluído com sucesso.");
            },
         });
      },
      [openAlertDialog, transactionsCollection],
   );

   const handleMarkPaid = useCallback(
      async (tx: TransactionRow) => {
         const markAsPaid = markTransactionAsPaidAction(transactionsCollection);
         const transaction = markAsPaid({
            id: tx.id,
            paidDate: dayjs().format("YYYY-MM-DD"),
         });
         const result = await Result.tryPromise({
            try: () => transaction.isPersisted.promise,
            catch: (error) => error,
         });
         if (Result.isError(result)) {
            toast.error(
               getErrorMessage(result.error, "Erro ao marcar como pago."),
            );
            return;
         }
         toast.success("Lançamento marcado como pago.");
      },
      [transactionsCollection],
   );

   const handleMarkUnpaid = useCallback(
      async (tx: TransactionRow) => {
         const markAsUnpaid = markTransactionAsUnpaidAction(
            transactionsCollection,
         );
         const transaction = markAsUnpaid({ id: tx.id });
         const result = await Result.tryPromise({
            try: () => transaction.isPersisted.promise,
            catch: (error) => error,
         });
         if (Result.isError(result)) {
            toast.error(
               getErrorMessage(result.error, "Erro ao desmarcar pagamento."),
            );
            return;
         }
         toast.success("Pagamento desmarcado.");
      },
      [transactionsCollection],
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
               const cancel = cancelTransactionAction(transactionsCollection);
               const result = await Result.tryPromise({
                  try: () => cancel({ id: tx.id }).isPersisted.promise,
                  catch: (error) => error,
               });
               if (Result.isError(result)) {
                  toast.error(
                     getErrorMessage(
                        result.error,
                        "Erro ao ignorar lançamento.",
                     ),
                  );
                  return;
               }
               toast.success("Lançamento ignorado.");
            },
         });
      },
      [openAlertDialog, transactionsCollection],
   );

   const handleReactivate = useCallback(
      async (tx: TransactionRow) => {
         const reactivate = reactivateTransactionAction(transactionsCollection);
         const transaction = reactivate({ id: tx.id });
         const result = await Result.tryPromise({
            try: () => transaction.isPersisted.promise,
            catch: (error) => error,
         });
         if (Result.isError(result)) {
            toast.error(
               getErrorMessage(result.error, "Erro ao reativar lançamento."),
            );
            return;
         }
         toast.success("Lançamento reativado.");
      },
      [transactionsCollection],
   );

   const handleAcceptSuggestedCategory = useCallback(
      async (id: string) => {
         const accept = acceptSuggestedTransactionCategoryAction(
            transactionsCollection,
         );
         const transaction = accept({ id });
         const result = await Result.tryPromise({
            try: () => transaction.isPersisted.promise,
            catch: (error) => error,
         });
         if (Result.isError(result)) {
            toast.error(
               getErrorMessage(result.error, "Erro ao aplicar sugestão."),
            );
            return;
         }
         toast.success("Categoria aplicada.");
      },
      [transactionsCollection],
   );

   const handleDismissSuggestedCategory = useCallback(
      async (id: string) => {
         const dismiss = dismissSuggestedTransactionCategoryAction(
            transactionsCollection,
         );
         const transaction = dismiss({ id });
         const result = await Result.tryPromise({
            try: () => transaction.isPersisted.promise,
            catch: (error) => error,
         });
         if (Result.isError(result)) {
            toast.error(
               getErrorMessage(result.error, "Erro ao ignorar sugestão."),
            );
            return;
         }
         toast.success("Sugestão ignorada.");
      },
      [transactionsCollection],
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
                  safeBankAccounts,
                  row.bankAccountName,
               ),
               categoryName: String(row.categoryName ?? "").trim(),
               categoryId: resolveImportId(safeCategories, row.categoryName),
               creditCardName: String(row.creditCardName ?? "").trim(),
               creditCardId: resolveImportId(
                  safeCreditCards,
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
                              Conta: safeBankAccounts[0]?.name ?? "",
                              Cartão: "",
                              Categoria: safeCategories[0]?.name ?? "",
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
                              Conta: safeBankAccounts[0]?.name ?? "",
                              Cartão: "",
                              Categoria: safeCategories[0]?.name ?? "",
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
                  categories={safeCategories}
                  clear={clear}
                  selectedIndices={selectedIndices}
               />
               <ImportBulkAccountButton
                  bankAccounts={safeBankAccounts}
                  bulkUpdate={bulkUpdate}
                  clear={clear}
                  selectedIndices={selectedIndices}
               />
            </>
         ),
         onImport: async (rows) => {
            if (!activeTeamId) {
               throw new Error("Time ativo não encontrado.");
            }
            const transactions = rows.flatMap((r) => {
               const date = String(r.date ?? "");
               const amount = String(r.amount ?? "");
               if (!date || !amount) return [];
               const bankAccountId =
                  resolveImportId(safeBankAccounts, r.bankAccountId) ??
                  resolveImportId(safeBankAccounts, r.bankAccountName);
               const creditCardId =
                  resolveImportId(safeCreditCards, r.creditCardId) ??
                  resolveImportId(safeCreditCards, r.creditCardName);
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
                        resolveImportId(safeCategories, r.categoryId) ??
                        resolveImportId(safeCategories, r.categoryName),
                     attachments: [],
                     description: null,
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
            const importTransactions = importTransactionsAction(
               transactionsCollection,
            );
            const transaction = importTransactions({
               input: { transactions, autoCategorize: true },
               rows: transactions.map((input) =>
                  buildOptimisticTransactionRow({
                     id: buildOptimisticTransactionRowId(),
                     input,
                     teamId: activeTeamId,
                     bankAccountName:
                        safeBankAccounts.find(
                           (account) => account.id === input.bankAccountId,
                        )?.name ?? null,
                     categoryName:
                        safeCategories.find(
                           (category) => category.id === input.categoryId,
                        )?.name ?? null,
                     creditCardName:
                        safeCreditCards.find(
                           (card) => card.id === input.creditCardId,
                        )?.name ?? null,
                  }),
               ),
            });
            const result = await Result.tryPromise({
               try: () => transaction.isPersisted.promise,
               catch: (error) => error,
            });
            if (Result.isError(result)) {
               throw new Error(
                  getErrorMessage(
                     result.error,
                     "Erro ao importar lançamentos.",
                  ),
               );
            }
         },
      }),
      [
         activeTeamId,
         parseCsv,
         parseXlsx,
         parseOfx,
         generateCsv,
         generateXlsx,
         safeBankAccounts,
         safeCategories,
         safeCreditCards,
         transactionsCollection,
      ],
   );

   const importUpdateRef = useRef<
      ((index: number, patch: Record<string, unknown>) => void) | null
   >(null);

   const columns = useMemo<ColumnDef<TransactionRow>[]>(() => {
      const base = buildTransactionColumns({
         bankAccounts: safeBankAccounts,
         categories: safeCategories,
         creditCards: safeCreditCards,
         onUpdate: handleUpdate,
         onUpdateImport: (idx, patch) => importUpdateRef.current?.(idx, patch),
         onCreateBankAccount: handleCreateBankAccount,
         onCreateCategory: handleCreateCategory,
         onAcceptSuggestedCategory: handleAcceptSuggestedCategory,
         onDismissSuggestedCategory: handleDismissSuggestedCategory,
         getRowStatus: (id) => transactionData.find((t) => t.id === id)?.status,
         logoDevToken: publicEnv?.LOGO_DEV_TOKEN,
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
      safeBankAccounts,
      safeCategories,
      safeCreditCards,
      transactionData,
      publicEnv?.LOGO_DEV_TOKEN,
      handleUpdate,
      handleCreateBankAccount,
      handleCreateCategory,
      handleAcceptSuggestedCategory,
      handleDismissSuggestedCategory,
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
            <BulkIgnoreButton
               collection={transactionsCollection}
               ids={selectedIds}
               onSuccess={resetSelection}
            />
            <BulkStatusButton
               collection={transactionsCollection}
               ids={selectedIds}
               onSuccess={resetSelection}
            />
            <BulkDateButton
               collection={transactionsCollection}
               ids={selectedIds}
               onSuccess={resetSelection}
            />
            <BulkCategoryButton
               categories={safeCategories}
               collection={transactionsCollection}
               ids={selectedIds}
               onSuccess={resetSelection}
            />
            <BulkAccountButton
               bankAccounts={safeBankAccounts}
               collection={transactionsCollection}
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
                        const bulkRemove = bulkRemoveTransactionsAction(
                           transactionsCollection,
                        );
                        const result = await Result.tryPromise({
                           try: () =>
                              bulkRemove({ ids: selectedIds }).isPersisted
                                 .promise,
                           catch: (error) => error,
                        });
                        if (Result.isError(result)) {
                           toast.error(
                              getErrorMessage(
                                 result.error,
                                 "Erro ao excluir lançamentos.",
                              ),
                           );
                           return;
                        }
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
            <TooltipProvider>
               <ScrollArea className="flex-1 min-h-0 rounded-md border bg-card">
                  <Table>
                     <DataTableHeader table={table} />
                     <DataTableBody<TransactionRow>
                        getRowClassName={({ row }) =>
                           cn(
                              row.original.ignored &&
                                 "bg-muted/20 text-muted-foreground opacity-60",
                           )
                        }
                        table={table}
                     />
                     <DataImportSection
                        api={importApi}
                        config={importConfig}
                        table={table}
                     />
                  </Table>
                  {isTransactionsLoaded && table.getRowCount() === 0 && (
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
            </TooltipProvider>
            <DataTablePagination table={table} />
         </div>
      </div>
   );
}

function BulkIgnoreButton({
   ids,
   onSuccess,
   collection,
}: {
   ids: string[];
   onSuccess: () => void;
   collection: Parameters<typeof bulkUpdateTransactionsAction>[0];
}) {
   const { openAlertDialog } = useAlertDialog();

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
                  const update = bulkUpdateTransactionsAction(collection);
                  const result = await Result.tryPromise({
                     try: () =>
                        update({ ids, patch: { ignored: true } }).isPersisted
                           .promise,
                     catch: (error) => error,
                  });
                  if (Result.isError(result)) {
                     toast.error(
                        getErrorMessage(
                           result.error,
                           "Erro ao ignorar lançamentos.",
                        ),
                     );
                     return;
                  }
                  onSuccess();
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
   collection,
}: {
   ids: string[];
   onSuccess: () => void;
   collection: Parameters<typeof bulkUpdateTransactionsAction>[0];
}) {
   const [open, setOpen] = useState(false);

   const apply = async (status: "pending" | "paid") => {
      const update = bulkUpdateTransactionsAction(collection);
      const result = await Result.tryPromise({
         try: () => update({ ids, patch: { status } }).isPersisted.promise,
         catch: (error) => error,
      });
      setOpen(false);
      if (Result.isError(result)) {
         toast.error(
            getErrorMessage(result.error, "Erro ao atualizar status."),
         );
         return;
      }
      onSuccess();
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
   collection,
}: {
   ids: string[];
   onSuccess: () => void;
   collection: Parameters<typeof bulkUpdateTransactionsAction>[0];
}) {
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
               onSelect={async (d) => {
                  if (!d) return;
                  const date = dayjs(d).format("YYYY-MM-DD");
                  const update = bulkUpdateTransactionsAction(collection);
                  const result = await Result.tryPromise({
                     try: () =>
                        update({ ids, patch: { date } }).isPersisted.promise,
                     catch: (error) => error,
                  });
                  setOpen(false);
                  if (Result.isError(result)) {
                     toast.error(
                        getErrorMessage(
                           result.error,
                           "Erro ao atualizar data.",
                        ),
                     );
                     return;
                  }
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
   collection,
}: {
   ids: string[];
   categories: CategoryOption[];
   onSuccess: () => void;
   collection: Parameters<typeof bulkUpdateTransactionsAction>[0];
}) {
   const [open, setOpen] = useState(false);

   return (
      <Popover open={open} onOpenChange={setOpen}>
         <PopoverTrigger asChild>
            <SelectionActionButton icon={<FolderOpen />}>
               Categoria
            </SelectionActionButton>
         </PopoverTrigger>
         <PopoverContent align="start" className="w-64 p-0">
            <BulkLookupCommand
               emptyMessage="Nenhuma categoria."
               options={categories}
               searchPlaceholder="Buscar..."
               onSelect={async (category) => {
                  const update = bulkUpdateTransactionsAction(collection);
                  const result = await Result.tryPromise({
                     try: () =>
                        update({
                           ids,
                           patch: { categoryId: category.id },
                        }).isPersisted.promise,
                     catch: (error) => error,
                  });
                  setOpen(false);
                  if (Result.isError(result)) {
                     toast.error(
                        getErrorMessage(result.error, "Erro ao categorizar."),
                     );
                     return;
                  }
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
   collection,
}: {
   ids: string[];
   bankAccounts: BankAccountOption[];
   onSuccess: () => void;
   collection: Parameters<typeof bulkUpdateTransactionsAction>[0];
}) {
   const [open, setOpen] = useState(false);

   return (
      <Popover open={open} onOpenChange={setOpen}>
         <PopoverTrigger asChild>
            <SelectionActionButton icon={<Landmark />}>
               Conta
            </SelectionActionButton>
         </PopoverTrigger>
         <PopoverContent align="start" className="w-64 p-0">
            <BulkLookupCommand
               emptyMessage="Nenhuma conta."
               options={bankAccounts}
               searchPlaceholder="Buscar..."
               onSelect={async (bankAccount) => {
                  const update = bulkUpdateTransactionsAction(collection);
                  const result = await Result.tryPromise({
                     try: () =>
                        update({
                           ids,
                           patch: { bankAccountId: bankAccount.id },
                        }).isPersisted.promise,
                     catch: (error) => error,
                  });
                  setOpen(false);
                  if (Result.isError(result)) {
                     toast.error(
                        getErrorMessage(result.error, "Erro ao alterar conta."),
                     );
                     return;
                  }
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

type BulkLookupOption = {
   id: string;
   name: string;
};

function BulkLookupCommand({
   options,
   searchPlaceholder,
   emptyMessage,
   disabled,
   onSelect,
}: {
   options: BulkLookupOption[];
   searchPlaceholder: string;
   emptyMessage: string;
   disabled?: boolean;
   onSelect: (option: BulkLookupOption) => void;
}) {
   return (
      <Command>
         <CommandInput placeholder={searchPlaceholder} />
         <CommandList>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup>
               {options.map((option) => (
                  <CommandItem
                     key={option.id}
                     disabled={disabled}
                     onSelect={() => onSelect(option)}
                     value={option.name}
                  >
                     {option.name}
                  </CommandItem>
               ))}
            </CommandGroup>
         </CommandList>
      </Command>
   );
}

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
         <PopoverContent align="start" className="w-64 p-0">
            <BulkLookupCommand
               emptyMessage="Nenhuma categoria."
               options={categories}
               searchPlaceholder="Buscar..."
               onSelect={(category) => {
                  bulkUpdate(selectedIndices, {
                     categoryId: category.id,
                     categoryName: category.name,
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
         <PopoverContent align="start" className="w-64 p-0">
            <BulkLookupCommand
               emptyMessage="Nenhuma conta."
               options={bankAccounts}
               searchPlaceholder="Buscar..."
               onSelect={(bankAccount) => {
                  bulkUpdate(selectedIndices, {
                     bankAccountId: bankAccount.id,
                     bankAccountName: bankAccount.name,
                  });
                  setOpen(false);
                  clear();
               }}
            />
         </PopoverContent>
      </Popover>
   );
}
