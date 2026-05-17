import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { KeyRound, Plus, Trash2 } from "lucide-react";
import { useCallback, useMemo } from "react";
import { toast } from "@packages/ui/hooks/use-toast";
import { z } from "zod";
import {
   getCoreRowModel,
   getFilteredRowModel,
   getSortedRowModel,
   useReactTable,
   type ColumnDef,
   type ColumnFiltersState,
   type SortingState,
   type VisibilityState,
} from "@tanstack/react-table";
import { createLocalStorageState } from "foxact/create-local-storage-state";
import { err, fromPromise, ok } from "neverthrow";
import {
   Empty,
   EmptyDescription,
   EmptyHeader,
   EmptyMedia,
   EmptyTitle,
} from "@packages/ui/components/empty";
import { Button } from "@packages/ui/components/button";
import { ScrollArea } from "@packages/ui/components/scroll-area";
import { Table } from "@packages/ui/components/table";
import { authClient } from "@/integrations/better-auth/auth-client";
import { orpc } from "@/integrations/orpc/client";
import type { Outputs } from "@/integrations/orpc/client";
import { QueryBoundary } from "@/components/query-boundary";
import { DataTableBody } from "@/blocks/data-table/data-table-body";
import { DataTableColumnVisibility } from "@/blocks/data-table/data-table-column-visibility";
import { DataTableHeader } from "@/blocks/data-table/data-table-header";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useCredenza } from "@/hooks/use-credenza";
import { DefaultHeader } from "../../../-layout/default-header";
import { buildApiKeysColumns } from "./-api-keys/api-keys-columns";
import { CreateApiKeyForm } from "./-api-keys/create-api-key-form";

type DataTableStoredState = {
   sorting: SortingState;
   columnFilters: ColumnFiltersState;
   columnVisibility: VisibilityState;
};

const EMPTY_API_KEYS_TABLE_STATE: DataTableStoredState = {
   sorting: [],
   columnFilters: [],
   columnVisibility: {},
};

const [useApiKeysTableStorage] =
   createLocalStorageState<DataTableStoredState | null>(
      "montte:datatable:api-keys",
      null,
   );

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/settings/project/api-keys",
)({
   validateSearch: z.object({
      sorting: z
         .array(z.object({ id: z.string(), desc: z.boolean() }))
         .catch([])
         .default([]),
      columnFilters: z
         .array(z.object({ id: z.string(), value: z.unknown() }))
         .catch([])
         .default([]),
   }),
   head: () => ({
      meta: [{ title: "Chaves de API — Montte" }],
   }),
   component: ApiKeysPage,
});

function ApiKeysSkeleton() {
   return (
      <div className="flex flex-col gap-4">
         <div className="h-8 w-48 animate-pulse rounded bg-muted" />
         <div className="h-24 animate-pulse rounded bg-muted" />
      </div>
   );
}

type ApiKeyRow = Outputs["apiKeys"]["list"][number];

