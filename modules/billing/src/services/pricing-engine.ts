import {
   add,
   greaterThan,
   multiply,
   of,
   percentage,
   subtract,
   toMajorUnitsString,
   zero,
   type Money,
} from "@f-o-t/money";
import { WebAppError } from "@core/logging/errors";
import { err, ok, type Result } from "neverthrow";
import { z } from "zod";

const PricingCouponSchema = z.object({
   id: z.string(),
   code: z.string(),
   scope: z.enum(["team", "price", "meter"]),
   priceId: z.string().nullable(),
   meterId: z.string().nullable(),
   direction: z.enum(["discount", "surcharge"]),
   type: z.enum(["percent", "fixed"]),
   amount: z.string(),
   conditions: z.object({
      dayOfWeek: z.array(z.number().int().min(0).max(6)).optional(),
      meterIds: z.array(z.string()).optional(),
      planServiceIds: z.array(z.string()).optional(),
   }),
});

const PricingBenefitSchema = z.object({
   type: z.string(),
   meterId: z.string().nullable(),
   creditAmount: z.number().int().nonnegative().nullable(),
});

const PricingLineSchema = z.object({
   priceId: z.string(),
   priceName: z.string(),
   priceType: z.enum(["flat", "per_unit", "metered"]),
   meterId: z.string().nullable(),
   unitPrice: z.string(),
   priceCap: z.string().nullable(),
   quantity: z.number().nonnegative(),
   usageByDayOfWeek: z.record(z.string(), z.number().nonnegative()).optional(),
});

const PricingContextSchema = z.object({
   activePlanServiceIds: z.array(z.string()),
});

const InvoiceCouponSchema = z.object({
   code: z.string(),
   type: z.enum(["percent", "fixed"]),
   amount: z.string(),
   duration: z.enum(["once", "repeating", "forever"]),
   durationMonths: z.number().int().positive().nullable(),
});

const ComputeLineInputSchema = z.object({
   line: PricingLineSchema,
   benefits: z.array(PricingBenefitSchema),
   coupons: z.array(PricingCouponSchema),
   context: PricingContextSchema,
});

const ComputeInvoiceInputSchema = z.object({
   lines: z.array(PricingLineSchema),
   benefits: z.array(PricingBenefitSchema),
   lineCoupons: z.array(PricingCouponSchema),
   invoiceCoupon: InvoiceCouponSchema.nullable(),
   redemptionCount: z.number().int().nonnegative(),
   context: PricingContextSchema,
});

export type PricingCoupon = z.infer<typeof PricingCouponSchema>;
export type PricingBenefit = z.infer<typeof PricingBenefitSchema>;
export type PricingLine = z.infer<typeof PricingLineSchema>;
export type PricingContext = z.infer<typeof PricingContextSchema>;
export type InvoiceCoupon = z.infer<typeof InvoiceCouponSchema>;
export type ComputeLineInput = z.infer<typeof ComputeLineInputSchema>;
export type ComputeInvoiceInput = z.infer<typeof ComputeInvoiceInputSchema>;

export type ModifierApplied = {
   couponId: string;
   code: string;
   direction: "discount" | "surcharge";
   amount: string;
   appliedTo: "line" | "bucket";
   dayOfWeek?: number;
};

export type LineComputation = {
   priceId: string;
   meterId: string | null;
   billableQuantity: number;
   subtotal: Money;
   modifiers: ModifierApplied[];
};

export type InvoiceLineItem = {
   priceId: string;
   description: string;
   meterId: string | null;
   quantity: string;
   unitPrice: string;
   subtotal: string;
};

export type InvoiceCouponSnapshot = {
   code: string;
   type: "percent" | "fixed";
   amount: string;
   duration: "once" | "repeating" | "forever";
};

export type InvoiceComputation = {
   lineItems: InvoiceLineItem[];
   subtotal: string;
   discountAmount: string;
   total: string;
   couponSnapshot: InvoiceCouponSnapshot | null;
   modifiers: ModifierApplied[];
};

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

function appliesToLine(c: PricingCoupon, line: PricingLine): boolean {
   if (c.scope === "team") return true;
   if (c.scope === "price") return c.priceId === line.priceId;
   return c.meterId === line.meterId;
}

function dayMatches(c: PricingCoupon, dow: number): boolean {
   const days = c.conditions.dayOfWeek;
   if (!days?.length) return true;
   return days.includes(dow);
}

function isLineLevelDiscount(c: PricingCoupon): boolean {
   return !c.conditions.dayOfWeek?.length;
}

function computeDelta(c: PricingCoupon, base: Money, quantity: number): Money {
   if (c.type === "percent") return percentage(base, Number(c.amount));
   return multiply(of(c.amount, "BRL"), quantity);
}

function applyModifier(base: Money, c: PricingCoupon, quantity: number): Money {
   const delta = computeDelta(c, base, quantity);
   if (c.direction === "surcharge") return add(base, delta);
   return subtract(base, delta);
}

function clampPositive(m: Money): Money {
   if (greaterThan(m, zero("BRL"))) return m;
   return zero("BRL");
}

