import { Button } from "@packages/ui/components/button";
import {
   Item,
   ItemActions,
   ItemContent,
   ItemDescription,
   ItemGroup,
   ItemMedia,
   ItemTitle,
} from "@packages/ui/components/item";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/integrations/better-auth/auth-client";
import { useAlertDialog } from "@/hooks/use-alert-dialog";

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/settings/danger-zone",
)({
   head: () => ({
      meta: [{ title: "Zona de Perigo — Montte" }],
   }),
   component: AccountDangerZonePage,
});

function AccountDangerZonePage() {
   const { openAlertDialog } = useAlertDialog();
   const navigate = useNavigate();

   return (
      <div className="flex flex-col gap-4">
         <div>
            <h1 className="text-2xl font-semibold font-serif">
               Zona de Perigo
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
               Ações irreversíveis para sua conta. Prossiga com cuidado.
            </p>
         </div>
         <ItemGroup>
            <Item variant="muted">
               <ItemMedia variant="icon">
                  <Trash2 className="size-4 text-destructive" />
               </ItemMedia>
               <ItemContent>
                  <ItemTitle>Deletar conta</ItemTitle>
                  <ItemDescription>
                     Remova permanentemente sua conta e saia de todas as
                     organizações.
                  </ItemDescription>
               </ItemContent>
               <ItemActions>
                  <Button
                     onClick={() =>
                        openAlertDialog({
                           title: "Deletar conta",
                           description:
                              "Tem certeza? Esta ação não pode ser desfeita. Sua conta e todos os dados associados serão permanentemente removidos.",
                           actionLabel: "Deletar conta",
                           variant: "destructive",
                           onAction: async () => {
                              const { error } = await authClient.deleteUser();
                              if (error) {
                                 toast.error("Erro ao deletar conta", {
                                    description:
                                       error.message ||
                                       "Ocorreu um erro inesperado. Tente novamente.",
                                 });
                                 return;
                              }
                              toast.success("Conta deletada com sucesso");
                              navigate({ to: "/" });
                           },
                        })
                     }
                     variant="destructive"
                  >
                     Deletar conta
                  </Button>
               </ItemActions>
            </Item>
         </ItemGroup>
      </div>
   );
}
