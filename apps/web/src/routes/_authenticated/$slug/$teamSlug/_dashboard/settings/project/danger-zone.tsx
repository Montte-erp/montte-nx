import { Button } from "@packages/ui/components/button";
import {
   Item,
   ItemActions,
   ItemContent,
   ItemDescription,
   ItemGroup,
   ItemMedia,
   ItemSeparator,
   ItemTitle,
} from "@packages/ui/components/item";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowRightLeft, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/integrations/better-auth/auth-client";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useActiveTeam } from "@/hooks/use-active-team";

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/settings/project/danger-zone",
)({
   component: ProjectDangerZonePage,
});

function ProjectDangerZonePage() {
   const { openAlertDialog } = useAlertDialog();
   const { activeTeam } = useActiveTeam();
   const navigate = useNavigate();

   return (
      <div className="flex flex-col gap-4">
         <div>
            <h1 className="text-2xl font-semibold font-serif">
               Zona de Perigo
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
               Ações irreversíveis para este projeto. Prossiga com cuidado.
            </p>
         </div>
         <ItemGroup>
            <Item variant="muted">
               <ItemMedia variant="icon">
                  <ArrowRightLeft className="size-4" />
               </ItemMedia>
               <ItemContent>
                  <ItemTitle>Transferir projeto</ItemTitle>
                  <ItemDescription>
                     Mova este projeto para outra organização.
                  </ItemDescription>
               </ItemContent>
               <ItemActions>
                  <Button
                     onClick={() =>
                        openAlertDialog({
                           title: "Transferir projeto",
                           description:
                              "Tem certeza que deseja transferir este projeto para outra organização? Você poderá perder o acesso dependendo das permissões.",
                           actionLabel: "Transferir",
                           onAction: async () => {
                              // TODO: implement
                           },
                        })
                     }
                     variant="outline"
                  >
                     Transferir
                  </Button>
               </ItemActions>
            </Item>
            <ItemSeparator />
            <Item variant="muted">
               <ItemMedia variant="icon">
                  <Trash2 className="size-4 text-destructive" />
               </ItemMedia>
               <ItemContent>
                  <ItemTitle>Deletar projeto</ItemTitle>
                  <ItemDescription>
                     Remova permanentemente este projeto e todos os seus dados.
                  </ItemDescription>
               </ItemContent>
               <ItemActions>
                  <Button
                     onClick={() =>
                        openAlertDialog({
                           title: "Deletar projeto",
                           description:
                              "Tem certeza? Esta ação não pode ser desfeita. Todos os dados serão permanentemente removidos.",
                           actionLabel: "Deletar",
                           variant: "destructive",
                           onAction: async () => {
                              if (!activeTeam) return;

                              const { error } =
                                 await authClient.organization.removeTeam({
                                    teamId: activeTeam.id,
                                 });

                              if (error) {
                                 toast.error("Erro ao deletar projeto", {
                                    description:
                                       error.message ||
                                       "Ocorreu um erro inesperado. Tente novamente.",
                                 });
                                 return;
                              }

                              toast.success("Projeto deletado com sucesso");
                              navigate({ to: "/" });
                           },
                        })
                     }
                     variant="destructive"
                  >
                     Deletar
                  </Button>
               </ItemActions>
            </Item>
         </ItemGroup>
      </div>
   );
}
