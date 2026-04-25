import {
   Card,
   CardContent,
   CardDescription,
   CardHeader,
   CardTitle,
} from "@packages/ui/components/card";
import { Separator } from "@packages/ui/components/separator";
import {
   Tabs,
   TabsContent,
   TabsList,
   TabsTrigger,
} from "@packages/ui/components/tabs";
import { createFileRoute } from "@tanstack/react-router";
import { CreditCard } from "lucide-react";
import { BillingOverview } from "@/features/billing/ui/billing-overview";
import { BillingSpend } from "@/features/billing/ui/billing-spend";
import { BillingUsage } from "@/features/billing/ui/billing-usage";
import { EarlyAccessBanner } from "@/features/billing/ui/early-access-banner";

const earlyAccessTemplate = {
   badgeLabel: "Acesso antecipado",
   message:
      "Estamos aprimorando estes dashboards — tem perguntas, ideias ou bugs?",
   ctaLabel: "Fale com a gente",
   stage: "beta" as const,
   icon: CreditCard,
   bullets: [
      "Dados de uso atualizados diariamente (UTC) — os números de hoje aparecem amanhã",
      "Gastos históricos e períodos de cobrança são baseados no plano atual",
      "Para mais detalhes por evento, expanda os cards de produto na aba Overview",
   ],
};

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/billing",
)({
   head: () => ({
      meta: [{ title: "Assinatura — Montte" }],
   }),
   component: BillingPage,
});

function BillingPage() {
   return (
      <div className="flex flex-col gap-2">
         <Tabs defaultValue="overview">
            <TabsList variant="line">
               <TabsTrigger value="overview">Geral</TabsTrigger>
               <TabsTrigger value="usage">Uso</TabsTrigger>
               <TabsTrigger value="spend">Gastos</TabsTrigger>
            </TabsList>
            <Separator />

            <TabsContent className="flex flex-col gap-4" value="overview">
               <Card>
                  <CardHeader>
                     <CardTitle>Cobrança</CardTitle>
                     <CardDescription>
                        Integração HyprPay em migração — dados mockados.
                     </CardDescription>
                  </CardHeader>
                  <CardContent>
                     <BillingOverview />
                  </CardContent>
               </Card>
            </TabsContent>

            <TabsContent className="flex flex-col gap-4" value="usage">
               <EarlyAccessBanner template={earlyAccessTemplate} />
               <BillingUsage />
            </TabsContent>

            <TabsContent className="flex flex-col gap-4" value="spend">
               <EarlyAccessBanner template={earlyAccessTemplate} />
               <BillingSpend />
            </TabsContent>
         </Tabs>
      </div>
   );
}
