import { add, format, type Money } from "@f-o-t/money";
import { moneyAtCostScale, zeroCost } from "./cost";

export type MeterAggregationKey =
   | "sum"
   | "count"
   | "count_unique"
   | "max"
   | "last";

export interface MeterForAggregate {
   id: string;
   name: string;
   aggregation: MeterAggregationKey;
   unitCost: string;
   isActive: boolean;
   usedIn: number;
}

export function unitCostMoney(meter: MeterForAggregate): Money {
   if (!meter.isActive) return zeroCost();
   return moneyAtCostScale(meter.unitCost);
}

export function totalUnitCost(meters: MeterForAggregate[]): Money {
   return meters.reduce((acc, m) => add(acc, unitCostMoney(m)), zeroCost());
}

export interface AggregationSummary {
   aggregation: MeterAggregationKey;
   count: number;
   activeCount: number;
   totalUnitCost: Money;
   topByCost: MeterForAggregate | null;
}

export function summarizeByAggregation(
   meters: MeterForAggregate[],
): AggregationSummary[] {
   const by = new Map<MeterAggregationKey, MeterForAggregate[]>();
   for (const m of meters) {
      const list = by.get(m.aggregation) ?? [];
      list.push(m);
      by.set(m.aggregation, list);
   }
   const summaries: AggregationSummary[] = [];
   for (const [aggregation, list] of by.entries()) {
      const sortedByCost = [...list].sort((a, b) => {
         const ac = unitCostMoney(a);
         const bc = unitCostMoney(b);
         if (bc.amount > ac.amount) return 1;
         if (bc.amount < ac.amount) return -1;
         return 0;
      });
      summaries.push({
         aggregation,
         count: list.length,
         activeCount: list.filter((m) => m.isActive).length,
         totalUnitCost: totalUnitCost(list),
         topByCost: sortedByCost[0] ?? null,
      });
   }
   return summaries;
}

export function topByUnitCost(
   meters: MeterForAggregate[],
   limit = 5,
): MeterForAggregate[] {
   return [...meters]
      .filter((m) => m.isActive)
      .sort((a, b) => {
         const ac = unitCostMoney(a);
         const bc = unitCostMoney(b);
         if (bc.amount > ac.amount) return 1;
         if (bc.amount < ac.amount) return -1;
         return 0;
      })
      .slice(0, limit);
}

export function activeCount(meters: MeterForAggregate[]): number {
   return meters.filter((m) => m.isActive).length;
}

export function pausedCount(meters: MeterForAggregate[]): number {
   return meters.filter((m) => !m.isActive).length;
}

export function inUseCount(meters: MeterForAggregate[]): number {
   return meters.filter((m) => m.usedIn > 0).length;
}

export function formatCostBRL(money: Money): string {
   return format(money, "pt-BR");
}