function capMoney(m: Money, cap: string | null): Money {
   if (cap === null) return m;
   const capped = of(cap, "BRL");
   if (greaterThan(m, capped)) return capped;
   return m;
}

function toModifier(
   c: PricingCoupon,
   appliedTo: "line" | "bucket",
   dayOfWeek?: number,
): ModifierApplied {
   const base: ModifierApplied = {
      couponId: c.id,
      code: c.code,
      direction: c.direction,
      amount: c.amount,
      appliedTo,
   };
   if (dayOfWeek === undefined) return base;
   return { ...base, dayOfWeek };
}

type Bucket = { value: Money; modifiers: ModifierApplied[] };

function applyBucketSurcharges(
   base: Money,
   surcharges: PricingCoupon[],
   dow: number,
   quantity: number,
): Bucket {
   return surcharges
      .filter((s) => dayMatches(s, dow))
      .reduce<Bucket>(
         (acc, s) => ({
            value: applyModifier(acc.value, s, quantity),
            modifiers: [...acc.modifiers, toModifier(s, "bucket", dow)],
         }),
         { value: base, modifiers: [] },
      );
}

function applyLineSurcharges(
   base: Money,
   surcharges: PricingCoupon[],
   quantity: number,
): Bucket {
   return surcharges.filter(isLineLevelDiscount).reduce<Bucket>(
      (acc, s) => ({
         value: applyModifier(acc.value, s, quantity),
         modifiers: [...acc.modifiers, toModifier(s, "line")],
      }),
      { value: base, modifiers: [] },
   );
}

function applyLineDiscounts(
   base: Money,
   discounts: PricingCoupon[],
   quantity: number,
): Bucket {
   return discounts.filter(isLineLevelDiscount).reduce<Bucket>(
      (acc, d) => ({
         value: clampPositive(applyModifier(acc.value, d, quantity)),
         modifiers: [...acc.modifiers, toModifier(d, "line")],
      }),
      { value: base, modifiers: [] },
   );
}

type MeteredFold = {
   creditPool: number;
   lineTotal: Money;
   billable: number;
   modifiers: ModifierApplied[];
};

function stepMeteredDay(
   acc: MeteredFold,
   dow: number,
   used: number,
   unit: Money,
   surcharges: PricingCoupon[],
): MeteredFold {
   if (used <= 0) return acc;
   const consumed = Math.min(acc.creditPool, used);
   const remaining = used - consumed;
   if (remaining <= 0) {
      return { ...acc, creditPool: acc.creditPool - consumed };
   }
   const bucket = applyBucketSurcharges(
      multiply(unit, remaining),
      surcharges,
      dow,
      remaining,
   );
   return {
      creditPool: acc.creditPool - consumed,
      lineTotal: add(acc.lineTotal, bucket.value),
      billable: acc.billable + remaining,
      modifiers: [...acc.modifiers, ...bucket.modifiers],
   };
}

function foldMeteredUsage(
   line: PricingLine,
   usage: Record<string, number>,
   creditAmount: number,
   surcharges: PricingCoupon[],
): MeteredFold {
   const unit = of(line.unitPrice, "BRL");
   const dows = Object.keys(usage)
      .map(Number)
      .sort((a, b) => a - b);

   const seed: MeteredFold = {
      creditPool: creditAmount,
      lineTotal: zero("BRL"),
      billable: 0,
      modifiers: [],
   };

   return dows.reduce((acc, dow) => {
      const used = usage[dow];
      if (used === undefined) return acc;
      return stepMeteredDay(acc, dow, used, unit, surcharges);
   }, seed);
}

function findCreditAmount(benefits: PricingBenefit[], meterId: string): number {
   const credit = benefits.find(
      (b) => b.type === "credits" && b.meterId === meterId,
   );
   if (!credit) return 0;
   if (credit.creditAmount === null) return 0;
   return credit.creditAmount;
}

function computeMeteredLine(
   line: PricingLine & {
      meterId: string;
      usageByDayOfWeek: Record<string, number>;
   },
   benefits: PricingBenefit[],
   surcharges: PricingCoupon[],
   discounts: PricingCoupon[],
): LineComputation {
   const credit = findCreditAmount(benefits, line.meterId);
   const fold = foldMeteredUsage(
      line,
      line.usageByDayOfWeek,
      credit,
      surcharges,
   );
   const capped = capMoney(fold.lineTotal, line.priceCap);
   const discounted = applyLineDiscounts(capped, discounts, fold.billable);

   return {
      priceId: line.priceId,
      meterId: line.meterId,
      billableQuantity: fold.billable,
      subtotal: discounted.value,
      modifiers: [...fold.modifiers, ...discounted.modifiers],
   };
}

function computeFlatLine(
   line: PricingLine,
   surcharges: PricingCoupon[],
   discounts: PricingCoupon[],
): LineComputation {
   const base = multiply(of(line.unitPrice, "BRL"), line.quantity);
   const surcharged = applyLineSurcharges(base, surcharges, line.quantity);
   const capped = capMoney(surcharged.value, line.priceCap);
   const discounted = applyLineDiscounts(capped, discounts, line.quantity);

   return {
      priceId: line.priceId,
      meterId: line.meterId,
      billableQuantity: line.quantity,
      subtotal: discounted.value,
      modifiers: [...surcharged.modifiers, ...discounted.modifiers],
   };
}

