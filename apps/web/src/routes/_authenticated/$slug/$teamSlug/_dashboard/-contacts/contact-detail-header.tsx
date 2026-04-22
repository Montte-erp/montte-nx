import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuItem,
   DropdownMenuTrigger,
} from "@packages/ui/components/dropdown-menu";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, MoreHorizontal, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Outputs } from "@/integrations/orpc/client";
import { orpc } from "@/integrations/orpc/client";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useOrgSlug, useTeamSlug } from "@/hooks/use-dashboard-slugs";

type Contact = Outputs["contacts"]["getById"];

const TYPE_LABELS: Record<Contact["type"], string> = {
   cliente: "Cliente",
   fornecedor: "Fornecedor",
   ambos: "Ambos",
};

const TYPE_VARIANTS: Record<
   Contact["type"],
   "default" | "secondary" | "outline"
> = {
   cliente: "default",
   fornecedor: "secondary",
   ambos: "outline",
};

export function ContactDetailHeader({ contact }: { contact: Contact }) {
   const navigate = useNavigate();
   const { openAlertDialog } = useAlertDialog();
   const slug = useOrgSlug();
   const teamSlug = useTeamSlug();

   const deleteMutation = useMutation(
      orpc.contacts.remove.mutationOptions({
         onSuccess: () => {
            toast.success("Contato excluído.");
            navigate({
               to: "/$slug/$teamSlug/contacts",
               params: { slug, teamSlug },
            });
         },
         onError: (e) => toast.error(e.message),
      }),
   );

   function handleDelete() {
      openAlertDialog({
         title: "Excluir contato",
         description: `Excluir "${contact.name}"? Lançamentos vinculados impedirão a exclusão.`,
         actionLabel: "Excluir",
         cancelLabel: "Cancelar",
         variant: "destructive",
         onAction: async () => {
            await deleteMutation.mutateAsync({ id: contact.id });
         },
      });
   }

   return (
      <div className="flex items-center gap-4">
         <Button
            size="icon"
            variant="ghost"
            onClick={() =>
               navigate({
                  to: "/$slug/$teamSlug/contacts",
                  params: { slug, teamSlug },
               })
            }
         >
            <ArrowLeft className="size-4" />
            <span className="sr-only">Voltar</span>
         </Button>
         <div className="flex flex-1 items-center gap-2">
            <h1 className="text-xl font-semibold">{contact.name}</h1>
            <Badge variant={TYPE_VARIANTS[contact.type]}>
               {TYPE_LABELS[contact.type]}
            </Badge>
            {contact.isArchived && <Badge variant="outline">Arquivado</Badge>}
         </div>
         <DropdownMenu>
            <DropdownMenuTrigger asChild>
               <Button size="icon" variant="outline">
                  <MoreHorizontal className="size-4" />
               </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
               <DropdownMenuItem
                  className="text-destructive"
                  onClick={handleDelete}
               >
                  <Trash2 className="size-4" />
                  Excluir
               </DropdownMenuItem>
            </DropdownMenuContent>
         </DropdownMenu>
      </div>
   );
}
