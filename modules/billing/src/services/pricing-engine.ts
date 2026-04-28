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

type PriceType = PricingLine["priceType"];

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

const ZERO = zero("BRL");

type CouponIndex = {
   team: PricingCoupon[];
   byPrice: Map<string, PricingCoupon[]>;
   byMeter: Map<string, PricingCoupon[]>;
};

function pushIntoMap<K, V>(map: Map<K, V[]>, key: K, value: V): void {
   const bucket = map.get(key);
   if (bucket === undefined) {
      map.set(key, [value]);
      return;
   }
   bucket.push(value);
}

function buildCouponIndex(coupons: PricingCoupon[]): CouponIndex {
   const idx: CouponIndex = {
      team: [],
      byPrice: new Map(),
      byMeter: new Map(),
   };
   for (const c of coupons) {
      if (c.scope === "team") {
         idx.team.push(c);
         continue;
      }
      if (c.scope === "price" && c.priceId !== null) {
         pushIntoMap(idx.byPrice, c.priceId, c);
         continue;
      }
      if (c.scope === "meter" && c.meterId !== null) {
         pushIntoMap(idx.byMeter, c.meterId, c);
      }
   }
   return idx;
}

function lookupApplicable(
   idx: CouponIndex,
   line: PricingLine,
): PricingCoupon[] {
   const fromPrice = idx.byPrice.get(line.priceId);
   const fromMeter =
      line.meterId === null ? undefined : idx.byMeter.get(line.meterId);
   if (fromPrice === undefined && fromMeter === undefined) return idx.team;
   const out: PricingCoupon[] = idx.team.slice();
   if (fromPrice !== undefined) out.push(...fromPrice);
   if (fromMeter !== undefined) out.push(...fromMeter);
   return out;
}

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

function dayMatches(c: PricingCoupon, dow: number): boolean {
   const days = c.conditions.dayOfWeek;
   if (!days?.length) return true;
   return days.includes(dow);
}

function isLineLevel(c: PricingCoupon): boolean {
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
   if (greaterThan(m, ZERO)) return m;
   return ZERO;
}

function flattenChunks(chunks: ModifierApplied[][]): ModifierApplied[] {
   return chunks.flat();
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

type Pipe = { value: Money; chunks: ModifierApplied[][] };
type Step = (p: Pipe) => Pipe;

function startPipe(value: Money): Pipe {
   return { value, chunks: [] };
}

function pipe(init: Pipe, ...steps: Step[]): Pipe {
   return steps.reduce((p, step) => step(p), init);
}

function stepCap(cap: string | null): Step {
   if (cap === null) return identity;
   const capped = of(cap, "BRL");
   return (p) => {
      if (greaterThan(p.value, capped))
         return { value: capped, chunks: p.chunks };
      return p;
   };
}

function identity(p: Pipe): Pipe {
   return p;
}

function stepLineSurcharges(
   surcharges: PricingCoupon[],
   quantity: number,
): Step {
   const applicable = surcharges.filter(isLineLevel);
   if (applicable.length === 0) return identity;
   return (p) => {
      const value = applicable.reduce(
         (acc, s) => applyModifier(acc, s, quantity),
         p.value,
      );
      const mods = applicable.map((s) => toModifier(s, "line"));
      return { value, chunks: [...p.chunks, mods] };
   };
}

function stepLineDiscounts(discounts: PricingCoupon[], quantity: number): Step {
   const applicable = discounts.filter(isLineLevel);
   if (applicable.length === 0) return identity;
   return (p) => {
      const value = applicable.reduce(
         (acc, d) => clampPositive(applyModifier(acc, d, quantity)),
         p.value,
      );
      const mods = applicable.map((d) => toModifier(d, "line"));
      return { value, chunks: [...p.chunks, mods] };
   };
}

type DayBucket = { value: Money; modifiers: ModifierApplied[] };

function bucketWithSurcharges(
   base: Money,
   surcharges: PricingCoupon[],
   dow: number,
   quantity: number,
): DayBucket {
   const applicable = surcharges.filter((s) => dayMatches(s, dow));
   if (applicable.length === 0) return { value: base, modifiers: [] };
   const value = applicable.reduce(
      (acc, s) => applyModifier(acc, s, quantity),
      base,
   );
   const modifiers = applicable.map((s) => toModifier(s, "bucket", dow));
   return { value, modifiers };
}

type MeteredFold = {
   creditPool: number;
   total: Money;
   billable: number;
   chunks: ModifierApplied[][];
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
   const creditPool = acc.creditPool - consumed;
   if (remaining <= 0) return { ...acc, creditPool };
   const bucket = bucketWithSurcharges(
      multiply(unit, remaining),
      surcharges,
      dow,
      remaining,
   );
   return {
      creditPool,
      total: add(acc.total, bucket.value),
      billable: acc.billable + remaining,
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

function sortedDays(usage: Record<string, number>): number[] {
   return Object.keys(usage)
      .map(Number)
      .sort((a, b) => a - b);
}

function foldMeteredUsage(
   unit: Money,
   usage: Record<string, number>,
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
   usageByDayOfWeek: Record<string, number>;
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

const strategies: Record<PriceType, LineStrategy> = {
   metered: meteredStrategy,
   flat: flatStrategy,
   per_unit: flatStrategy,
};

function computeLineWithIndex(
   line: PricingLine,
   benefits: PricingBenefit[],
   idx: CouponIndex,
   ctx: PricingContext,
): LineComputation {
   const applicable = lookupApplicable(idx, line).filter(
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

type CouponResolution = {
   discount: Money;
   snapshot: InvoiceCouponSnapshot | null;
};

const NO_COUPON: CouponResolution = { discount: ZERO, snapshot: null };

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

function toLineItem(line: PricingLine, c: LineComputation): InvoiceLineItem {
   return {
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
   const idx = buildCouponIndex(input.coupons);
   return computeLineWithIndex(input.line, input.benefits, idx, input.context);
}

function buildInvoice(input: ComputeInvoiceInput): InvoiceComputation {
   const idx = buildCouponIndex(input.lineCoupons);
   const computations = input.lines.map((line) => ({
      line,
      computation: computeLineWithIndex(
         line,
         input.benefits,
         idx,
         input.context,
      ),
   }));

   const subtotal = computations.reduce(
      (acc, { computation }) => add(acc, computation.subtotal),
      ZERO,
   );

   const { discount, snapshot } = resolveInvoiceCoupon(
      input.invoiceCoupon,
      input.redemptionCount,
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

export function computeLine(
   input: ComputeLineInput,
): Result<LineComputation, WebAppError> {
   return parseInput(ComputeLineInputSchema, input).map(buildLine);
}

export function computeInvoice(
   input: ComputeInvoiceInput,
): Result<InvoiceComputation, WebAppError> {
   return parseInput(ComputeInvoiceInputSchema, input).map(buildInvoice);
}
