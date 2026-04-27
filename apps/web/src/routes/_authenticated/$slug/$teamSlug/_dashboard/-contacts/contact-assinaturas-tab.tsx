import { Badge } from "@packages/ui/components/badge";
import {
   Card,
   CardContent,
   CardHeader,
   CardTitle,
} from "@packages/ui/components/card";
import {
   Empty,
   EmptyDescription,
   EmptyHeader,
   EmptyMedia,
   EmptyTitle,
} from "@packages/ui/components/empty";
import { useSuspenseQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { RefreshCw } from "lucide-react";
import type { Outputs } from "@/integrations/orpc/client";
import { orpc } from "@/integrations/orpc/client";

type Subscription = Outputs["subscriptions"]["getContactSubscriptions"][number];

const STATUS_LABELS: Record<Subscription["status"], string> = {
   active: "Ativa",
   trialing: "Em teste",
   incomplete: "Incompleta",
   completed: "Concluída",
   cancelled: "Cancelada",
};

const STATUS_VARIANTS: Record<
   Subscription["status"],
   "default" | "secondary" | "outline"
> = {
   active: "default",
   trialing: "default",
   incomplete: "outline",
   completed: "secondary",
   cancelled: "outline",
};

function SubscriptionCard({ sub }: { sub: Subscription }) {
   return (
      <Card>
         <CardHeader>
            <div className="flex items-center gap-2">
               <CardTitle className="flex-1 text-sm">
                  Assinatura {sub.id.slice(0, 8)}
               </CardTitle>
               <Badge variant={STATUS_VARIANTS[sub.status]}>
                  {STATUS_LABELS[sub.status]}
               </Badge>
            </div>
         </CardHeader>
         <CardContent>
            <div className="flex flex-col gap-2 text-sm">
               <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Início:</span>
                  <span>{dayjs(sub.startDate).format("DD/MM/YYYY")}</span>
               </div>
               {sub.endDate && (
                  <div className="flex items-center gap-2">
                     <span className="text-muted-foreground">Término:</span>
                     <span>{dayjs(sub.endDate).format("DD/MM/YYYY")}</span>
                  </div>
               )}
               {sub.currentPeriodEnd && (
                  <div className="flex items-center gap-2">
                     <span className="text-muted-foreground">
                        Período atual até:
                     </span>
                     <span>
                        {dayjs(sub.currentPeriodEnd).format("DD/MM/YYYY")}
                     </span>
                  </div>
               )}
            </div>
         </CardContent>
      </Card>
   );
}

export function ContactAssinaturasTab({ contactId }: { contactId: string }) {
   const { data: subscriptions } = useSuspenseQuery(
      orpc.subscriptions.getContactSubscriptions.queryOptions({
         input: { contactId },
      }),
   );

   return (
      <div className="flex flex-col gap-4">
         {subscriptions.length === 0 ? (
            <Empty>
               <EmptyHeader>
                  <EmptyMedia variant="icon">
                     <RefreshCw className="size-6" />
                  </EmptyMedia>
                  <EmptyTitle>Nenhuma assinatura</EmptyTitle>
                  <EmptyDescription>
                     Vincule este contato a um serviço para acompanhar
                     assinaturas e cobranças.
                  </EmptyDescription>
               </EmptyHeader>
            </Empty>
         ) : (
            <div className="flex flex-col gap-4">
               {subscriptions.map((sub) => (
                  <SubscriptionCard key={sub.id} sub={sub} />
               ))}
            </div>
         )}
      </div>
   );
}
