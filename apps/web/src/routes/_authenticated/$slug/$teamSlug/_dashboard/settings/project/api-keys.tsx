import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { createLocalStorageState } from "foxact/create-local-storage-state";
import { KeyRound, Plus, Trash2 } from "lucide-react";
import { useMemo } from "react";
import { toast } from "sonner";
import { z } from "zod";
import type { DataTableStoredState } from "@/features/data-view/data-table";
import { DataTable } from "@/features/data-view/data-table";
import {
   Empty,
   EmptyDescription,
   EmptyHeader,
   EmptyMedia,
   EmptyTitle,
} from "@packages/ui/components/empty";
import { Button } from "@packages/ui/components/button";
import { authClient } from "@/integrations/better-auth/auth-client";
import { orpc } from "@/integrations/orpc/client";
import { QueryBoundary } from "@/components/query-boundary";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useCredenza } from "@/hooks/use-credenza";
import { buildApiKeysColumns } from "./-api-keys/api-keys-columns";
import { CreateApiKeyForm } from "./-api-keys/create-api-key-form";

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

const [useTableState] = createLocalStorageState<DataTableStoredState | null>(
   "montte:datatable:api-keys",
   null,
);

function ApiKeysSkeleton() {
   return (
      <div className="flex flex-col gap-4">
         <div className="h-8 w-48 animate-pulse rounded bg-muted" />
         <div className="h-24 animate-pulse rounded bg-muted" />
      </div>
   );
}

function ApiKeysContent() {
   const { sorting, columnFilters } = Route.useSearch();
   const navigate = Route.useNavigate();
   const { data: session } = authClient.useSession();
   const queryClient = useQueryClient();
   const { openCredenza, closeCredenza } = useCredenza();
   const { openAlertDialog } = useAlertDialog();
   const [tableState, setTableState] = useTableState();

   const { data: keys } = useSuspenseQuery(orpc.apiKeys.list.queryOptions());

   const organizationId = session?.session.activeOrganizationId ?? "";
   const teamId = session?.session.activeTeamId ?? "";

   function handleRevoke(keyId: string, keyName: string) {
      openAlertDialog({
         title: "Revogar chave de API",
         description: `Tem certeza que deseja revogar a chave "${keyName}"? Esta ação não pode ser desfeita.`,
         actionLabel: "Revogar",
         cancelLabel: "Cancelar",
         variant: "destructive",
         onAction: async () => {
            const result = await authClient.apiKey.delete({ keyId });
            if (result.error) {
               toast.error("Erro ao revogar chave");
               return;
            }
            await queryClient.invalidateQueries(
               orpc.apiKeys.list.queryOptions(),
            );
            toast.success("Chave revogada");
         },
      });
   }

   function handleOpenCreate() {
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
   }

   const columns = useMemo(() => buildApiKeysColumns(), []);

   return (
      <div className="flex flex-col gap-4">
         <div className="flex items-center justify-between">
            <div>
               <h1 className="font-serif text-2xl font-semibold">
                  Chaves de API
               </h1>
               <p className="mt-1 text-sm text-muted-foreground">
                  Use estas chaves para autenticar o SDK{" "}
                  <code className="font-mono text-xs">@montte/hyprpay</code>{" "}
                  neste espaço.
               </p>
            </div>
            <Button
               onClick={handleOpenCreate}
               disabled={!organizationId || !teamId}
            >
               <Plus className="size-4" />
               Nova chave
            </Button>
         </div>

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
            <DataTable
               data={keys}
               columns={columns}
               getRowId={(row) => row.id}
               sorting={sorting}
               onSortingChange={(updater) => {
                  const next =
                     typeof updater === "function" ? updater(sorting) : updater;
                  navigate({
                     search: (prev: typeof Route.types.fullSearchSchema) => ({
                        ...prev,
                        sorting: next,
                     }),
                  });
               }}
               columnFilters={columnFilters}
               onColumnFiltersChange={(updater) => {
                  const next =
                     typeof updater === "function"
                        ? updater(columnFilters)
                        : updater;
                  navigate({
                     search: (prev: typeof Route.types.fullSearchSchema) => ({
                        ...prev,
                        columnFilters: next,
                     }),
                  });
               }}
               tableState={tableState}
               onTableStateChange={setTableState}
               renderActions={({ row }) => (
                  <Button
                     className="text-destructive hover:text-destructive"
                     onClick={() =>
                        handleRevoke(
                           row.original.id,
                           row.original.name ?? "Sem nome",
                        )
                     }
                     tooltip="Revogar"
                     variant="outline"
                  >
                     <Trash2 className="size-4" />
                  </Button>
               )}
            />
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
