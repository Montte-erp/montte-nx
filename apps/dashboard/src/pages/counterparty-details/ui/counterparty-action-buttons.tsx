import { Alert, AlertDescription } from "@packages/ui/components/alert";
import { Button } from "@packages/ui/components/button";
import { Skeleton } from "@packages/ui/components/skeleton";
import {
   useMutation,
   useQueryClient,
   useSuspenseQuery,
} from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { CheckCircle2, Edit, Receipt, Trash2, XCircle } from "lucide-react";
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { toast } from "sonner";
import { useActiveOrganization } from "@/hooks/use-active-organization";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useSheet } from "@/hooks/use-sheet";
import { useTRPC } from "@/integrations/clients";
import { ManageCounterpartyForm } from "../../counterparties/features/manage-counterparty-form";

function ActionButtonsErrorFallback() {
   return (
      <Alert variant="destructive">
         <AlertDescription>Falha ao carregar ações</AlertDescription>
      </Alert>
   );
}

function ActionButtonsSkeleton() {
   return (
      <div className="flex flex-wrap items-center gap-2">
         <Skeleton className="h-9 w-32" />
         <Skeleton className="h-9 w-24" />
         <Skeleton className="h-9 w-24" />
         <Skeleton className="h-9 w-24" />
      </div>
   );
}

function ActionButtonsContent({
   counterpartyId,
   onDeleteSuccess,
}: {
   counterpartyId: string;
   onDeleteSuccess: () => void;
}) {
   const trpc = useTRPC();
   const queryClient = useQueryClient();
   const { openSheet } = useSheet();
   const { openAlertDialog } = useAlertDialog();
   const router = useRouter();
   const { activeOrganization } = useActiveOrganization();

   const { data: counterparty } = useSuspenseQuery(
      trpc.counterparties.getById.queryOptions({ id: counterpartyId }),
   );

   const deleteMutation = useMutation(
      trpc.counterparties.delete.mutationOptions({
         onError: () => {
            toast.error("Erro ao excluir parceiro");
         },
         onSuccess: () => {
            toast.success("Parceiro excluído com sucesso");
            onDeleteSuccess();
         },
      }),
   );

   const toggleActiveMutation = useMutation(
      trpc.counterparties.toggleActive.mutationOptions({
         onError: () => {
            toast.error("Erro ao atualizar status");
         },
         onSuccess: (data) => {
            if (data) {
               toast.success(
                  data.isActive
                     ? "Parceiro ativado com sucesso"
                     : "Parceiro inativado com sucesso",
               );
            }
            queryClient.invalidateQueries({
               queryKey: trpc.counterparties.getById.queryKey({
                  id: counterpartyId,
               }),
            });
         },
      }),
   );

   if (!counterparty) {
      return null;
   }

   const handleDelete = () => {
      openAlertDialog({
         actionLabel: "Excluir",
         cancelLabel: "Cancelar",
         description:
            "Tem certeza que deseja excluir este parceiro comercial? Esta acao nao pode ser desfeita.",
         onAction: async () => {
            await deleteMutation.mutateAsync({ id: counterpartyId });
         },
         title: "Excluir parceiro comercial",
         variant: "destructive",
      });
   };

   const handleToggleActive = () => {
      toggleActiveMutation.mutate({ id: counterpartyId });
   };

   const handleCreateBill = () => {
      router.navigate({
         params: { slug: activeOrganization.slug },
         to: "/$slug/bills",
         search: {
            action: "create",
            counterpartyId: counterpartyId,
            type: counterparty.type === "client" ? "receivable" : "payable",
         },
      });
   };

   return (
      <div className="flex flex-wrap items-center gap-2">
         <Button onClick={handleCreateBill} size="sm" variant="default">
            <Receipt className="size-4" />
            Criar Conta
         </Button>

         <Button
            onClick={() =>
               openSheet({
                  children: (
                     <ManageCounterpartyForm counterparty={counterparty} />
                  ),
               })
            }
            size="sm"
            variant="outline"
         >
            <Edit className="size-4" />
            Editar
         </Button>

         <Button
            disabled={toggleActiveMutation.isPending}
            onClick={handleToggleActive}
            size="sm"
            variant="outline"
         >
            {counterparty.isActive ? (
               <>
                  <XCircle className="size-4" />
                  Desativar
               </>
            ) : (
               <>
                  <CheckCircle2 className="size-4" />
                  Ativar
               </>
            )}
         </Button>

         <Button
            className="text-destructive hover:text-destructive"
            disabled={deleteMutation.isPending}
            onClick={handleDelete}
            size="sm"
            variant="outline"
         >
            <Trash2 className="size-4" />
            Excluir
         </Button>
      </div>
   );
}

export function CounterpartyActionButtons({
   counterpartyId,
   onDeleteSuccess,
}: {
   counterpartyId: string;
   onDeleteSuccess: () => void;
}) {
   return (
      <ErrorBoundary FallbackComponent={ActionButtonsErrorFallback}>
         <Suspense fallback={<ActionButtonsSkeleton />}>
            <ActionButtonsContent
               counterpartyId={counterpartyId}
               onDeleteSuccess={onDeleteSuccess}
            />
         </Suspense>
      </ErrorBoundary>
   );
}
