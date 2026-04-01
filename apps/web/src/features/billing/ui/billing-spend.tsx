import { format, of } from "@f-o-t/money";
import {
   Card,
   CardContent,
   CardDescription,
   CardHeader,
   CardTitle,
} from "@packages/ui/components/card";
import { useSuspenseQuery } from "@tanstack/react-query";
import { orpc } from "@/integrations/orpc/client";
import type { Outputs } from "@/integrations/orpc/client";

type MeterUsageItem = Outputs["billing"]["getMeterUsage"][number];

const CATEGORY_LABELS: Record<string, string> = {
   finance: "Financeiro",
   ai: "Inteligencia Artificial",
   workflow: "Automacoes",
   contact: "Contatos",
   crm: "CRM",
   document: "Documentos",
   inventory: "Estoque",
   service: "Servicos",
   coworking: "Coworking",
   webhook: "Webhooks",
   payment: "Pagamentos",
   nfe: "NF-e",
};

function getCategoryFromEventName(eventName: string): string {
   return eventName.split(".")[0] ?? "system";
}

function humanizeEventName(eventName: string): string {
   const parts = eventName.split(".");
   const name = parts[parts.length - 1] ?? eventName;
   return name
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
}

function computeOverageCost(item: MeterUsageItem): number {
   const overage = Math.max(0, item.used - item.freeTierLimit);
   return overage * parseFloat(item.pricePerEvent);
}

function formatCurrency(value: number): string {
   return format(of(value.toFixed(6), "BRL"), "pt-BR");
}

export function BillingSpend() {
   const { data: meterUsage } = useSuspenseQuery(
      orpc.billing.getMeterUsage.queryOptions({}),
   );

   const billableItems = meterUsage.filter(
      (item) => computeOverageCost(item) > 0,
   );

   const byCategory = new Map<string, MeterUsageItem[]>();
   for (const item of billableItems) {
      const cat = getCategoryFromEventName(item.eventName);
      const existing = byCategory.get(cat) ?? [];
      existing.push(item);
      byCategory.set(cat, existing);
   }

   const sortedCategories = [...byCategory.entries()].sort(([, aItems], [, bItems]) => {
      const aTotal = aItems.reduce((s, i) => s + computeOverageCost(i), 0);
      const bTotal = bItems.reduce((s, i) => s + computeOverageCost(i), 0);
      return bTotal - aTotal;
   });

   const totalCost = billableItems.reduce(
      (sum, item) => sum + computeOverageCost(item),
      0,
   );

   if (billableItems.length === 0) {
      return (
         <Card>
            <CardHeader>
               <CardTitle className="text-base">Gastos do mes</CardTitle>
               <CardDescription>
                  Nenhum gasto acima do tier gratuito este mes
               </CardDescription>
            </CardHeader>
            <CardContent>
               <p className="text-2xl font-bold tabular-nums">
                  {formatCurrency(0)}
               </p>
            </CardContent>
         </Card>
      );
   }

   return (
      <div className="space-y-4">
         <Card>
            <CardHeader>
               <CardTitle className="text-base">Total cobrado este mes</CardTitle>
               <CardDescription>
                  Apenas o que excede o tier gratuito é cobrado
               </CardDescription>
            </CardHeader>
            <CardContent>
               <p className="text-3xl font-bold tabular-nums">
                  {formatCurrency(totalCost)}
               </p>
            </CardContent>
         </Card>

         {sortedCategories.map(([category, items]) => {
            const categoryTotal = items.reduce(
               (sum, item) => sum + computeOverageCost(item),
               0,
            );
            return (
               <Card key={category}>
                  <CardHeader>
                     <div className="flex items-center justify-between">
                        <CardTitle className="text-base">
                           {CATEGORY_LABELS[category] ?? category}
                        </CardTitle>
                        <span className="text-sm font-semibold tabular-nums">
                           {formatCurrency(categoryTotal)}
                        </span>
                     </div>
                  </CardHeader>
                  <CardContent>
                     <div className="space-y-2">
                        {items.map((item) => {
                           const cost = computeOverageCost(item);
                           const overage = item.used - item.freeTierLimit;
                           return (
                              <div
                                 className="flex items-center justify-between text-sm"
                                 key={item.eventName}
                              >
                                 <div>
                                    <span className="font-medium">
                                       {humanizeEventName(item.eventName)}
                                    </span>
                                    <span className="text-muted-foreground ml-2 text-xs">
                                       {overage.toLocaleString("pt-BR")} eventos
                                       acima do gratuito
                                    </span>
                                 </div>
                                 <span className="tabular-nums font-medium">
                                    {formatCurrency(cost)}
                                 </span>
                              </div>
                           );
                        })}
                     </div>
                  </CardContent>
               </Card>
            );
         })}
      </div>
   );
}
