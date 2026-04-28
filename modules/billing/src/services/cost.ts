import {
   add,
   createMoney,
   format,
   greaterThan,
   multiply,
   parseDecimalToMinorUnits,
   toMajorUnitsString,
   type Money,
} from "@f-o-t/money";

const COST_SCALE = 4;

export function moneyAtCostScale(decimal: string | null | undefined) {
   const v = decimal ?? "0";
   return createMoney(
      parseDecimalToMinorUnits(v, COST_SCALE),
      "BRL",
      COST_SCALE,
   );
}

export function zeroCost(): Money {
   return createMoney(0n, "BRL", COST_SCALE);
}

interface BenefitForCost {
   unitCost: string;
   creditAmount: number | null;
}

interface MeterForCost {
   unitCost: string;
}

interface PriceForCost {
   type: "flat" | "per_unit" | "metered";
   meterId: string | null;
}

interface ComputeArgs {
   serviceCostPrice: string;
   benefits: BenefitForCost[];
   price?: PriceForCost;
   meter?: MeterForCost | null;
}

export function computeEffectiveCost({
   serviceCostPrice,
   benefits,
   price,
   meter,
}: ComputeArgs): Money {
   let cost = moneyAtCostScale(serviceCostPrice);

   for (const b of benefits) {
      const units = b.creditAmount ?? 1;
      cost = add(cost, multiply(moneyAtCostScale(b.unitCost), units));
   }

   if (price?.type === "metered" && meter) {
      cost = add(cost, moneyAtCostScale(meter.unitCost));
   }

   return cost;
}

export function computeFloor(
   effectiveCost: Money,
   minPrice: string | null | undefined,
): Money {
   if (!minPrice) return effectiveCost;
   const min = moneyAtCostScale(minPrice);
   return greaterThan(min, effectiveCost) ? min : effectiveCost;
}

export function isBelowFloor(amount: string, floor: Money): boolean {
   const candidate = moneyAtCostScale(amount);
   return greaterThan(floor, candidate);
}

export function formatCostDecimal(money: Money): string {
   return toMajorUnitsString(money);
}

export function formatCostBRL(money: Money): string {
   return format(money, "pt-BR");
}
