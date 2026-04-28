import {
   ContextPanelDivider,
   ContextPanelMeta,
} from "@/features/context-panel/context-panel-info";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
   formatCostBRL,
   summarizeByType,
   totalCostPerCycle,
   type BenefitForAggregate,
} from "@modules/billing/services/benefits-aggregates";
import { CircleDollarSign, Sparkles, TrendingUp } from "lucide-react";
import { useMemo } from "react";
import { orpc } from "@/integrations/orpc/client";
import {
   BENEFIT_TYPE_ICON,
   BENEFIT_TYPE_LABEL,
   type BenefitTypeKey,
} from "../-benefits/labels";

export function ServiceMarginPanel({ serviceId }: { serviceId: string }) {
   const { data: linked } = useSuspenseQuery(
      orpc.benefits.getServiceBenefits.queryOptions({
         input: { serviceId },
      }),
   );

   const aggregates = useMemo<BenefitForAggregate[]>(
      () =>
         linked.map((b) => ({
            id: b.id,
            name: b.name,
            type: b.type,
            creditAmount: b.creditAmount,
            unitCost: b.unitCost,
            isActive: b.isActive,
            usedInServices: 1,
         })),
      [linked],
   );

   const totalCost = useMemo(() => totalCostPerCycle(aggregates), [aggregates]);
   const summaries = useMemo(() => summarizeByType(aggregates), [aggregates]);

   if (linked.length === 0) {
      return (
         <div className="p-4 text-xs text-muted-foreground">
            Nenhum benefício vinculado.
         </div>
      );
   }

   return (
      <div className="flex flex-col gap-2 p-2">
         <ContextPanelMeta
            icon={CircleDollarSign}
            label="Custo dos benefícios / ciclo"
            value={formatCostBRL(totalCost)}
         />
         <ContextPanelMeta
            icon={Sparkles}
            label="Benefícios vinculados"
            value={linked.length}
         />

         {summaries.length > 0 && (
            <>
               <ContextPanelDivider />
               <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">
                  Por tipo
               </div>
               {summaries.map((s) => {
                  const Icon = BENEFIT_TYPE_ICON[s.type as BenefitTypeKey];
                  return (
                     <ContextPanelMeta
                        key={s.type}
                        icon={Icon}
                        label={BENEFIT_TYPE_LABEL[s.type as BenefitTypeKey]}
                        value={`${s.activeCount} · ${formatCostBRL(s.cyclesCost)}`}
                     />
                  );
               })}
            </>
         )}

         <ContextPanelDivider />
         <div className="px-2 py-1 text-xs text-muted-foreground">
            <TrendingUp className="size-3 inline mr-1" />
            Receita estimada e margem aparecem após configurar preços +
            assinaturas.
         </div>
      </div>
   );
}