function ApiKeysContent() {
   const { sorting, columnFilters } = Route.useSearch();
   const navigate = Route.useNavigate();
   const [storedTableState, setStoredTableState] = useApiKeysTableStorage();
   const { data: session } = authClient.useSession();
   const queryClient = useQueryClient();
   const { openCredenza, closeCredenza } = useCredenza();
   const { openAlertDialog } = useAlertDialog();

   const { data: keys } = useSuspenseQuery(orpc.apiKeys.list.queryOptions());

   const organizationId = session?.session.activeOrganizationId ?? "";
   const teamId = session?.session.activeTeamId ?? "";

   const handleRevoke = useCallback(
      (keyId: string, keyName: string) => {
         openAlertDialog({
            title: "Revogar chave de API",
            description: `Tem certeza que deseja revogar a chave "${keyName}"? Esta ação não pode ser desfeita.`,
            actionLabel: "Revogar",
            cancelLabel: "Cancelar",
            variant: "destructive",
            onAction: async () => {
               const result = await fromPromise(
                  authClient.apiKey.delete({ keyId }),
                  () => new Error("Erro ao revogar chave"),
               ).andThen((response) =>
                  response.error ? err(response.error) : ok(response.data),
               );
               if (result.isErr()) {
                  toast.error("Erro ao revogar chave");
                  return;
               }
               await queryClient.invalidateQueries(
                  orpc.apiKeys.list.queryOptions(),
               );
               toast.success("Chave revogada");
            },
         });
      },
      [openAlertDialog, queryClient],
   );

   const handleOpenCreate = useCallback(() => {
      if (!organizationId || !teamId) return;
      openCredenza({
         renderChildren: () => (
            <CreateApiKeyForm
               organizationId={organizationId}
               teamId={teamId}
               onSuccess={closeCredenza}
            />
         ),
      });
   }, [closeCredenza, openCredenza, organizationId, teamId]);

   const columns = useMemo<ColumnDef<ApiKeyRow>[]>(() => {
      const actionsColumn: ColumnDef<ApiKeyRow> = {
         id: "__actions",
         header: "",
         enableHiding: false,
         enableSorting: false,
         meta: {
            label: "Ações",
            align: "right",
            exportable: false,
            reorderable: false,
            resizable: false,
         },
         cell: ({ row }) => (
            <Button
               className="text-destructive hover:text-destructive"
               onClick={() =>
                  handleRevoke(row.original.id, row.original.name ?? "Sem nome")
               }
               size="icon-sm"
               tooltip="Revogar"
               variant="outline"
            >
               <Trash2 className="size-4" />
               <span className="sr-only">Revogar</span>
            </Button>
         ),
      };
      return [...buildApiKeysColumns(), actionsColumn];
   }, [handleRevoke]);

   const tableSorting =
      sorting.length > 0 ? sorting : (storedTableState?.sorting ?? []);
   const tableColumnFilters =
      columnFilters.length > 0
         ? columnFilters
         : (storedTableState?.columnFilters ?? []);
   const columnVisibility = storedTableState?.columnVisibility ?? {};

   const table = useReactTable({
      data: keys,
      columns,
      getRowId: (row) => row.id,
      columnResizeMode: "onChange",
      defaultColumn: { minSize: 80, size: 160, maxSize: 600 },
      state: {
         sorting: tableSorting,
         columnFilters: tableColumnFilters,
         columnVisibility,
      },
      onSortingChange: (updater) => {
         const next =
            typeof updater === "function" ? updater(tableSorting) : updater;
         setStoredTableState((prev) => ({
            ...(prev ?? EMPTY_API_KEYS_TABLE_STATE),
            sorting: next,
         }));
         navigate({
            search: (prev) => ({
               ...prev,
               sorting: next,
            }),
            replace: true,
         });
      },
      onColumnFiltersChange: (updater) => {
         const next =
            typeof updater === "function"
               ? updater(tableColumnFilters)
               : updater;
         setStoredTableState((prev) => ({
            ...(prev ?? EMPTY_API_KEYS_TABLE_STATE),
            columnFilters: next,
         }));
         navigate({
            search: (prev) => ({
               ...prev,
               columnFilters: next,
            }),
            replace: true,
         });
      },
      onColumnVisibilityChange: (updater) => {
         const next =
            typeof updater === "function" ? updater(columnVisibility) : updater;
         setStoredTableState((prev) => ({
            ...(prev ?? EMPTY_API_KEYS_TABLE_STATE),
            columnVisibility: next,
         }));
      },
      getCoreRowModel: getCoreRowModel(),
      getSortedRowModel: getSortedRowModel(),
      getFilteredRowModel: getFilteredRowModel(),
   });

   return (
      <div className="flex flex-col gap-4">
         <DefaultHeader
            actions={
               <Button
                  onClick={handleOpenCreate}
                  disabled={!organizationId || !teamId}
               >
                  <Plus className="size-4" />
                  Nova chave
               </Button>
            }
            description="Use estas chaves para autenticar webhooks neste espaço."
            title="Chaves de API"
         />

         {keys.length === 0 ? (
            <Empty>
               <EmptyHeader>
                  <EmptyMedia variant="icon">
                     <KeyRound />
                  </EmptyMedia>
                  <EmptyTitle>Nenhuma chave de API</EmptyTitle>
                  <EmptyDescription>
                     Crie uma chave para integrar o SDK HyprPay.
                  </EmptyDescription>
               </EmptyHeader>
            </Empty>
         ) : (
            <div className="flex flex-col gap-4">
               <div className="flex justify-end">
                  <DataTableColumnVisibility table={table} />
               </div>
               <ScrollArea className="rounded-md border bg-card">
                  <Table>
                     <DataTableHeader table={table} />
                     <DataTableBody<ApiKeyRow> table={table} />
                  </Table>
               </ScrollArea>
            </div>
         )}
      </div>
   );
}

function ApiKeysPage() {
   return (
      <QueryBoundary
         fallback={<ApiKeysSkeleton />}
         errorTitle="Erro ao carregar chaves de API"
      >
         <ApiKeysContent />
      </QueryBoundary>
   );
}
