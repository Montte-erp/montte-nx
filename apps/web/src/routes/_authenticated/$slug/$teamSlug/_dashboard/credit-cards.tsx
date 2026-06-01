import { ScrollArea } from "@packages/ui/components/scroll-area";
import { SearchInput } from "@packages/ui/components/search-input";
import { Table } from "@packages/ui/components/table";
import { Button } from "@packages/ui/components/button";
import { Checkbox } from "@packages/ui/components/checkbox";
import {
   Empty,
   EmptyDescription,
   EmptyHeader,
   EmptyMedia,
   EmptyTitle,
} from "@packages/ui/components/empty";
import {
   SelectionActionButton,
   useTableBulkActions,
} from "@/hooks/use-selection-toolbar";
import { createCollection, eq, ilike, useLiveQuery } from "@tanstack/react-db";
import { createFileRoute } from "@tanstack/react-router";
import {
   getCoreRowModel,
   getExpandedRowModel,
   useReactTable,
   type ColumnDef,
   type ColumnFiltersState,
   type ColumnOrderState,
   type ExpandedState,
   type ColumnPinningState,
   type OnChangeFn,
   type SortingState,
} from "@tanstack/react-table";
import {
   ChevronDown,
   ChevronRight,
   CreditCard,
   Plus,
   Trash2,
} from "lucide-react";
import { Result } from "better-result";
import { startTransition, useCallback, useMemo, useState } from "react";
import { toast } from "@packages/ui/hooks/use-toast";
import { z } from "zod";
import { DefaultHeader } from "../-layout/default-header";
import { DataTableBody } from "@/blocks/data-table/data-table-body";
import { DataTableColumnVisibility } from "@/blocks/data-table/data-table-column-visibility";
import { DataTableFilterChips } from "@/blocks/data-table/data-table-filter-chips";
import { ExportButton } from "@/components/export-button/export-button";
import { DataTableHeader } from "@/blocks/data-table/data-table-header";
import { DataTablePagination } from "@/blocks/data-table/data-table-pagination";
import { DataTableSkeleton } from "@/blocks/data-table/data-table-skeleton";
import { useDataTableLayout } from "@/blocks/data-table/use-data-table-layout";
import { useDebouncedSearch } from "@/blocks/data-table/use-debounced-search";
import { useTableUrlState } from "@/blocks/data-table/use-table-url-state";
import { DataImportButton } from "@/blocks/data-table/data-import/data-import-button";
import { DataImportSection } from "@/blocks/data-table/data-import/data-import-section";
import { useDataImport } from "@/blocks/data-table/data-import/use-data-import";
import type { DataImportConfig } from "@/blocks/data-table/data-import/use-data-import";
import { QueryBoundary } from "@/components/query-boundary";
import { useSheet } from "@/hooks/use-sheet";
import { useCsvFile } from "@/hooks/use-csv-file";
import { useXlsxFile } from "@/hooks/use-xlsx-file";
import { useActiveTeam } from "@/hooks/use-active-team";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { bankAccountsCollectionOptions } from "@/integrations/tanstack-db/bank-accounts";
import {
   bulkCreateCreditCardsAction,
   bulkDeleteCreditCardsAction,
   buildOptimisticCreditCardRow,
   buildOptimisticCreditCardRowId,
   createCreditCardAction,
   creditCardsCollectionOptions,
   creditCardsPageInfoCollectionOptions,
   deleteCreditCardAction,
   type CreditCardCreateInput,
   type CreditCardUpdateInput,
   updateCreditCardAction,
} from "@/integrations/tanstack-db/credit-cards";
import { CreditCardFormSheet } from "./-credit-cards/credit-card-form-sheet";
import {
   buildCreditCardColumns,
   type CreditCardRow,
} from "./-credit-cards/credit-cards-columns";
import { CreditCardFaturaRow } from "./-credit-cards/credit-card-fatura-row";

