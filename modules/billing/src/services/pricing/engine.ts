import {
   add,
   of,
   subtract,
   toMajorUnitsString,
   type Money,
} from "@f-o-t/money";
import { err, ok, type Result } from "neverthrow";
import { z } from "zod";
import { WebAppError } from "@core/logging/errors";
import {
   buildCouponIndex,
   clampPositive,
   InvoiceCouponSchema,
   percentOf,
   PricingCouponSchema,
   type InvoiceCoupon,
   type ModifierApplied,
} from "@modules/billing/services/pricing/coupons";
import {
   computeLineWithIndex,
   PricingBenefitSchema,
   PricingContextSchema,
   PricingLineSchema,
   type LineComputation,
   type PricingLine,
} from "@modules/billing/services/pricing/lines";

export const ComputeLineInputSchema = z.object({
   line: PricingLineSchema,
   benefits: z.array(PricingBenefitSchema),
   coupons: z.array(PricingCouponSchema),
   context: PricingContextSchema,
});

export const ComputeInvoiceInputSchema = z.object({
   lines: z.array(PricingLineSchema),
   benefits: z.array(PricingBenefitSchema),
   lineCoupons: z.array(PricingCouponSchema),
   invoiceCoupon: InvoiceCouponSchema.nullable(),
   redemptionCount: z.number().int().nonnegative(),
   context: PricingContextSchema,
});

export type ComputeLineInput = z.infer<typeof ComputeLineInputSchema>;
export type ComputeInvoiceInput = z.infer<typeof ComputeInvoiceInputSchema>;

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

const ZERO_BRL: Money = of("0", "BRL");

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
   if (coupon.type === "percent") return percentOf(subtotal, coupon.amount);
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

const NO_COUPON: CouponResolution = { discount: ZERO_BRL, snapshot: null };

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
      ZERO_BRL,
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
