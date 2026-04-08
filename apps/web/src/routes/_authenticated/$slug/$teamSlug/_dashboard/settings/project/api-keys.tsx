import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { createLocalStorageState } from "foxact/create-local-storage-state";
import { KeyRound, Plus } from "lucide-react";
import { Suspense, useCallback, useMemo, useTransition } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { toast } from "sonner";
import { z } from "zod";
import type { DataTableStoredState } from "@packages/ui/components/data-table";
import { DataTable } from "@packages/ui/components/data-table";
import {
   Empty,
   EmptyDescription,
   EmptyHeader,
   EmptyMedia,
   EmptyTitle,
} from "@packages/ui/components/empty";
import { createErrorFallback } from "@packages/ui/components/error-fallback";
import { Button } from "@packages/ui/components/button";
import { authClient } from "@/integrations/better-auth/auth-client";
import { orpc } from "@/integrations/orpc/client";
import { useCredenza } from "@/hooks/use-credenza";
import { buildApiKeysColumns } from "./-api-keys/api-keys-columns";
import { CreateApiKeyForm } from "./-api-keys/create-api-key-form";

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/settings/project/api-keys",
)({
   validateSearch: z.object({
      sorting: z
         .array(z.object({ id: z.string(), desc: z.boolean() }))
         .optional()
         .default([]),
      columnFilters: z
         .array(z.object({ id: z.string(), value: z.unknown() }))
         .optional()
         .default([]),
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
   const [isPending, startTransition] = useTransition();
   const [tableState, setTableState] = useTableState();

   const { data: keys } = useSuspenseQuery(orpc.apiKeys.list.queryOptions());

   const organizationId = session?.session.activeOrganizationId ?? "";
   const teamId = session?.session.activeTeamId ?? "";

   const handleRevoke = useCallback(
      (keyId: string) => {
         startTransition(async () => {
            const result = await authClient.apiKey.delete({ keyId });
            if (result.error) {
               toast.error("Erro ao revogar chave");
               return;
            }
            await queryClient.invalidateQueries(
               orpc.apiKeys.list.queryOptions(),
            );
            toast.success("Chave revogada");
         });
      },
      [queryClient],
   );

   function handleOpenCreate() {
      if (!organizationId || !teamId) return;
      openCredenza({
         children: (
            <CreateApiKeyForm
               organizationId={organizationId}
               teamId={teamId}
               onSuccess={closeCredenza}
            />
         ),
      });
   }

   const columns = useMemo(
      () => buildApiKeysColumns(handleRevoke, isPending),
      [handleRevoke, isPending],
   );

   return (
      <div className="flex flex-col gap-4">
         <div className="flex items-center justify-between">
            <div>
               <h2 className="text-lg font-semibold">
                  Chaves de API — HyprPay
               </h2>
               <p className="text-sm text-muted-foreground">
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
            />
         )}
      </div>
   );
}

function ApiKeysPage() {
   return (
      <ErrorBoundary
         FallbackComponent={createErrorFallback({
            errorTitle: "Erro ao carregar chaves de API",
         })}
      >
         <Suspense fallback={<ApiKeysSkeleton />}>
            <ApiKeysContent />
         </Suspense>
      </ErrorBoundary>
   );
}