const creditCardsSearchSchema = z.object({
   sorting: z
      .array(z.object({ id: z.string(), desc: z.boolean() }))
      .catch([])
      .default([]),
   columnFilters: z
      .array(z.object({ id: z.string(), value: z.unknown() }))
      .catch([])
      .default([]),
   search: z.string().max(100).catch("").default(""),
   status: z
      .union([z.enum(["active", "blocked", "cancelled"]), z.undefined()])
      .catch(undefined),
   page: z.number().int().min(1).catch(1).default(1),
   pageSize: z.number().int().catch(20).default(20),
});

const skeletonColumns = buildCreditCardColumns();

const creditCardStatusSchema = z.enum(["active", "blocked", "cancelled"]);

const creditCardSortIdSchema = z.enum([
   "bankAccountId",
   "brand",
   "closingDay",
   "creditLimit",
   "dueDay",
   "name",
   "status",
]);

function getCreditCardStatusColumnFilter(
   filters: Array<{ id: string; value: unknown }>,
) {
   const filter = filters.find((item) => item.id === "status");
   const result = creditCardStatusSchema.safeParse(filter?.value);
   return result.success ? result.data : undefined;
}

function normalizeCreditCardSorting(sorting: SortingState) {
   const normalized: Array<{
      id: z.infer<typeof creditCardSortIdSchema>;
      desc: boolean;
   }> = [];
   for (const rule of sorting) {
      const result = creditCardSortIdSchema.safeParse(rule.id);
      if (!result.success) continue;
      normalized.push({ id: result.data, desc: rule.desc });
   }
   return normalized;
}

function normalizeCreditCardColumnOrder(
   order: ColumnOrderState,
   allColumnIds: ColumnOrderState,
) {
   if (order.length === 0) return order;
   const next = order.filter(
      (id) => id !== "__actions" && allColumnIds.includes(id),
   );
   const missing = allColumnIds.filter(
      (id) => id !== "__actions" && !next.includes(id),
   );
   return [...next, ...missing, "__actions"];
}

function normalizeCreditCardColumnPinning(
   pinning: ColumnPinningState,
): ColumnPinningState {
   const left = (pinning.left ?? []).filter((id) => id !== "__actions");
   const right = (pinning.right ?? []).filter((id) => id !== "__actions");
   return { left, right: [...right, "__actions"] };
}

function getCreditCardColumnId(column: ColumnDef<CreditCardRow>) {
   if (column.id) return column.id;
   if ("accessorKey" in column && typeof column.accessorKey === "string") {
      return column.accessorKey;
   }
   return undefined;
}

function isDefined(value: string | undefined): value is string {
   return typeof value === "string";
}

type CreditCardBrand =
   | "visa"
   | "mastercard"
   | "elo"
   | "amex"
   | "hipercard"
   | "other";

type CreditCardStatus = "active" | "blocked" | "cancelled";

