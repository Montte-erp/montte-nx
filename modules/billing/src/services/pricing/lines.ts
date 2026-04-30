import { add, multiply, of, zero, type Money } from "@f-o-t/money";
import { z } from "zod";
import { benefitSchema } from "@core/database/schemas/benefits";
import { servicePriceSchema } from "@core/database/schemas/services";
import {
   bucketWithSurcharges,
   flattenChunks,
   lookupApplicable,
   pipe,
   startPipe,
   stepCap,
   stepLineDiscounts,
   stepLineSurcharges,
   type CouponIndex,
   type ModifierApplied,
   type PricingCoupon,
} from "@modules/billing/services/pricing/coupons";

const UsageQuantitySchema = z
   .union([z.string(), z.number()])
   .transform((v) => (typeof v === "number" ? v.toString() : v))
   .refine((v) => /^\d+(\.\d+)?$/.test(v), {
      message: "Quantidade de uso deve ser numérica não negativa.",
   });

export const PricingBenefitSchema = benefitSchema
   .pick({
      type: true,
      meterId: true,
      creditAmount: true,
   })
   .extend({ meterId: z.string().nullable() });

export const PricingLineSchema = servicePriceSchema
   .pick({ priceCap: true })
   .extend({
      priceId: z.string(),
      priceName: z.string(),
      priceType: z.enum(["flat", "per_unit", "metered"]),
      meterId: z.string().nullable(),
      unitPrice: z.string(),
      quantity: z.number().nonnegative(),
      usageByDayOfWeek: z.record(z.string(), UsageQuantitySchema).optional(),
   });

export const PricingContextSchema = z.object({
   activePlanServiceIds: z.array(z.string()),
});

export type PricingBenefit = z.infer<typeof PricingBenefitSchema>;
export type PricingLine = z.infer<typeof PricingLineSchema>;
export type PricingContext = z.infer<typeof PricingContextSchema>;

export type LineComputation = {
   priceId: string;
   meterId: string | null;
   billableQuantity: number;
   subtotal: Money;
   modifiers: ModifierApplied[];
};

const ZERO = zero("BRL");

function matchesPlan(c: PricingCoupon, ctx: PricingContext): boolean {
   const ids = c.conditions.planServiceIds;
   if (!ids?.length) return true;
   return ids.some((id) => ctx.activePlanServiceIds.includes(id));
}

function matchesMeter(c: PricingCoupon, line: PricingLine): boolean {
   const meterIds = c.conditions.meterIds;
   if (!meterIds?.length) return true;
   if (line.meterId === null) return false;
   return meterIds.includes(line.meterId);
}

type MeteredFold = {
   creditPool: number;
   total: Money;
   billable: number;
   chunks: ModifierApplied[][];
};

function consumeCredits(
   used: string,
   creditPool: number,
): { remaining: string; consumed: number } {
   if (creditPool <= 0) return { remaining: used, consumed: 0 };
   const usedNum = Number(used);
   const consumed = Math.min(creditPool, usedNum);
   const remaining = (usedNum - consumed).toString();
   return { remaining, consumed };
}

function stepMeteredDay(
   acc: MeteredFold,
   dow: number,
   used: string,
   unit: Money,
   surcharges: PricingCoupon[],
): MeteredFold {
   if (used === "0" || used === "0.0") return acc;
   const { remaining, consumed } = consumeCredits(used, acc.creditPool);
   const creditPool = acc.creditPool - consumed;
   if (remaining === "0" || remaining === "0.0") return { ...acc, creditPool };
   const remainingNum = Number(remaining);
   const bucket = bucketWithSurcharges(
      multiply(unit, remaining),
      surcharges,
      dow,
      remainingNum,
   );
   return {
      creditPool,
      total: add(acc.total, bucket.value),
      billable: acc.billable + remainingNum,
      chunks: [...acc.chunks, bucket.modifiers],
   };
}

function findCreditAmount(benefits: PricingBenefit[], meterId: string): number {
   const credit = benefits.find(
      (b) => b.type === "credits" && b.meterId === meterId,
   );
   if (credit === undefined) return 0;
   if (credit.creditAmount === null) return 0;
   return credit.creditAmount;
}

function sortedDays(usage: Record<string, string>): number[] {
   return Object.keys(usage)
      .map(Number)
      .sort((a, b) => a - b);
}

function foldMeteredUsage(
   unit: Money,
   usage: Record<string, string>,
   creditAmount: number,
   surcharges: PricingCoupon[],
): MeteredFold {
   const seed: MeteredFold = {
      creditPool: creditAmount,
      total: ZERO,
      billable: 0,
      chunks: [],
   };
   return sortedDays(usage).reduce((acc, dow) => {
      const used = usage[dow];
      if (used === undefined) return acc;
      return stepMeteredDay(acc, dow, used, unit, surcharges);
   }, seed);
}

type StrategyArgs = {
   line: PricingLine;
   unit: Money;
   benefits: PricingBenefit[];
   surcharges: PricingCoupon[];
   discounts: PricingCoupon[];
};

type LineStrategy = (args: StrategyArgs) => LineComputation;

function isMeteredUsage(line: PricingLine): line is PricingLine & {
   meterId: string;
   usageByDayOfWeek: Record<string, string>;
} {
   if (line.priceType !== "metered") return false;
   if (line.meterId === null) return false;
   if (line.usageByDayOfWeek === undefined) return false;
   return true;
}

const flatStrategy: LineStrategy = ({ line, unit, surcharges, discounts }) => {
   const out = pipe(
      startPipe(multiply(unit, line.quantity)),
      stepLineSurcharges(surcharges, line.quantity),
      stepCap(line.priceCap),
      stepLineDiscounts(discounts, line.quantity),
   );
   return {
      priceId: line.priceId,
      meterId: line.meterId,
      billableQuantity: line.quantity,
      subtotal: out.value,
      modifiers: flattenChunks(out.chunks),
   };
};

const meteredStrategy: LineStrategy = (args) => {
   const { line, unit, benefits, surcharges, discounts } = args;
   if (!isMeteredUsage(line)) return flatStrategy(args);
   const credit = findCreditAmount(benefits, line.meterId);
   const fold = foldMeteredUsage(
      unit,
      line.usageByDayOfWeek,
      credit,
      surcharges,
   );
   const out = pipe(
      { value: fold.total, chunks: fold.chunks },
      stepCap(line.priceCap),
      stepLineDiscounts(discounts, fold.billable),
   );
   return {
      priceId: line.priceId,
      meterId: line.meterId,
      billableQuantity: fold.billable,
      subtotal: out.value,
      modifiers: flattenChunks(out.chunks),
   };
};

const strategies: Record<PricingLine["priceType"], LineStrategy> = {
   metered: meteredStrategy,
   flat: flatStrategy,
   per_unit: flatStrategy,
};

export function computeLineWithIndex(
   line: PricingLine,
   benefits: PricingBenefit[],
   idx: CouponIndex,
   ctx: PricingContext,
): LineComputation {
   const applicable = lookupApplicable(idx, line.priceId, line.meterId).filter(
      (c) => matchesPlan(c, ctx) && matchesMeter(c, line),
   );
   const surcharges = applicable.filter((c) => c.direction === "surcharge");
   const discounts = applicable.filter((c) => c.direction === "discount");
   const unit = of(line.unitPrice, "BRL");
   return strategies[line.priceType]({
      line,
      unit,
      benefits,
      surcharges,
      discounts,
   });
}
