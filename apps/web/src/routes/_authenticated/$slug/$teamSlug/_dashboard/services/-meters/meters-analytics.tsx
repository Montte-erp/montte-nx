import {
   ContextPanelDivider,
   ContextPanelMeta,
} from "@/features/context-panel/context-panel-info";
import {
   activeCount,
   formatCostBRL,
   inUseCount,
   pausedCount,
   summarizeByAggregation,
   topByUnitCost,
   totalUnitCost,
   unitCostMoney,
   type MeterForAggregate,
} from "@modules/billing/services/meters-aggregates";
import {
   Activity,
   CircleDollarSign,
   Gauge,
   Link2,
   PauseCircle,
   TrendingUp,
} from "lucide-react";
import { useMemo } from "react";
import { AGG_ICON, AGG_LABEL, type MeterAggregationKey } from "./labels";
import type { MeterRow } from "./build-meter-columns";

export function MetersAnalytics({ meters }: { meters: MeterRow[] }) {
   const aggregates = useMemo<MeterForAggregate[]>(
      () =>
         meters.map((m) => ({
            id: m.id,
            name: m.name,
            aggregation: m.aggregation,
            unitCost: m.unitCost,
            isActive: m.isActive,
            usedIn: m.usedIn,
         })),
      [meters],
   );

   const total = useMemo(() => totalUnitCost(aggregates), [aggregates]);
   const top = useMemo(() => topByUnitCost(aggregates, 5), [aggregates]);
   const summaries = useMemo(
      () => summarizeByAggregation(aggregates),
      [aggregates],
   );

   return (
      <div className="flex flex-col gap-2 p-2">
         <ContextPanelMeta
            icon={CircleDollarSign}
            label="Custo unitário total"
            value={formatCostBRL(total)}
         />
         <ContextPanelMeta
            icon={Gauge}
            label="Total de medidores"
            value={aggregates.length}
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
         <ContextPanelMeta
            icon={Link2}
            label="Em uso"
            value={inUseCount(aggregates)}
         />

         {summaries.length > 0 && (
            <>
               <ContextPanelDivider />
               <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">
                  Por agregação
               </div>
               {summaries.map((s) => {
                  const Icon = AGG_ICON[s.aggregation as MeterAggregationKey];
                  return (
                     <ContextPanelMeta
                        key={s.aggregation}
                        icon={Icon}
                        label={AGG_LABEL[s.aggregation as MeterAggregationKey]}
                        value={`${s.activeCount} · ${formatCostBRL(s.totalUnitCost)}`}
                     />
                  );
               })}
            </>
         )}

         {top.length > 0 && (
            <>
               <ContextPanelDivider />
               <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">
                  Mais caros (por unidade)
               </div>
               {top.map((m) => (
                  <ContextPanelMeta
                     key={m.id}
                     icon={TrendingUp}
                     label={m.name}
                     value={formatCostBRL(unitCostMoney(m))}
                  />
               ))}
            </>
         )}
      </div>
   );
}