function normalizeImportLookup(value: unknown): string {
   return String(value ?? "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "");
}

function resolveBankAccountId(
   bankAccounts: Array<{ id: string; name: string }>,
   value: unknown,
): string | null {
   const normalized = normalizeImportLookup(value);
   if (!normalized) return null;
   const bankAccount = bankAccounts.find(
      (item) =>
         normalizeImportLookup(item.id) === normalized ||
         normalizeImportLookup(item.name) === normalized,
   );
   return bankAccount?.id ?? null;
}

function parseCreditCardBrand(value: unknown): CreditCardBrand | undefined {
   const normalized = normalizeImportLookup(value);
   if (normalized === "visa") return "visa";
   if (normalized === "mastercard") return "mastercard";
   if (normalized === "elo") return "elo";
   if (normalized === "amex") return "amex";
   if (normalized === "hipercard") return "hipercard";
   if (normalized === "other") return "other";
   return undefined;
}

function parseCreditCardStatus(value: unknown): CreditCardStatus {
   const normalized = normalizeImportLookup(value);
   if (normalized === "blocked" || normalized === "bloqueado") {
      return "blocked";
   }
   if (normalized === "cancelled" || normalized === "cancelado") {
      return "cancelled";
   }
   return "active";
}

function parseImportDay(value: unknown, fallback: number): number {
   const parsed = Number.parseInt(String(value ?? ""), 10);
   if (Number.isNaN(parsed) || parsed < 1 || parsed > 31) return fallback;
   return parsed;
}

function normalizeLast4(value: unknown): string | null {
   const digits = String(value ?? "")
      .replace(/\D/g, "")
      .slice(-4);
   return digits.length === 4 ? digits : null;
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

type CreditCardUpdatePatch = Omit<CreditCardUpdateInput, "id">;

function getCreditCardRowPatch(
   payload: Record<string, unknown>,
): CreditCardUpdatePatch {
   const patch: CreditCardUpdatePatch = {};

   if (typeof payload.name === "string") patch.name = payload.name;
   if (typeof payload.color === "string") patch.color = payload.color;
   if (payload.iconUrl === null || typeof payload.iconUrl === "string") {
      patch.iconUrl = payload.iconUrl;
   }
   if (typeof payload.creditLimit === "number") {
      patch.creditLimit = String(payload.creditLimit);
   }
   if (typeof payload.creditLimit === "string") {
      patch.creditLimit = payload.creditLimit;
   }
   if (payload.last4 === null || typeof payload.last4 === "string") {
      patch.last4 = payload.last4;
   }
   if (typeof payload.closingDay === "number") {
      patch.closingDay = payload.closingDay;
   }
   if (typeof payload.dueDay === "number") patch.dueDay = payload.dueDay;
   if (typeof payload.bankAccountId === "string") {
      patch.bankAccountId = payload.bankAccountId;
   }
   if (
      payload.status === "active" ||
      payload.status === "blocked" ||
      payload.status === "cancelled"
   ) {
      patch.status = payload.status;
   }
   if (
      payload.brand === null ||
      payload.brand === "visa" ||
      payload.brand === "mastercard" ||
      payload.brand === "elo" ||
      payload.brand === "amex" ||
      payload.brand === "hipercard" ||
      payload.brand === "other"
   ) {
      patch.brand = payload.brand;
   }

   return patch;
}

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/credit-cards",
)({
   validateSearch: creditCardsSearchSchema,
   ssr: false,
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
   const { sorting, columnFilters, page, pageSize, search, status } =
      Route.useSearch();
   const { openAlertDialog } = useAlertDialog();
   const { openSheet } = useSheet();
   const { activeTeamId } = useActiveTeam();
   const { queryClient, publicEnv } = Route.useRouteContext();
   const { parse: parseCsv, generate: generateCsv } = useCsvFile();
   const { parse: parseXlsx, generate: generateXlsx } = useXlsxFile();
   const layout = useDataTableLayout("credit-cards");
   const [expanded, setExpanded] = useState<ExpandedState>({});
   const columnPinning = useMemo(
      () => normalizeCreditCardColumnPinning(layout.state.columnPinning),
      [layout.state.columnPinning],
   );

   const searchInput = useDebouncedSearch({
      value: search,
      onCommit: (value) =>
         navigate({
            search: (prev) => ({ ...prev, search: value, page: 1 }),
            replace: true,
         }),
   });

   const creditCardsCollection = useMemo(
      () =>
         createCollection(
            creditCardsCollectionOptions({
               queryClient,
               teamId: activeTeamId ?? "no-team",
            }),
         ),
      [activeTeamId, queryClient],
   );

   const bankAccountsCollection = useMemo(
      () =>
         createCollection(
            bankAccountsCollectionOptions({
               queryClient,
               teamId: activeTeamId ?? "no-team",
            }),
         ),
      [activeTeamId, queryClient],
   );

   const trimmedSearch = search.trim();
   const effectiveStatus =
      status ?? getCreditCardStatusColumnFilter(columnFilters);
   const creditCardsPageInfoCollection = useMemo(
      () =>
         createCollection(
            creditCardsPageInfoCollectionOptions({
               queryClient,
               teamId: activeTeamId ?? "no-team",
               search: trimmedSearch || undefined,
               status: effectiveStatus,
            }),
         ),
      [activeTeamId, effectiveStatus, queryClient, trimmedSearch],
   );

   const { data: liveCreditCards } = useLiveQuery(
      (q) => {
         let query = q.from({ creditCard: creditCardsCollection });

         if (effectiveStatus) {
            query = query.where(({ creditCard }) =>
               eq(creditCard.status, effectiveStatus),
            );
         }

         if (trimmedSearch) {
            const pattern = `%${escapeIlikePattern(trimmedSearch)}%`;
            query = query.where(({ creditCard }) =>
               ilike(creditCard.name, pattern),
            );
         }

         const nameFilterValue = columnFilters.find(
            (filter) => filter.id === "name",
         )?.value;
         if (typeof nameFilterValue === "string" && nameFilterValue.trim()) {
            query = query.where(({ creditCard }) =>
               ilike(
                  creditCard.name,
                  `%${escapeIlikePattern(nameFilterValue.trim())}%`,
               ),
            );
         }

         const normalizedSorting = normalizeCreditCardSorting(sorting);
         if (normalizedSorting.length > 0) {
            for (const rule of normalizedSorting) {
               switch (rule.id) {
                  case "bankAccountId":
                     query = query.orderBy(
                        ({ creditCard }) => creditCard.bankAccountId,
                        rule.desc ? "desc" : "asc",
                     );
                     break;
                  case "brand":
                     query = query.orderBy(
                        ({ creditCard }) => creditCard.brand,
                        rule.desc ? "desc" : "asc",
                     );
                     break;
                  case "closingDay":
                     query = query.orderBy(
                        ({ creditCard }) => creditCard.closingDay,
                        rule.desc ? "desc" : "asc",
                     );
                     break;
                  case "creditLimit":
                     query = query.orderBy(
                        ({ creditCard }) => creditCard.creditLimit,
                        rule.desc ? "desc" : "asc",
                     );
                     break;
                  case "dueDay":
                     query = query.orderBy(
                        ({ creditCard }) => creditCard.dueDay,
                        rule.desc ? "desc" : "asc",
                     );
                     break;
                  case "name":
                     query = query.orderBy(
                        ({ creditCard }) => creditCard.name,
                        rule.desc ? "desc" : "asc",
                     );
                     break;
                  case "status":
                     query = query.orderBy(
                        ({ creditCard }) => creditCard.status,
                        rule.desc ? "desc" : "asc",
                     );
                     break;
               }
            }
         } else {
            query = query.orderBy(({ creditCard }) => creditCard.name, "asc");
         }

         return query
            .limit(pageSize)
            .offset((page - 1) * pageSize)
            .select(({ creditCard }) => creditCard);
      },
      [
         columnFilters,
         creditCardsCollection,
         effectiveStatus,
         page,
         pageSize,
         sorting,
         trimmedSearch,
      ],
   );

   const { data: bankAccounts } = useLiveQuery(
      (q) =>
         q
            .from({ bankAccount: bankAccountsCollection })
            .select(({ bankAccount }) => bankAccount),
      [bankAccountsCollection],
   );

   const { data: pageInfoRows } = useLiveQuery(
      (q) =>
         q
            .from({ pageInfo: creditCardsPageInfoCollection })
            .select(({ pageInfo }) => pageInfo),
      [creditCardsPageInfoCollection],
   );

   const safeLiveCreditCards = useMemo(
      () => liveCreditCards ?? [],
      [liveCreditCards],
   );
   const safeBankAccounts = useMemo(() => bankAccounts ?? [], [bankAccounts]);
   const totalCreditCards = pageInfoRows?.[0]?.totalCount ?? 0;

   const creditCards = useMemo(
      () => ({ all: safeLiveCreditCards, rows: safeLiveCreditCards }),
      [safeLiveCreditCards],
   );

   const handleCreate = useCallback(
      async (input: CreditCardCreateInput) => {
         if (!activeTeamId) {
            toast.error("Time ativo não encontrado.");
            return false;
         }
         const createCreditCard = createCreditCardAction(creditCardsCollection);
         const transaction = createCreditCard({
            row: buildOptimisticCreditCardRow({
               id: buildOptimisticCreditCardRowId(),
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
            toast.error(getErrorMessage(result.error, "Erro ao criar cartão."));
            return false;
         }
         toast.success("Cartão criado com sucesso.");
         return true;
      },
      [activeTeamId, creditCardsCollection],
   );

   const handleInlineUpdate = useCallback(
      async (id: string, patch: Record<string, unknown>) => {
         const updateCreditCard = updateCreditCardAction(creditCardsCollection);
         const transaction = updateCreditCard({
            id,
            patch: getCreditCardRowPatch(patch),
         });
         const result = await Result.tryPromise({
            try: () => transaction.isPersisted.promise,
            catch: (error) => error,
         });
         if (Result.isError(result)) {
            toast.error(
               getErrorMessage(result.error, "Erro ao atualizar cartão."),
            );
         }
      },
      [creditCardsCollection],
   );

   const handleOpenCreate = useCallback(() => {
      openSheet({
         renderChildren: () => (
            <CreditCardFormSheet
               bankAccounts={safeBankAccounts}
               logoDevToken={publicEnv?.LOGO_DEV_TOKEN}
               onCreate={handleCreate}
            />
         ),
      });
   }, [handleCreate, openSheet, publicEnv?.LOGO_DEV_TOKEN, safeBankAccounts]);

   const importConfig: DataImportConfig = useMemo(
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
         importColumns: [{ key: "last4", label: "Final" }],
         mapRow: (row, i) => ({
            id: `__import_${i + 1}`,
            name: String(row.name ?? "").trim(),
            brand: parseCreditCardBrand(row.brand),
            last4: normalizeLast4(row.last4 ?? row.final),
            color: "#6366f1",
            creditLimit: String(row.creditLimit ?? row.limite ?? "0"),
            closingDay: parseImportDay(row.closingDay ?? row.fechamento, 1),
            dueDay: parseImportDay(row.dueDay ?? row.vencimento, 1),
            bankAccountId: resolveBankAccountId(
               safeBankAccounts,
               row.bankAccountId,
            ),
            status: parseCreditCardStatus(row.status),
         }),
         template: {
            label: "Baixar modelo",
            description:
               "Inclui Nome, Bandeira, Final, Limite, Fechamento, Vencimento, Conta Bancária e Status.",
            formats: [
               {
                  filename: "modelo-cartoes-credito.csv",
                  label: "CSV",
                  createBlob: () =>
                     generateCsv(
                        [
                           {
                              Nome: "Cartão Principal",
                              Bandeira: "visa",
                              Final: "1234",
                              Limite: "5000.00",
                              Fechamento: "10",
                              Vencimento: "20",
                              "Conta Bancária": safeBankAccounts[0]?.name ?? "",
                              Status: "Ativo",
                           },
                        ],
                        [
                           "Nome",
                           "Bandeira",
                           "Final",
                           "Limite",
                           "Fechamento",
                           "Vencimento",
                           "Conta Bancária",
                           "Status",
                        ],
                     ),
               },
               {
                  filename: "modelo-cartoes-credito.xlsx",
                  label: "XLSX",
                  createBlob: () =>
                     generateXlsx(
                        [
                           {
                              Nome: "Cartão Principal",
                              Bandeira: "visa",
                              Final: "1234",
                              Limite: "5000.00",
                              Fechamento: "10",
                              Vencimento: "20",
                              "Conta Bancária": safeBankAccounts[0]?.name ?? "",
                              Status: "Ativo",
                           },
                        ],
                        [
                           "Nome",
                           "Bandeira",
                           "Final",
                           "Limite",
                           "Fechamento",
                           "Vencimento",
                           "Conta Bancária",
                           "Status",
                        ],
                     ),
               },
            ],
         },
         onImport: async (rows) => {
            if (!activeTeamId) {
               toast.error("Time ativo não encontrado.");
               return;
            }
            const firstBankAccountId = safeBankAccounts[0]?.id;
            if (!firstBankAccountId) {
               toast.error(
                  "Nenhuma conta bancária disponível para importação.",
               );
               return;
            }

            const inputs = rows.map((r) => ({
               name: String(r.name ?? ""),
               closingDay: typeof r.closingDay === "number" ? r.closingDay : 1,
               dueDay: typeof r.dueDay === "number" ? r.dueDay : 1,
               bankAccountId:
                  resolveBankAccountId(safeBankAccounts, r.bankAccountId) ??
                  firstBankAccountId,
               color: "#6366f1",
               creditLimit: String(r.creditLimit ?? "0"),
               last4: normalizeLast4(r.last4),
               brand: parseCreditCardBrand(r.brand),
               status: parseCreditCardStatus(r.status),
            }));
            const bulkCreate = bulkCreateCreditCardsAction(
               creditCardsCollection,
            );
            const transaction = bulkCreate({
               rows: inputs.map((input) => ({
                  input,
                  row: buildOptimisticCreditCardRow({
                     id: buildOptimisticCreditCardRowId(),
                     input,
                     teamId: activeTeamId,
                  }),
               })),
            });
            const result = await Result.tryPromise({
               try: () => transaction.isPersisted.promise,
               catch: (error) => error,
            });
            if (Result.isError(result)) {
               toast.error(
                  getErrorMessage(
                     result.error,
                     "Erro ao importar cartões de crédito.",
                  ),
               );
            }
         },
      }),
      [
         activeTeamId,
         creditCardsCollection,
         safeBankAccounts,
         generateCsv,
         generateXlsx,
         parseCsv,
         parseXlsx,
      ],
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
               const deleteCreditCard = deleteCreditCardAction(
                  creditCardsCollection,
               );
               const transaction = deleteCreditCard({ id: card.id });
               const result = await Result.tryPromise({
                  try: () => transaction.isPersisted.promise,
                  catch: (error) => error,
               });
               if (Result.isError(result)) {
                  toast.error(
                     getErrorMessage(
                        result.error,
                        "Erro ao excluir cartão de crédito.",
                     ),
                  );
                  return;
               }
               toast.success("Cartão de crédito excluído com sucesso.");
            },
         });
      },
      [creditCardsCollection, openAlertDialog],
   );

   const columns = useMemo<ColumnDef<CreditCardRow>[]>(() => {
      const base = buildCreditCardColumns({
         bankAccounts: safeBankAccounts.map((b) => ({
            id: b.id,
            name: b.name,
            bankName: b.bankName,
            bankCode: b.bankCode,
            color: b.color,
         })),
         logoDevToken: publicEnv?.LOGO_DEV_TOKEN,
         onUpdate: handleInlineUpdate,
      });
      const selectColumn: ColumnDef<CreditCardRow> = {
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
      const expandColumn: ColumnDef<CreditCardRow> = {
         id: "__expand",
         size: 40,
         enableSorting: false,
         enableHiding: false,
         meta: { exportIgnore: true },
         cell: ({ row }) => (
            <Button
               aria-label={row.getIsExpanded() ? "Recolher" : "Expandir"}
               onClick={(event) => {
                  event.stopPropagation();
                  row.toggleExpanded();
               }}
               size="icon-sm"
               tooltip={row.getIsExpanded() ? "Recolher fatura" : "Ver fatura"}
               variant="ghost"
            >
               {row.getIsExpanded() ? <ChevronDown /> : <ChevronRight />}
            </Button>
         ),
      };
      const actionsColumn: ColumnDef<CreditCardRow> = {
         id: "__actions",
         size: 60,
         enableSorting: false,
         enableHiding: false,
         meta: { align: "right" },
         cell: ({ row }) => (
            <div className="flex justify-end gap-2">
               <Button
                  className="text-destructive hover:text-destructive"
                  onClick={() => handleDelete(row.original)}
                  size="icon-sm"
                  tooltip="Excluir"
                  variant="outline"
               >
                  <Trash2 />
               </Button>
            </div>
         ),
      };
      return [selectColumn, expandColumn, ...base, actionsColumn];
   }, [
      publicEnv?.LOGO_DEV_TOKEN,
      safeBankAccounts,
      handleDelete,
      handleInlineUpdate,
   ]);

   const columnIds = useMemo(
      () => columns.map(getCreditCardColumnId).filter(isDefined),
      [columns],
   );

   const columnOrder = useMemo(
      () => normalizeCreditCardColumnOrder(layout.state.columnOrder, columnIds),
      [layout.state.columnOrder, columnIds],
   );

   const handleColumnFiltersChange = useCallback(
      (
         updater:
            | ColumnFiltersState
            | ((prev: ColumnFiltersState) => ColumnFiltersState),
      ) => {
         const next =
            typeof updater === "function" ? updater(columnFilters) : updater;
         const statusFilter = next.find((f) => f.id === "status");
         startTransition(() => {
            navigate({
               search: (prev) => ({
                  ...prev,
                  columnFilters: next,
                  status: creditCardsSearchSchema.shape.status.parse(
                     statusFilter?.value,
                  ),
                  page: 1,
               }),
               replace: true,
            });
         });
      },
      [navigate, columnFilters],
   );

   const urlState = useTableUrlState({
      search: { sorting, columnFilters, page, pageSize },
      onUpdate: (next) =>
         navigate({
            search: (prev) => ({ ...prev, ...next }),
            replace: true,
         }),
      totalRows: totalCreditCards,
   });

   const handleColumnOrderChange = useCallback<OnChangeFn<ColumnOrderState>>(
      (updater) => {
         layout.onColumnOrderChange((prev) =>
            normalizeCreditCardColumnOrder(
               typeof updater === "function" ? updater(prev) : updater,
               columnIds,
            ),
         );
      },
      [layout, columnIds],
   );

   const handleColumnPinningChange = useCallback<
      OnChangeFn<ColumnPinningState>
   >(
      (updater) => {
         layout.onColumnPinningChange((prev) =>
            normalizeCreditCardColumnPinning(
               typeof updater === "function" ? updater(prev) : updater,
            ),
         );
      },
      [layout],
   );

   const table = useReactTable({
      data: creditCards.rows,
      columns,
      getRowId: (row) => row.id,
      rowCount: totalCreditCards,
      pageCount: urlState.pageCount,
      manualPagination: true,
      manualSorting: true,
      manualFiltering: true,
      columnResizeMode: "onChange",
      defaultColumn: { minSize: 80, size: 160, maxSize: 600 },
      state: {
         ...urlState.state,
         ...layout.state,
         columnOrder,
         columnPinning,
         expanded,
      },
      onSortingChange: urlState.onSortingChange,
      onColumnFiltersChange: handleColumnFiltersChange,
      onPaginationChange: urlState.onPaginationChange,
      onRowSelectionChange: urlState.onRowSelectionChange,
      onColumnSizingChange: layout.onColumnSizingChange,
      onColumnOrderChange: handleColumnOrderChange,
      onColumnVisibilityChange: layout.onColumnVisibilityChange,
      onColumnPinningChange: handleColumnPinningChange,
      onExpandedChange: setExpanded,
      getCoreRowModel: getCoreRowModel(),
      getExpandedRowModel: getExpandedRowModel(),
      getRowCanExpand: () => true,
   });

   const importApi = useDataImport({ table, config: importConfig });

   const selectedRows = table.getSelectedRowModel().rows;
   const selectedIds = selectedRows.map((r) => r.original.id);

   useTableBulkActions({
      selectedCount: selectedRows.length,
      onClear: () => table.resetRowSelection(),
      children: (
         <SelectionActionButton
            icon={<Trash2 />}
            variant="destructive"
            onClick={() => {
               openAlertDialog({
                  title: `Excluir ${selectedIds.length} ${selectedIds.length === 1 ? "cartão" : "cartões"}`,
                  description:
                     "Tem certeza que deseja excluir os cartões selecionados? Esta ação não pode ser desfeita.",
                  actionLabel: "Excluir",
                  cancelLabel: "Cancelar",
                  variant: "destructive",
                  onAction: async () => {
                     const bulkDelete = bulkDeleteCreditCardsAction(
                        creditCardsCollection,
                     );
                     const result = await Result.tryPromise({
                        try: () =>
                           bulkDelete({ ids: selectedIds }).isPersisted.promise,
                        catch: (error) => error,
                     });
                     if (Result.isError(result)) {
                        toast.error(
                           getErrorMessage(
                              result.error,
                              "Erro ao excluir cartões.",
                           ),
                        );
                        return;
                     }
                     table.resetRowSelection();
                     toast.success(
                        `${selectedIds.length} ${selectedIds.length === 1 ? "cartão excluído" : "cartões excluídos"} com sucesso.`,
                     );
                  },
               });
            }}
         >
            Excluir
         </SelectionActionButton>
      ),
   });

   return (
      <div className="flex flex-1 flex-col gap-4 min-h-0">
         <div className="flex flex-1 flex-col gap-4 min-h-0">
            <div className="flex flex-wrap items-center gap-2 justify-between">
               <SearchInput
                  className="max-w-sm"
                  aria-label="Buscar cartões..."
                  onChange={(e) => searchInput.onChange(e.target.value)}
                  placeholder="Buscar cartões..."
                  value={searchInput.value}
               />
               <div className="flex flex-wrap items-center gap-2">
                  <DataTableColumnVisibility table={table} />
                  <ExportButton table={table} fileBase="cartoes-credito" />
                  <DataImportButton api={importApi} config={importConfig} />
                  <Button
                     onClick={handleOpenCreate}
                     size="icon-sm"
                     tooltip="Novo Cartão"
                     variant="outline"
                  >
                     <Plus />
                     <span className="sr-only">Novo Cartão</span>
                  </Button>
               </div>
            </div>
            <DataTableFilterChips table={table} />
            <ScrollArea className="flex-1 min-h-0 rounded-md border bg-card">
               <Table>
                  <DataTableHeader table={table} />
                  <DataTableBody<CreditCardRow>
                     table={table}
                     renderExpandedRow={({ row }) => (
                        <CreditCardFaturaRow
                           creditCardId={row.original.id}
                           queryClient={queryClient}
                        />
                     )}
                  />
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
                           <CreditCard className="size-4" />
                        </EmptyMedia>
                        <EmptyTitle>Nenhum cartão de crédito</EmptyTitle>
                        <EmptyDescription>
                           Adicione um cartão de crédito para controlar seus
                           gastos.
                        </EmptyDescription>
                     </EmptyHeader>
                  </Empty>
               )}
            </ScrollArea>
            {totalCreditCards > 0 && <DataTablePagination table={table} />}
         </div>
      </div>
   );
}

function CreditCardsPage() {
   return (
      <main className="flex flex-1 min-h-0 flex-col gap-4 overflow-hidden">
         <DefaultHeader
            description="Gerencie seus cartões de crédito"
            title="Cartões de Crédito"
         />
         <div className="flex flex-1 flex-col min-h-0">
            <QueryBoundary
               fallback={<CreditCardsSkeleton />}
               errorTitle="Erro ao carregar cartões"
            >
               <CreditCardsList />
            </QueryBoundary>
         </div>
      </main>
   );
}