function isMeteredWithUsage(line: PricingLine): line is PricingLine & {
   meterId: string;
   usageByDayOfWeek: Record<string, number>;
} {
   if (line.priceType !== "metered") return false;
   if (line.meterId === null) return false;
   if (line.usageByDayOfWeek === undefined) return false;
   return true;
}

function filterApplicable(
   coupons: PricingCoupon[],
   line: PricingLine,
   ctx: PricingContext,
): PricingCoupon[] {
   return coupons.filter(
      (c) =>
         appliesToLine(c, line) && matchesPlan(c, ctx) && matchesMeter(c, line),
   );
}

function computeLineUnsafe(
   line: PricingLine,
   benefits: PricingBenefit[],
   coupons: PricingCoupon[],
   ctx: PricingContext,
): LineComputation {
   const applicable = filterApplicable(coupons, line, ctx);
   const surcharges = applicable.filter((c) => c.direction === "surcharge");
   const discounts = applicable.filter((c) => c.direction === "discount");

   if (isMeteredWithUsage(line)) {
      return computeMeteredLine(line, benefits, surcharges, discounts);
   }
   return computeFlatLine(line, surcharges, discounts);
}

function isInvoiceCouponActive(
   coupon: InvoiceCoupon,
   redemptionCount: number,
): boolean {
   if (coupon.duration === "forever") return true;
   if (coupon.duration === "once") return redemptionCount === 0;
   if (coupon.durationMonths === null) return false;
   return redemptionCount < coupon.durationMonths;
}

function computeInvoiceCouponDiscount(
   coupon: InvoiceCoupon,
   subtotal: Money,
): Money {
   if (coupon.type === "percent")
      return percentage(subtotal, Number(coupon.amount));
   return of(coupon.amount, "BRL");
}

function toCouponSnapshot(coupon: InvoiceCoupon): InvoiceCouponSnapshot {
   return {
      code: coupon.code,
      type: coupon.type,
      amount: coupon.amount,
      duration: coupon.duration,
   };
}

function toLineItem(line: PricingLine, c: LineComputation): InvoiceLineItem {
   return {
      priceId: line.priceId,
      description: line.priceName,
      meterId: line.meterId,
      quantity: c.billableQuantity.toFixed(2),
      unitPrice: line.unitPrice,
      subtotal: toMajorUnitsString(c.subtotal),
   };
}

function parseInput<T>(
   schema: z.ZodType<T>,
   input: unknown,
): Result<T, WebAppError> {
   const parsed = schema.safeParse(input);
   if (parsed.success) return ok(parsed.data);
   return err(
      WebAppError.badRequest("Entrada de precificação inválida.", {
         data: { issues: parsed.error.issues },
      }),
   );
}

function buildLine(input: ComputeLineInput): LineComputation {
   return computeLineUnsafe(
      input.line,
      input.benefits,
      input.coupons,
      input.context,
   );
}

export function computeLine(
   input: ComputeLineInput,
): Result<LineComputation, WebAppError> {
   return parseInput(ComputeLineInputSchema, input).map(buildLine);
}

type CouponResolution = {
   discount: Money;
   snapshot: InvoiceCouponSnapshot | null;
};

const NO_COUPON: CouponResolution = { discount: zero("BRL"), snapshot: null };

function resolveInvoiceCoupon(
   coupon: InvoiceCoupon | null,
   redemptionCount: number,
   subtotal: Money,
): CouponResolution {
   if (coupon === null) return NO_COUPON;
   if (!isInvoiceCouponActive(coupon, redemptionCount)) return NO_COUPON;
   return {
      discount: computeInvoiceCouponDiscount(coupon, subtotal),
      snapshot: toCouponSnapshot(coupon),
   };
}

function buildInvoice(input: ComputeInvoiceInput): InvoiceComputation {
   const {
      lines,
      benefits,
      lineCoupons,
      invoiceCoupon,
      redemptionCount,
      context,
   } = input;

   const computations = lines.map((line) => ({
      line,
      computation: computeLineUnsafe(line, benefits, lineCoupons, context),
   }));

   const subtotal = computations.reduce(
      (acc, { computation }) => add(acc, computation.subtotal),
      zero("BRL"),
   );

   const { discount, snapshot } = resolveInvoiceCoupon(
      invoiceCoupon,
      redemptionCount,
      subtotal,
   );

   return {
      lineItems: computations.map(({ line, computation }) =>
         toLineItem(line, computation),
      ),
      subtotal: toMajorUnitsString(subtotal),
      discountAmount: toMajorUnitsString(discount),
      total: toMajorUnitsString(clampPositive(subtract(subtotal, discount))),
      couponSnapshot: snapshot,
      modifiers: computations.flatMap(
         ({ computation }) => computation.modifiers,
      ),
   };
}

export function computeInvoice(
   input: ComputeInvoiceInput,
): Result<InvoiceComputation, WebAppError> {
   return parseInput(ComputeInvoiceInputSchema, input).map(buildInvoice);
}
