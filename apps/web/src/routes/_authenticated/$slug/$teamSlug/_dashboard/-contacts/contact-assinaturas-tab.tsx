import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
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
import { format, of } from "@f-o-t/money";
import dayjs from "dayjs";
import { Plus, RefreshCw } from "lucide-react";
import type { Outputs } from "@/integrations/orpc/client";
import { orpc } from "@/integrations/orpc/client";
import { useCredenza } from "@/hooks/use-credenza";
import { AddSubscriptionForm } from "./add-subscription-form";

type Subscription = Outputs["services"]["getContactSubscriptions"][number];

const STATUS_LABELS: Record<Subscription["status"], string> = {
   active: "Ativa",
   completed: "Concluída",
   cancelled: "Cancelada",
};

const STATUS_VARIANTS: Record<
   Subscription["status"],
   "default" | "secondary" | "outline"
> = {
   active: "default",
   completed: "secondary",
   cancelled: "outline",
};

const BILLING_CYCLE_LABELS: Record<string, string> = {
   hourly: "Por hora",
   monthly: "Mensal",
   annual: "Anual",
   one_time: "Único",
};

function SubscriptionCard({ sub }: { sub: Subscription }) {
   return (
      <Card>
         <CardHeader>
            <div className="flex items-center gap-2">
               <CardTitle className="flex-1 text-sm">
                  {sub.serviceName ?? "Serviço removido"}
               </CardTitle>
               <Badge variant={STATUS_VARIANTS[sub.status]}>
                  {STATUS_LABELS[sub.status]}
               </Badge>
            </div>
            {sub.variantName && sub.billingCycle && (
               <span className="text-xs text-muted-foreground">
                  {sub.variantName} —{" "}
                  {BILLING_CYCLE_LABELS[sub.billingCycle] ?? sub.billingCycle}
               </span>
            )}
         </CardHeader>
         <CardContent>
            <div className="flex flex-col gap-2 text-sm">
               <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Valor:</span>
                  <span className="font-medium">
                     {format(of(sub.negotiatedPrice, "BRL"), "pt-BR")}
                  </span>
               </div>
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
      orpc.services.getContactSubscriptions.queryOptions({
         input: { contactId },
      }),
   );
   const { openCredenza } = useCredenza();

   function handleAdd() {
      openCredenza({
         renderChildren: () => (
            <AddSubscriptionForm contactId={contactId} onSuccess={() => {}} />
         ),
      });
   }

   return (
      <div className="flex flex-col gap-4">
         <div className="flex items-center gap-4">
            <h2 className="flex-1 text-sm font-medium text-muted-foreground">
               {subscriptions.length} assinatura
               {subscriptions.length !== 1 ? "s" : ""}
            </h2>
            <Button size="sm" variant="outline" onClick={handleAdd}>
               <Plus className="size-4" />
               Adicionar
            </Button>
         </div>

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
