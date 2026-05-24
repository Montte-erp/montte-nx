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
import { createFileRoute, Link } from "@tanstack/react-router";
import {
   getCoreRowModel,
   useReactTable,
   type ColumnDef,
   type SortingState,
} from "@tanstack/react-table";
import { Result } from "better-result";
import { Landmark, Plus, ReceiptText, Trash2 } from "lucide-react";
import { useCallback, useMemo } from "react";
import { toast } from "@packages/ui/hooks/use-toast";
import { z } from "zod";

import { DataTableBody } from "@/blocks/data-table/data-table-body";
import { DataTableColumnVisibility } from "@/blocks/data-table/data-table-column-visibility";
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
import { PageFilters } from "@/components/page-filters/page-filters";
import { PageFilter } from "@/components/page-filters/page-filter";
import { QueryBoundary } from "@/components/query-boundary";
import { useActiveTeam } from "@/hooks/use-active-team";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useCsvFile } from "@/hooks/use-csv-file";
import { useDashboardSlugs } from "@/hooks/use-dashboard-slugs";
import { useSheet } from "@/hooks/use-sheet";
import { useXlsxFile } from "@/hooks/use-xlsx-file";
import {
   bankAccountsCollectionOptions,
   bulkCreateBankAccountsAction,
   bulkDeleteBankAccountsAction,
   buildOptimisticBankAccountRow,
   buildOptimisticBankAccountRowId,
   deleteBankAccountAction,
   type BankAccountUpdateInput,
   type BankAccountsCollectionRow,
   updateBankAccountAction,
} from "@/integrations/tanstack-db/bank-accounts";
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

const BANK_CODE_PATTERN = /^\d{1,3}$/;

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

function normalizeImportAmount(raw: unknown): string | undefined {
   const trimmed = String(raw ?? "").trim();
   if (!trimmed) return undefined;
   if (!/^-?[\d.,]+$/.test(trimmed)) return undefined;
   const hasComma = trimmed.includes(",");
   const hasDot = trimmed.includes(".");

   if (hasComma && hasDot) {
      const isCommaDecimal =
         trimmed.lastIndexOf(",") > trimmed.lastIndexOf(".");
      return isCommaDecimal
         ? trimmed.replace(/\./g, "").replace(",", ".")
         : trimmed.replace(/,/g, "");
   }
   if (hasComma) return trimmed.replace(",", ".");
   return trimmed;
}

