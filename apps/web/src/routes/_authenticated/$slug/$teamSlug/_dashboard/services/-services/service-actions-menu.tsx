import { Button } from "@packages/ui/components/button";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Archive, ArchiveRestore, Copy, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useOrgSlug, useTeamSlug } from "@/hooks/use-dashboard-slugs";
import { orpc } from "@/integrations/orpc/client";

export function ServiceActionsMenu({ serviceId }: { serviceId: string }) {
   const navigate = useNavigate();
   const slug = useOrgSlug();
   const teamSlug = useTeamSlug();
   const { openAlertDialog } = useAlertDialog();

   const { data: service } = useSuspenseQuery(
      orpc.services.getById.queryOptions({ input: { id: serviceId } }),
   );

   const updateMutation = useMutation(
      orpc.services.update.mutationOptions({
         onSuccess: () => toast.success("Serviço atualizado."),
         onError: (e) => toast.error(e.message),
      }),
   );

   const createMutation = useMutation(
      orpc.services.create.mutationOptions({
         onSuccess: (created) => {
            toast.success("Serviço duplicado.");
            navigate({
               to: "/$slug/$teamSlug/services/$serviceId",
               params: { slug, teamSlug, serviceId: created.id },
            });
         },
         onError: (e) => toast.error(e.message),
      }),
   );

   const deleteMutation = useMutation(
      orpc.services.remove.mutationOptions({
         onSuccess: () => {
            toast.success("Serviço excluído.");
            navigate({
               to: "/$slug/$teamSlug/services",
               params: { slug, teamSlug },
            });
         },
         onError: (e) => toast.error(e.message),
      }),
   );

   function handleDuplicate() {
      createMutation.mutate({
         name: `${service.name} (cópia)`,
         description: service.description,
         categoryId: service.categoryId,
         tagId: service.tagId,
      });
   }

   function handleArchiveToggle() {
      updateMutation.mutate({
         id: service.id,
         isActive: !service.isActive,
      });
   }

   function handleDelete() {
      openAlertDialog({
         title: "Excluir serviço",
         description: `Excluir "${service.name}"? Assinaturas vinculadas impedirão a exclusão.`,
         actionLabel: "Excluir",
         cancelLabel: "Cancelar",
         variant: "destructive",
         onAction: async () => {
            await deleteMutation.mutateAsync({ id: service.id });
         },
      });
   }

   return (
      <>
         <Button
            onClick={handleDuplicate}
            size="icon-sm"
            tooltip="Duplicar serviço"
            variant="outline"
         >
            <Copy />
            <span className="sr-only">Duplicar serviço</span>
         </Button>
         <Button
            onClick={handleArchiveToggle}
            size="icon-sm"
            tooltip={service.isActive ? "Arquivar" : "Reativar"}
            variant="outline"
         >
            {service.isActive ? <Archive /> : <ArchiveRestore />}
            <span className="sr-only">
               {service.isActive ? "Arquivar" : "Reativar"}
            </span>
         </Button>
         <Button
            className="text-destructive hover:text-destructive"
            onClick={handleDelete}
            size="icon-sm"
            tooltip="Excluir"
            variant="outline"
         >
            <Trash2 />
            <span className="sr-only">Excluir</span>
         </Button>
      </>
   );
}
