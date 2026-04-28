import {
   ContextPanelDivider,
   ContextPanelMeta,
} from "@/features/context-panel/context-panel-info";
import {
   activeCount,
   costPerCycle,
   formatCostBRL,
   pausedCount,
   summarizeByType,
   topByCost,
   totalCostPerCycle,
   totalMonthlyEstimate,
   type BenefitForAggregate,
} from "@modules/billing/services/benefits-aggregates";
import {
   Activity,
   CircleDollarSign,
   Coins,
   PauseCircle,
   TrendingUp,
} from "lucide-react";
import { useMemo } from "react";
import {
   BENEFIT_TYPE_ICON,
   BENEFIT_TYPE_LABEL,
   type BenefitTypeKey,
} from "./labels";
import type { BenefitRow } from "./build-benefit-columns";

export function BenefitsAnalytics({ benefits }: { benefits: BenefitRow[] }) {
   const aggregates = useMemo<BenefitForAggregate[]>(
      () =>
         benefits.map((b) => ({
            id: b.id,
            name: b.name,
            type: b.type,
            creditAmount: b.creditAmount,
            unitCost: b.unitCost,
            isActive: b.isActive,
            usedInServices: b.usedInServices,
         })),
      [benefits],
   );

   const total = useMemo(() => totalMonthlyEstimate(aggregates), [aggregates]);
   const perCycle = useMemo(() => totalCostPerCycle(aggregates), [aggregates]);
   const top = useMemo(() => topByCost(aggregates, 5), [aggregates]);
   const summaries = useMemo(() => summarizeByType(aggregates), [aggregates]);

   return (
      <div className="flex flex-col gap-2 p-2">
         <ContextPanelMeta
            icon={Coins}
            label="Custo por assinante / ciclo"
            value={formatCostBRL(perCycle)}
         />
         <ContextPanelMeta
            icon={CircleDollarSign}
            label="Custo mensal realizado"
            value={formatCostBRL(total)}
         />
         <ContextPanelMeta
            icon={Activity}
            label="Ativos"
            value={activeCount(aggregates)}
         />
         <ContextPanelMeta
            icon={PauseCircle}
            label="Pausados"
            value={pausedCount(aggregates)}
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
                        value={`${s.activeCount} · ${formatCostBRL(s.cyclesCost)}/ciclo`}
                     />
                  );
               })}
            </>
         )}

         {top.length > 0 && (
            <>
               <ContextPanelDivider />
               <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">
                  Mais caros (por ciclo)
               </div>
               {top.map((b) => (
                  <ContextPanelMeta
                     key={b.id}
                     icon={TrendingUp}
                     label={b.name}
                     value={formatCostBRL(costPerCycle(b))}
                  />
               ))}
            </>
         )}
      </div>
   );
}
