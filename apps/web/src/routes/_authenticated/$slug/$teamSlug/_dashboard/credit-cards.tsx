import { Button } from "@packages/ui/components/button";
import {
   Empty,
   EmptyDescription,
   EmptyHeader,
   EmptyMedia,
   EmptyTitle,
} from "@packages/ui/components/empty";
import { useMutation, useSuspenseQueries } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { CreditCard, Plus, Trash2 } from "lucide-react";
import { useCallback, useMemo } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { DefaultHeader } from "../-layout/default-header";
import { QueryBoundary } from "@/components/query-boundary";
import { useSheet } from "@/hooks/use-sheet";
import { CreditCardFormSheet } from "./-credit-cards/credit-card-form-sheet";
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
      .union([z.enum(["active", "blocked", "cancelled"]), z.undefined()])
      .catch(undefined),
   page: z.number().int().min(1).catch(1).default(1),
   pageSize: z.number().int().catch(20).default(20),
});

const skeletonColumns = buildCreditCardColumns();

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
      .replace(/[\u0300-\u036f]/g, "");
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
      .slice(0, 4);
   return digits.length === 4 ? digits : null;
}

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
   const { openSheet } = useSheet();
   const { publicEnv } = Route.useRouteContext();
   const { parse: parseCsv, generate: generateCsv } = useCsvFile();
   const { parse: parseXlsx, generate: generateXlsx } = useXlsxFile();

   const [{ data: result }, { data: bankAccounts }] = useSuspenseQueries({
      queries: [
         orpc.creditCards.getAll.queryOptions({
            input: { page, pageSize, search: search || undefined, status },
         }),
         orpc.bankAccounts.getAll.queryOptions({}),
      ],
   });

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

   const bulkCreateMutation = useMutation(
      orpc.creditCards.bulkCreate.mutationOptions({
         onError: (e) => toast.error(e.message),
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

   const handleOpenCreate = useCallback(() => {
      openSheet({ renderChildren: () => <CreditCardFormSheet /> });
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
         importColumns: [{ key: "last4", label: "Final" }],
         mapRow: (row, i): Record<string, unknown> => ({
            id: `__import_${i}`,
            name: String(row.name ?? "").trim(),
            brand: parseCreditCardBrand(row.brand),
            last4: normalizeLast4(row.last4 ?? row.final),
            color: "#6366f1",
            creditLimit: String(row.creditLimit ?? row.limite ?? "0"),
            closingDay: parseImportDay(row.closingDay ?? row.fechamento, 1),
            dueDay: parseImportDay(row.dueDay ?? row.vencimento, 1),
            bankAccountId: resolveBankAccountId(
               bankAccounts ?? [],
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
                              "Conta Bancária": bankAccounts?.[0]?.name ?? "",
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
                              "Conta Bancária": bankAccounts?.[0]?.name ?? "",
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
            const firstBankAccountId = bankAccounts?.[0]?.id;
            if (!firstBankAccountId) {
               toast.error(
                  "Nenhuma conta bancária disponível para importação.",
               );
               return;
            }
            await bulkCreateMutation.mutateAsync({
               cards: rows.map((r) => ({
                  name: String(r.name ?? ""),
                  closingDay:
                     typeof r.closingDay === "number" ? r.closingDay : 1,
                  dueDay: typeof r.dueDay === "number" ? r.dueDay : 1,
                  bankAccountId:
                     resolveBankAccountId(
                        bankAccounts ?? [],
                        r.bankAccountId,
                     ) ?? firstBankAccountId,
                  color: "#6366f1",
                  creditLimit: String(r.creditLimit ?? "0"),
                  last4: normalizeLast4(r.last4),
                  brand: parseCreditCardBrand(r.brand),
                  status: parseCreditCardStatus(r.status),
               })),
            });
         },
      }),
      [
         bulkCreateMutation,
         generateCsv,
         generateXlsx,
         parseCsv,
         parseXlsx,
         bankAccounts,
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
               await deleteMutation.mutateAsync({ id: card.id });
            },
         });
      },
      [openAlertDialog, deleteMutation],
   );

   const columns = useMemo(
      () =>
         buildCreditCardColumns({
            bankAccounts: (bankAccounts ?? []).map((b) => ({
               id: b.id,
               name: b.name,
               bankName: b.bankName,
               bankCode: b.bankCode,
               color: b.color,
            })),
            logoDevToken: publicEnv?.LOGO_DEV_TOKEN,
         }),
      [bankAccounts, publicEnv?.LOGO_DEV_TOKEN],
   );

   return (
      <div className="flex flex-1 flex-col gap-4 min-h-0">
         <DataTableRoot
            columns={columns}
            data={result.data}
            exportDateFormat="DD-MM-YYYY"
            exportFileBase="cartoes-de-credito"
            getRowId={(row) => row.id}
            storageKey="montte:datatable:credit-cards"
            columnFilters={columnFilters}
            onColumnFiltersChange={(updater) => {
               const next =
                  typeof updater === "function"
                     ? updater(columnFilters)
                     : updater;
               const statusFilter = next.find((f) => f.id === "status");
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
            }}
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
                  onClick={handleOpenCreate}
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
                        Adicione um cartão de crédito para controlar seus
                        gastos.
                     </EmptyDescription>
                  </EmptyHeader>
               </Empty>
            </DataTableEmptyState>
            <DataTableContent className="flex-1 overflow-auto min-h-0" />
            <DataTableBulkActions<CreditCardRow>>
               {({ selectedRows, clearSelection }) => (
                  <SelectionActionButton
                     icon={<Trash2 className="size-4" />}
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
      </div>
   );
}

function CreditCardsPage() {
   return (
      <main className="flex h-full flex-col gap-4">
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
