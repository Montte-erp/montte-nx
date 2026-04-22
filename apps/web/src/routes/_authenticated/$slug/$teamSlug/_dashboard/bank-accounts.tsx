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
import dayjs from "dayjs";
import { Landmark, Plus, Trash2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { QueryBoundary } from "@/components/query-boundary";
import { DefaultHeader } from "@/components/default-header";
import { DataTableContent } from "@/components/data-table/data-table-content";
import { DataTableEmptyState } from "@/components/data-table/data-table-empty-state";
import {
   DataTableExternalFilter,
   DataTableRoot,
} from "@/components/data-table/data-table-root";
import { DataTableSkeleton } from "@/components/data-table/data-table-skeleton";
import { DataTableToolbar } from "@/components/data-table/data-table-toolbar";
import {
   DataTableImportButton,
   type DataTableImportConfig,
} from "@/components/data-table/data-table-import";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useCsvFile } from "@/hooks/use-csv-file";
import { useXlsxFile } from "@/hooks/use-xlsx-file";
import { orpc } from "@/integrations/orpc/client";
import {
   buildBankAccountColumns,
   type BankAccountRow,
} from "./-bank-accounts/bank-accounts-columns";

const VALID_TYPES = [
   "checking",
   "savings",
   "investment",
   "payment",
   "cash",
] as const;

function resolveType(raw: unknown): BankAccountRow["type"] {
   const str = String(raw ?? "");
   if ((VALID_TYPES as readonly string[]).includes(str))
      return str as BankAccountRow["type"];
   return "checking";
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
   typeFilter: z
      .enum(["all", "checking", "savings", "investment", "payment", "cash"])
      .catch("all")
      .default("all"),
});

const skeletonColumns = buildBankAccountColumns();

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/bank-accounts",
)({
   validateSearch: searchSchema,
   loader: ({ context }) => {
      context.queryClient.prefetchQuery(
         orpc.bankAccounts.getAll.queryOptions({}),
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
   const { sorting, columnFilters, typeFilter } = Route.useSearch();
   const { openAlertDialog } = useAlertDialog();
   const { parse: parseCsv } = useCsvFile();
   const { parse: parseXlsx } = useXlsxFile();

   const { data: bankAccounts } = useSuspenseQuery(
      orpc.bankAccounts.getAll.queryOptions({}),
   );

   const createMutation = useMutation(
      orpc.bankAccounts.create.mutationOptions({
         onSuccess: () => toast.success("Conta criada com sucesso."),
         onError: (e) => toast.error(e.message),
      }),
   );

   const bulkCreateMutation = useMutation(
      orpc.bankAccounts.bulkCreate.mutationOptions({
         onError: (e) => toast.error(e.message),
      }),
   );

   const deleteMutation = useMutation(
      orpc.bankAccounts.remove.mutationOptions({
         onSuccess: () => toast.success("Conta excluída com sucesso."),
         onError: (e) => toast.error(e.message),
      }),
   );

   const [isDraftActive, setIsDraftActive] = useState(false);

   const handleDiscardDraft = useCallback(() => setIsDraftActive(false), []);

   const handleAddAccount = useCallback(
      async (data: Record<string, string | string[]>) => {
         const name = String(data.name ?? "").trim();
         const type = resolveType(data.type);
         if (!name || !type) return;
         await createMutation.mutateAsync({
            name,
            type,
            color: "#6366f1",
            initialBalance: "0",
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
         mapRow: (row, i) => ({
            id: `__import_${i}`,
            teamId: "",
            name: String(row.name ?? "").trim(),
            type: resolveType(row.type),
            color: "#6366f1",
            iconUrl: null,
            initialBalance: String(row.initialBalance ?? "0"),
            currentBalance: "0",
            projectedBalance: "0",
            createdAt: dayjs().toISOString(),
            updatedAt: dayjs().toISOString(),
         }),
         onImport: async (rows) => {
            await bulkCreateMutation.mutateAsync({
               accounts: rows.map((r) => ({
                  name: String(r.name ?? "").trim(),
                  type: resolveType(r.type),
                  color: "#6366f1",
                  initialBalance: String(r.initialBalance ?? "0"),
               })),
            });
         },
      }),
      [bulkCreateMutation, parseCsv, parseXlsx],
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

   const filtered = useMemo(() => {
      if (typeFilter === "all") return bankAccounts as BankAccountRow[];
      return (bankAccounts as BankAccountRow[]).filter(
         (a) => a.type === typeFilter,
      );
   }, [bankAccounts, typeFilter]);

   const columns = useMemo(() => buildBankAccountColumns(), []);

   return (
      <DataTableRoot
         columns={columns}
         data={filtered}
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
               typeof updater === "function" ? updater(columnFilters) : updater;
            navigate({
               search: (prev) => ({ ...prev, columnFilters: next }),
               replace: true,
            });
         }}
         isDraftRowActive={isDraftActive}
         onAddRow={handleAddAccount}
         onDiscardAddRow={handleDiscardDraft}
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
         {(
            ["checking", "savings", "investment", "payment", "cash"] as const
         ).map((key) => (
            <DataTableExternalFilter
               key={key}
               id={`type:${key}`}
               label={
                  {
                     checking: "Conta Corrente",
                     savings: "Conta Poupança",
                     investment: "Conta Investimento",
                     payment: "Conta Pagamento",
                     cash: "Caixa Físico",
                  }[key]
               }
               group="Tipo"
               active={typeFilter === key}
               onToggle={(active) =>
                  navigate({
                     search: (prev) => ({
                        ...prev,
                        typeFilter: active ? key : "all",
                     }),
                     replace: true,
                  })
               }
            />
         ))}
         <DataTableToolbar>
            <DataTableImportButton importConfig={importConfig} />
            <Button
               onClick={() => setIsDraftActive(true)}
               size="icon-sm"
               tooltip="Nova Conta"
               variant="outline"
            >
               <Plus />
            </Button>
         </DataTableToolbar>
         <DataTableContent />
         <DataTableEmptyState>
            <Empty>
               <EmptyMedia>
                  <Landmark className="size-10" />
               </EmptyMedia>
               <EmptyHeader>
                  <EmptyTitle>Nenhuma conta bancária</EmptyTitle>
                  <EmptyDescription>
                     Adicione uma conta para começar a gerenciar suas finanças.
                  </EmptyDescription>
               </EmptyHeader>
            </Empty>
         </DataTableEmptyState>
      </DataTableRoot>
   );
}

function BankAccountsPage() {
   return (
      <main className="flex flex-col gap-4">
         <DefaultHeader
            description="Gerencie suas contas bancárias"
            title="Contas Bancárias"
         />
         <QueryBoundary
            fallback={<BankAccountsSkeleton />}
            errorTitle="Erro ao carregar contas"
         >
            <BankAccountsList />
         </QueryBoundary>
      </main>
   );
}
