import { Badge } from "@packages/ui/components/badge";
import {
   Card,
   CardContent,
   CardHeader,
   CardTitle,
} from "@packages/ui/components/card";
import { useSuspenseQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import type { Outputs } from "@/integrations/orpc/client";
import { orpc } from "@/integrations/orpc/client";

type Contact = Outputs["contacts"]["getById"];

const TYPE_LABELS: Record<Contact["type"], string> = {
   cliente: "Cliente",
   fornecedor: "Fornecedor",
   ambos: "Ambos",
};

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
   return (
      <div className="flex items-center gap-2">
         <span className="flex-1 text-xs text-muted-foreground">{label}</span>
         <span className="text-xs">{value}</span>
      </div>
   );
}

export function ContactInfoSidebar({ contact }: { contact: Contact }) {
   const { data: subscriptions } = useSuspenseQuery(
      orpc.services.getContactSubscriptions.queryOptions({
         input: { contactId: contact.id },
      }),
   );

   const activeCount = subscriptions.filter(
      (s) => s.status === "active",
   ).length;

   return (
      <aside className="flex w-64 shrink-0 flex-col gap-4">
         <Card>
            <CardHeader>
               <CardTitle>Info</CardTitle>
            </CardHeader>
            <CardContent>
               <div className="flex flex-col gap-2">
                  <InfoRow
                     label="Tipo"
                     value={
                        <Badge variant="outline">
                           {TYPE_LABELS[contact.type]}
                        </Badge>
                     }
                  />
                  <InfoRow
                     label="Criado em"
                     value={dayjs(contact.createdAt).format("DD/MM/YYYY")}
                  />
                  <InfoRow
                     label="Atualizado"
                     value={dayjs(contact.updatedAt).format("DD/MM/YYYY")}
                  />
               </div>
            </CardContent>
         </Card>

         {activeCount > 0 && (
            <Card>
               <CardHeader>
                  <CardTitle>Assinaturas</CardTitle>
               </CardHeader>
               <CardContent>
                  <div className="flex items-baseline gap-2">
                     <span className="text-3xl font-bold">{activeCount}</span>
                     <span className="text-xs text-muted-foreground">
                        ativa{activeCount !== 1 ? "s" : ""}
                     </span>
                  </div>
               </CardContent>
            </Card>
         )}
      </aside>
   );
}