function parseImportBalance(raw: unknown): {
   raw: string;
   normalized: string;
   isValid: boolean;
} {
   const rawValue = String(raw ?? "").trim();
   if (!rawValue) {
      return { raw: "", normalized: "0", isValid: true };
   }
   const normalized = normalizeImportAmount(rawValue);
   const isValid =
      normalized !== undefined &&
      !Number.isNaN(Number(normalized)) &&
      /^-?\d+(?:\.\d+)?$/.test(normalized);

   if (!isValid) {
      return { raw: rawValue, normalized: "0", isValid: false };
   }

   return { raw: rawValue, normalized, isValid: true };
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

const bankAccountSortIdSchema = z.enum([
   "currentBalance",
   "initialBalance",
   "name",
   "projectedBalance",
   "type",
]);

function normalizeBankAccountSorting(sorting: SortingState) {
   const normalized: Array<{
      id: z.infer<typeof bankAccountSortIdSchema>;
      desc: boolean;
   }> = [];
   for (const rule of sorting) {
      const result = bankAccountSortIdSchema.safeParse(rule.id);
      if (!result.success) continue;
      normalized.push({ id: result.data, desc: rule.desc });
   }
   return normalized;
}

const skeletonColumns = buildBankAccountColumns();

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

type LiveBankAccountRow = BankAccountRow & {
   $synced: boolean;
};

function bankAccountDedupeKey(account: BankAccountRow) {
   return `${account.teamId}:${account.type}:${account.name.trim().toLocaleLowerCase()}:${account.bankCode ?? ""}`;
}

function removeConfirmedOptimisticDuplicates(accounts: LiveBankAccountRow[]) {
   const syncedKeys = new Set<string>();
   for (const account of accounts) {
      if (!account.$synced) continue;
      syncedKeys.add(bankAccountDedupeKey(account));
   }

   return accounts.filter(
      (account) =>
         account.$synced || !syncedKeys.has(bankAccountDedupeKey(account)),
   );
}

function compareBankAccountValues(
   left: BankAccountRow,
   right: BankAccountRow,
   sortId: z.infer<typeof bankAccountSortIdSchema>,
) {
   switch (sortId) {
      case "currentBalance":
         return Number(left.currentBalance) - Number(right.currentBalance);
      case "initialBalance":
         return Number(left.initialBalance) - Number(right.initialBalance);
      case "name":
         return left.name.localeCompare(right.name, "pt-BR");
      case "projectedBalance":
         return Number(left.projectedBalance) - Number(right.projectedBalance);
      case "type":
         return left.type.localeCompare(right.type, "pt-BR");
   }
}

function sortBankAccounts(rows: BankAccountRow[], sorting: SortingState) {
   const normalized = normalizeBankAccountSorting(sorting);
   return [...rows].sort((left, right) => {
      for (const rule of normalized) {
         const result = compareBankAccountValues(left, right, rule.id);
         if (result !== 0) return rule.desc ? -result : result;
      }
      return left.name.localeCompare(right.name, "pt-BR");
   });
}

type BankAccountUpdatePatch = Omit<BankAccountUpdateInput, "id">;

function getBankAccountRowPatch(
   payload: Record<string, unknown>,
): BankAccountUpdatePatch {
   const patch: BankAccountUpdatePatch = {};

   if (typeof payload.name === "string") {
      patch.name = payload.name;
   }
   if (payload.type === "checking") {
      patch.type = payload.type;
   }
   if (payload.type === "savings") {
      patch.type = payload.type;
   }
   if (payload.type === "investment") {
      patch.type = payload.type;
   }
   if (payload.type === "payment") {
      patch.type = payload.type;
   }
   if (payload.type === "cash") {
      patch.type = payload.type;
   }
   if (typeof payload.initialBalance === "number") {
      patch.initialBalance = String(payload.initialBalance);
   }
   if (typeof payload.initialBalance === "string") {
      patch.initialBalance = payload.initialBalance;
   }
   if (typeof payload.color === "string") {
      patch.color = payload.color;
   }
   if (payload.iconUrl === null || typeof payload.iconUrl === "string") {
      patch.iconUrl = payload.iconUrl;
   }
   if (payload.bankCode === null || typeof payload.bankCode === "string") {
      patch.bankCode = payload.bankCode;
   }
   if (payload.bankName === null || typeof payload.bankName === "string") {
      patch.bankName = payload.bankName;
   }
   if (payload.branch === null || typeof payload.branch === "string") {
      patch.branch = payload.branch;
   }
   if (
      payload.accountNumber === null ||
      typeof payload.accountNumber === "string"
   ) {
      patch.accountNumber = payload.accountNumber;
   }
   if (payload.notes === null || typeof payload.notes === "string") {
      patch.notes = payload.notes;
   }

   return patch;
}

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/bank-accounts",
)({
   validateSearch: searchSchema,
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
   const { activeTeamId } = useActiveTeam();
   const { queryClient, publicEnv } = Route.useRouteContext();
   const { sorting, columnFilters, type, search, page, pageSize } =
      Route.useSearch();
   const { openAlertDialog } = useAlertDialog();
   const { openSheet } = useSheet();
   const { parse: parseCsv, generate: generateCsv } = useCsvFile();
   const { parse: parseXlsx, generate: generateXlsx } = useXlsxFile();
   const layout = useDataTableLayout("bank-accounts");

   const searchInput = useDebouncedSearch({
      value: search,
      onCommit: (value) =>
         navigate({
            search: (prev) => ({ ...prev, search: value, page: 1 }),
            replace: true,
         }),
   });

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

   const { data: liveBankAccounts } = useLiveQuery(
      (q) => {
         let query = q.from({ bankAccount: bankAccountsCollection });
         const pattern = `%${search.trim()}%`;

         if (type) {
            query = query.where(({ bankAccount }) =>
               eq(bankAccount.type, type),
            );
         }

         if (search.trim()) {
            query = query.where(({ bankAccount }) =>
               ilike(bankAccount.name, pattern),
            );
         }

         return query.select(({ bankAccount }) => bankAccount);
      },
      [bankAccountsCollection, type, search],
   );

   const bankAccounts = useMemo(() => {
      const normalized = removeConfirmedOptimisticDuplicates(
         liveBankAccounts as LiveBankAccountRow[],
      );
      const sorted = sortBankAccounts(normalized, sorting);
      const start = (page - 1) * pageSize;
      return {
         all: sorted,
         rows: sorted.slice(start, start + pageSize),
      };
   }, [liveBankAccounts, page, pageSize, sorting]);

   const importConfig: DataImportConfig = useMemo(
      () => ({
         parseFile: async (file: File) => {
            const ext = file.name.split(".").pop()?.toLowerCase();
            if (ext === "xlsx" || ext === "xls") return parseXlsx(file);
            return parseCsv(file);
         },
         importColumns: [
            { key: "bankCode", label: "Código do Banco" },
            { key: "bankName", label: "Banco" },
            { key: "branch", label: "Agência" },
            { key: "accountNumber", label: "Conta" },
         ],
         mapRow: (row, i) => {
            const initialBalance =
               String(row.initialBalance ?? "").trim() || "0";
            return {
               id: `__import_${i + 1}`,
               importLine: i + 2,
               name: String(row.name ?? "").trim(),
               type: row.type,
               color: "#6366f1",
               bankCode: String(row.bankCode ?? "").trim(),
               bankName: String(row.bankName ?? "").trim(),
               branch: String(row.branch ?? "").trim(),
               accountNumber: String(row.accountNumber ?? "").trim(),
               initialBalance,
               currentBalance: initialBalance,
               projectedBalance: initialBalance,
               iconUrl: null,
            };
         },
         template: {
            label: "Baixar modelo",
            description:
               "Inclui Nome, Tipo, Saldo Inicial, Código do Banco, Banco, Agência e Conta. Para tipos de conta fora do Caixa Físico, preencha Banco e Código do Banco.",
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
                              "Código do Banco": "341",
                              Banco: "Itaú",
                              Agência: "0001",
                              Conta: "12345-6",
                           },
                           {
                              Nome: "Reserva de Emergência",
                              Tipo: "Conta Poupança",
                              "Saldo Inicial": "2500.00",
                              "Código do Banco": "237",
                              Banco: "Bradesco",
                              Agência: "1203",
                              Conta: "98765-4",
                           },
                           {
                              Nome: "Caixa da Loja",
                              Tipo: "Caixa Físico",
                              "Saldo Inicial": "300.00",
                              "Código do Banco": "",
                              Banco: "",
                              Agência: "",
                              Conta: "",
                           },
                        ],
                        [
                           "Nome",
                           "Tipo",
                           "Saldo Inicial",
                           "Código do Banco",
                           "Banco",
                           "Agência",
                           "Conta",
                        ],
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
                              "Código do Banco": "341",
                              Banco: "Itaú",
                              Agência: "0001",
                              Conta: "12345-6",
                           },
                           {
                              Nome: "Reserva de Emergência",
                              Tipo: "Conta Poupança",
                              "Saldo Inicial": "2500.00",
                              "Código do Banco": "237",
                              Banco: "Bradesco",
                              Agência: "1203",
                              Conta: "98765-4",
                           },
                           {
                              Nome: "Caixa da Loja",
                              Tipo: "Caixa Físico",
                              "Saldo Inicial": "300.00",
                              "Código do Banco": "",
                              Banco: "",
                              Agência: "",
                              Conta: "",
                           },
                        ],
                        [
                           "Nome",
                           "Tipo",
                           "Saldo Inicial",
                           "Código do Banco",
                           "Banco",
                           "Agência",
                           "Conta",
                        ],
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

            if (!activeTeamId) {
               throw new Error("Time ativo não encontrado.");
            }

            const normalizedRows = rows
               .map((r, index) => {
                  const type = resolveType(r.type);
                  if (!type) return null;
                  const parsedBalance = parseImportBalance(r.initialBalance);
                  return {
                     line:
                        typeof r.importLine === "number" && r.importLine > 0
                           ? r.importLine
                           : index + 2,
                     r,
                     type,
                     bankCode: String(r.bankCode ?? "").trim(),
                     bankName: String(r.bankName ?? "").trim(),
                     branch: String(r.branch ?? "").trim(),
                     accountNumber: String(r.accountNumber ?? "").trim(),
                     parsedBalance,
                  };
               })
               .filter((entry): entry is NonNullable<typeof entry> =>
                  Boolean(entry),
               );

            const invalidBalances = normalizedRows.filter(
               (entry) => !entry.parsedBalance.isValid,
            );
            if (invalidBalances.length > 0) {
               const maxDetails = 3;
               const details = invalidBalances
                  .slice(0, maxDetails)
                  .map(
                     (entry) =>
                        `linha ${entry.line}: "${entry.parsedBalance.raw || "vazio"}"`,
                  )
                  .join(", ");
               const extraCount = invalidBalances.length - maxDetails;
               const extraText =
                  extraCount > 0 ? ` (mais ${extraCount} linha(s))` : "";
               throw new Error(
                  `Saldo Inicial inválido em ${invalidBalances.length} linha(s): ${details}${extraText}. Use somente números. Exemplo: 1500.00`,
               );
            }

            const invalidBankCode = normalizedRows.some((entry) => {
               if (entry.type === "cash") return false;
               return (
                  !entry.bankCode ||
                  !BANK_CODE_PATTERN.test(entry.bankCode) ||
                  !entry.bankName
               );
            });
            if (invalidBankCode) {
               throw new Error(
                  "Para tipos sem Caixa Físico, preencha Banco e Código do Banco (1 a 3 dígitos).",
               );
            }

            const importedRows: Array<{
               row: BankAccountsCollectionRow;
               input: {
                  name: string;
                  type:
                     | "checking"
                     | "savings"
                     | "investment"
                     | "payment"
                     | "cash";
                  color: string;
                  bankCode: string | null;
                  bankName: string | null;
                  branch: string | null;
                  accountNumber: string | null;
                  initialBalance: string;
               };
            }> = normalizedRows
               .map((entry) => {
                  const isCash = entry.type === "cash";
                  const input = {
                     name: String(entry.r.name ?? "").trim(),
                     type: entry.type,
                     color: "#6366f1",
                     bankCode: isCash ? null : entry.bankCode,
                     bankName: isCash ? null : entry.bankName,
                     branch: isCash ? null : entry.branch || null,
                     accountNumber: isCash ? null : entry.accountNumber || null,
                     initialBalance: entry.parsedBalance.normalized,
                  };
                  return {
                     input,
                     row: buildOptimisticBankAccountRow({
                        id: buildOptimisticBankAccountRowId(),
                        input,
                        teamId: activeTeamId,
                     }),
                  };
               })
               .filter((entry): entry is NonNullable<typeof entry> =>
                  Boolean(entry),
               );

            const bulkCreate = bulkCreateBankAccountsAction(
               bankAccountsCollection,
            );
            const transaction = bulkCreate({ rows: importedRows });
            const result = await Result.tryPromise({
               try: () => transaction.isPersisted.promise,
               catch: (error) => error,
            });
            if (Result.isError(result)) {
               throw new Error(
                  getErrorMessage(
                     result.error,
                     "Erro ao importar contas bancárias.",
                  ),
               );
            }
         },
      }),
      [
         activeTeamId,
         bankAccountsCollection,
         generateCsv,
         generateXlsx,
         parseCsv,
         parseXlsx,
      ],
   );

   const handleRenameAccount = useCallback(
      async (id: string, name: string) => {
         const update = updateBankAccountAction(bankAccountsCollection);
         const transaction = update({ id, patch: { name } });
         const result = await Result.tryPromise({
            try: () => transaction.isPersisted.promise,
            catch: (error) => error,
         });
         if (Result.isError(result)) {
            toast.error(
               getErrorMessage(
                  result.error,
                  "Erro ao atualizar conta bancária.",
               ),
            );
         }
      },
      [bankAccountsCollection],
   );

   const handleUpdateAccount = useCallback(
      async (id: string, patch: Record<string, unknown>) => {
         const update = updateBankAccountAction(bankAccountsCollection);
         const transaction = update({
            id,
            patch: getBankAccountRowPatch(patch),
         });
         const result = await Result.tryPromise({
            try: () => transaction.isPersisted.promise,
            catch: (error) => error,
         });
         if (Result.isError(result)) {
            toast.error(
               getErrorMessage(
                  result.error,
                  "Erro ao atualizar conta bancária.",
               ),
            );
         }
      },
      [bankAccountsCollection],
   );

   const handleOpenCreate = useCallback(() => {
      if (!activeTeamId) {
         toast.error("Time ativo não encontrado.");
         return;
      }
      openSheet({
         renderChildren: () => (
            <BankAccountFormSheet
               collection={bankAccountsCollection}
               teamId={activeTeamId}
            />
         ),
      });
   }, [activeTeamId, bankAccountsCollection, openSheet]);

   const handleDelete = useCallback(
      (account: BankAccountRow) => {
         const deleteBankAccount = deleteBankAccountAction(
            bankAccountsCollection,
         );
         openAlertDialog({
            title: "Excluir conta",
            description: `Tem certeza que deseja excluir a conta "${account.name}"? Esta ação não pode ser desfeita.`,
            actionLabel: "Excluir",
            cancelLabel: "Cancelar",
            variant: "destructive",
            onAction: async () => {
               const transaction = deleteBankAccount({ id: account.id });
               const result = await Result.tryPromise({
                  try: () => transaction.isPersisted.promise,
                  catch: (error) => error,
               });
               if (Result.isError(result)) {
                  toast.error(
                     getErrorMessage(
                        result.error,
                        "Erro ao excluir conta bancária.",
                     ),
                  );
                  return;
               }
               toast.success("Conta excluída com sucesso.");
            },
         });
      },
      [bankAccountsCollection, openAlertDialog],
   );

   const columns = useMemo<ColumnDef<BankAccountRow>[]>(() => {
      const base = buildBankAccountColumns({
         logoDevToken: publicEnv?.LOGO_DEV_TOKEN,
         onRenameAccount: handleRenameAccount,
         onUpdateAccount: handleUpdateAccount,
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
      handleUpdateAccount,
      publicEnv?.LOGO_DEV_TOKEN,
      slug,
      teamSlug,
   ]);

   const urlState = useTableUrlState({
      search: { sorting, columnFilters, page, pageSize },
      onUpdate: (next) =>
         navigate({
            search: (prev) => ({ ...prev, ...next }),
            replace: true,
         }),
      totalRows: bankAccounts.all.length,
   });

   const table = useReactTable({
      data: bankAccounts.rows,
      columns,
      getRowId: (row) => row.id,
      rowCount: bankAccounts.all.length,
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
      getCoreRowModel: getCoreRowModel(),
   });

   const importApi = useDataImport({
      table,
      config: importConfig,
   });

   const selectedRows = table.getSelectedRowModel().rows;
   const selectedIds = selectedRows.map((r) => r.original.id);

   useTableBulkActions({
      selectedCount: selectedRows.length,
      onClear: () => table.resetRowSelection(),
      children: (
         <SelectionActionButton
            icon={<Trash2 className="size-4" />}
            onClick={() => {
               openAlertDialog({
                  title: `Excluir ${selectedIds.length} ${selectedIds.length === 1 ? "conta" : "contas"}`,
                  description:
                     "Tem certeza que deseja excluir as contas selecionadas? Esta ação não pode ser desfeita.",
                  actionLabel: "Excluir",
                  cancelLabel: "Cancelar",
                  variant: "destructive",
                  onAction: async () => {
                     const bulkDelete = bulkDeleteBankAccountsAction(
                        bankAccountsCollection,
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
                              "Erro ao excluir contas bancárias.",
                           ),
                        );
                        return;
                     }

                     table.resetRowSelection();
                     toast.success(
                        `${selectedIds.length} ${selectedIds.length === 1 ? "conta excluída" : "contas excluídas"} com sucesso.`,
                     );
                  },
               });
            }}
            variant="destructive"
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
                  aria-label="Buscar conta por nome..."
                  onChange={(e) => searchInput.onChange(e.target.value)}
                  placeholder="Buscar conta por nome..."
                  value={searchInput.value}
               />
               <div className="flex flex-wrap items-center gap-2">
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
                  <DataTableColumnVisibility table={table} />
                  <ExportButton table={table} fileBase="contas-bancarias" />
                  <DataImportButton api={importApi} config={importConfig} />
                  <Button
                     onClick={handleOpenCreate}
                     size="icon-sm"
                     tooltip="Nova Conta"
                     variant="outline"
                  >
                     <Plus />
                     <span className="sr-only">Nova Conta</span>
                  </Button>
               </div>
            </div>
            <ScrollArea className="flex-1 min-h-0 rounded-md border bg-card">
               <Table>
                  <DataTableHeader table={table} />
                  <DataTableBody<BankAccountRow> table={table} />
                  <DataImportSection
                     api={importApi}
                     config={importConfig}
                     table={table}
                  />
               </Table>
               {table.getRowCount() === 0 && (
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
               )}
            </ScrollArea>
            {bankAccounts.all.length > 0 && (
               <DataTablePagination table={table} />
            )}
         </div>
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
