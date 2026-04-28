import { add, format, multiply, type Money } from "@f-o-t/money";
import { moneyAtCostScale, zeroCost } from "./cost";

export type BenefitTypeKey = "credits" | "feature_access" | "custom";

export interface BenefitForAggregate {
   id: string;
   name: string;
   type: BenefitTypeKey;
   creditAmount: number | null;
   unitCost: string;
   isActive: boolean;
   usedInServices: number;
}

export function costPerCycle(benefit: BenefitForAggregate): Money {
   if (!benefit.isActive) return zeroCost();
   const units = benefit.creditAmount ?? 1;
   return multiply(moneyAtCostScale(benefit.unitCost), units);
}

export function monthlyEstimateForBenefit(benefit: BenefitForAggregate): Money {
   return multiply(costPerCycle(benefit), benefit.usedInServices);
}

export function totalCostPerCycle(benefits: BenefitForAggregate[]): Money {
   return benefits.reduce((acc, b) => add(acc, costPerCycle(b)), zeroCost());
}

export function totalMonthlyEstimate(benefits: BenefitForAggregate[]): Money {
   return benefits.reduce(
      (acc, b) => add(acc, monthlyEstimateForBenefit(b)),
      zeroCost(),
   );
}

export interface TypeSummary {
   type: BenefitTypeKey;
   count: number;
   activeCount: number;
   cyclesCost: Money;
   monthlyCost: Money;
   topByCost: BenefitForAggregate | null;
}

export function summarizeByType(
   benefits: BenefitForAggregate[],
): TypeSummary[] {
   const by = new Map<BenefitTypeKey, BenefitForAggregate[]>();
   for (const b of benefits) {
      const list = by.get(b.type) ?? [];
      list.push(b);
      by.set(b.type, list);
   }
   const summaries: TypeSummary[] = [];
   for (const [type, list] of by.entries()) {
      const cyclesCost = totalCostPerCycle(list);
      const monthlyCost = totalMonthlyEstimate(list);
      const sortedByCost = [...list].sort((a, b) => {
         const ac = costPerCycle(a);
         const bc = costPerCycle(b);
         if (bc.amount > ac.amount) return 1;
         if (bc.amount < ac.amount) return -1;
         return 0;
      });
      summaries.push({
         type,
         count: list.length,
         activeCount: list.filter((b) => b.isActive).length,
         cyclesCost,
         monthlyCost,
         topByCost: sortedByCost[0] ?? null,
      });
   }
   return summaries;
}

export function topByCost(
   benefits: BenefitForAggregate[],
   limit = 5,
): BenefitForAggregate[] {
   return [...benefits]
      .filter((b) => b.isActive)
      .sort((a, b) => {
         const ac = costPerCycle(a);
         const bc = costPerCycle(b);
         if (bc.amount > ac.amount) return 1;
         if (bc.amount < ac.amount) return -1;
         return 0;
      })
      .slice(0, limit);
}

export function activeCount(benefits: BenefitForAggregate[]): number {
   return benefits.filter((b) => b.isActive).length;
}

export function pausedCount(benefits: BenefitForAggregate[]): number {
   return benefits.filter((b) => !b.isActive).length;
}

export function formatCostBRL(money: Money): string {
   return format(money, "pt-BR");
}
