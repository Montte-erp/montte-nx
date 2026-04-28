import { describe, expect, it } from "vitest";
import { toMajorUnitsString } from "@f-o-t/money";
import {
   computeInvoice,
   computeLine,
   type ComputeInvoiceInput,
   type InvoiceCoupon,
   type PricingBenefit,
   type PricingContext,
   type PricingCoupon,
   type PricingLine,
} from "../../src/services/pricing-engine";

const SUNDAY = 0;
const MONDAY = 1;
const SATURDAY = 6;

const meterPriv = "00000000-0000-0000-0000-000000000001";
const meterColetiva = "00000000-0000-0000-0000-000000000002";
const planOuro = "00000000-0000-0000-0000-000000001111";
const planBronze = "00000000-0000-0000-0000-000000002222";

const ctxNoPlan: PricingContext = { activePlanServiceIds: [] };
const ctxOuro: PricingContext = { activePlanServiceIds: [planOuro] };
const ctxBronze: PricingContext = { activePlanServiceIds: [planBronze] };

const linePriv: PricingLine = {
   priceId: "price-priv",
   priceName: "Sala Privativa",
   priceType: "metered",
   meterId: meterPriv,
   unitPrice: "80",
   priceCap: null,
   quantity: 0,
   usageByDayOfWeek: {},
};

const lineFlat: PricingLine = {
   priceId: "price-flat",
   priceName: "Mensalidade",
   priceType: "flat",
   meterId: null,
   unitPrice: "100",
   priceCap: null,
   quantity: 1,
};

function couponSurchargeSat(meterId: string, pct: string): PricingCoupon {
   return {
      id: `cup-sab-${meterId}`,
      code: "SAB",
      scope: "meter",
      priceId: null,
      meterId,
      direction: "surcharge",
      type: "percent",
      amount: pct,
      conditions: { dayOfWeek: [SATURDAY] },
   };
}

function couponDiscountPlan(
   meterId: string,
   pct: string,
   subId: string,
): PricingCoupon {
   return {
      id: `cup-plan-${subId}-${meterId}`,
      code: "PLAN",
      scope: "meter",
      priceId: null,
      meterId,
      direction: "discount",
      type: "percent",
      amount: pct,
      conditions: { planServiceIds: [subId] },
   };
}

function unwrap<T, E>(r: {
   isOk(): boolean;
   _unsafeUnwrap(): T;
   _unsafeUnwrapErr(): E;
}): T {
   if (!r.isOk())
      throw new Error(
         `expected ok, got err: ${JSON.stringify(r._unsafeUnwrapErr())}`,
      );
   return r._unsafeUnwrap();
}

function lineCall(
   line: PricingLine,
   benefits: PricingBenefit[],
   coupons: PricingCoupon[],
   ctx: PricingContext,
) {
   const r = computeLine({ line, benefits, coupons, context: ctx });
   return unwrap(r);
}

describe("computeLine — metered", () => {
   it("sem coupons sem credits = base * qty", () => {
      const r = lineCall(
         { ...linePriv, usageByDayOfWeek: { [MONDAY]: 3 } },
         [],
         [],
         ctxNoPlan,
      );
      expect(toMajorUnitsString(r.subtotal)).toBe("240.00");
      expect(r.billableQuantity).toBe(3);
   });

   it("sábado +20% surcharge sem plano: 1h = 96", () => {
      const r = lineCall(
         { ...linePriv, usageByDayOfWeek: { [SATURDAY]: 1 } },
         [],
         [couponSurchargeSat(meterPriv, "20")],
         ctxNoPlan,
      );
      expect(toMajorUnitsString(r.subtotal)).toBe("96.00");
   });

   it("sábado surcharge não aplica em segunda", () => {
      const r = lineCall(
         { ...linePriv, usageByDayOfWeek: { [MONDAY]: 1 } },
         [],
         [couponSurchargeSat(meterPriv, "20")],
         ctxNoPlan,
      );
      expect(toMajorUnitsString(r.subtotal)).toBe("80.00");
   });

   it("Bronze 4h credits: 3h segunda totalmente coberta = 0", () => {
      const benefits: PricingBenefit[] = [
         { type: "credits", meterId: meterPriv, creditAmount: 4 },
      ];
      const r = lineCall(
         { ...linePriv, usageByDayOfWeek: { [MONDAY]: 3 } },
         benefits,
         [],
         ctxBronze,
      );
      expect(toMajorUnitsString(r.subtotal)).toBe("0.00");
      expect(r.billableQuantity).toBe(0);
   });

   it("Bronze 4h: 3h seg + 2h sáb → 1h sáb com +20% = 96", () => {
      const benefits: PricingBenefit[] = [
         { type: "credits", meterId: meterPriv, creditAmount: 4 },
      ];
      const r = lineCall(
         {
            ...linePriv,
            usageByDayOfWeek: { [MONDAY]: 3, [SATURDAY]: 2 },
         },
         benefits,
         [couponSurchargeSat(meterPriv, "20")],
         ctxBronze,
      );
      expect(toMajorUnitsString(r.subtotal)).toBe("96.00");
      expect(r.billableQuantity).toBe(1);
   });

   it("Ouro -20% 1h segunda = 64", () => {
      const r = lineCall(
         { ...linePriv, usageByDayOfWeek: { [MONDAY]: 1 } },
         [],
         [couponDiscountPlan(meterPriv, "20", planOuro)],
         ctxOuro,
      );
      expect(toMajorUnitsString(r.subtotal)).toBe("64.00");
   });

   it("Ouro -20% NÃO aplica sem plano ativo", () => {
      const r = lineCall(
         { ...linePriv, usageByDayOfWeek: { [MONDAY]: 1 } },
         [],
         [couponDiscountPlan(meterPriv, "20", planOuro)],
         ctxNoPlan,
      );
      expect(toMajorUnitsString(r.subtotal)).toBe("80.00");
   });

   it("surcharge antes, discount depois: 80*1.20*0.80 = 76.80", () => {
      const r = lineCall(
         { ...linePriv, usageByDayOfWeek: { [SATURDAY]: 1 } },
         [],
         [
            couponSurchargeSat(meterPriv, "20"),
            couponDiscountPlan(meterPriv, "20", planOuro),
         ],
         ctxOuro,
      );
      expect(toMajorUnitsString(r.subtotal)).toBe("76.80");
   });

   it("priceCap limita subtotal antes de discount", () => {
      const r = lineCall(
         {
            ...linePriv,
            unitPrice: "100",
            priceCap: "150",
            usageByDayOfWeek: { [MONDAY]: 5 },
         },
         [],
         [],
         ctxNoPlan,
      );
      expect(toMajorUnitsString(r.subtotal)).toBe("150.00");
   });

   it("surcharge sem dayOfWeek aplica em todos os dias", () => {
      const cup: PricingCoupon = {
         id: "c1",
         code: "TAX",
         scope: "meter",
         priceId: null,
         meterId: meterPriv,
         direction: "surcharge",
         type: "percent",
         amount: "10",
         conditions: {},
      };
      const r = lineCall(
         { ...linePriv, usageByDayOfWeek: { [SUNDAY]: 1, [MONDAY]: 1 } },
         [],
         [cup],
         ctxNoPlan,
      );
      expect(toMajorUnitsString(r.subtotal)).toBe("176.00");
   });

   it("scope=price aplica só no priceId match", () => {
      const cup: PricingCoupon = {
         id: "c1",
         code: "CUP",
         scope: "price",
         priceId: "outro-price",
         meterId: null,
         direction: "discount",
         type: "percent",
         amount: "50",
         conditions: {},
      };
      const r = lineCall(
         { ...linePriv, usageByDayOfWeek: { [MONDAY]: 1 } },
         [],
         [cup],
         ctxNoPlan,
      );
      expect(toMajorUnitsString(r.subtotal)).toBe("80.00");
   });

   it("scope=meter ignora outros meters", () => {
      const r = lineCall(
         { ...linePriv, usageByDayOfWeek: { [MONDAY]: 1 } },
         [],
         [couponSurchargeSat(meterColetiva, "50")],
         ctxNoPlan,
      );
      expect(toMajorUnitsString(r.subtotal)).toBe("80.00");
   });

   it("creditAmount null = sem créditos", () => {
      const benefits: PricingBenefit[] = [
         { type: "credits", meterId: meterPriv, creditAmount: null },
      ];
      const r = lineCall(
         { ...linePriv, usageByDayOfWeek: { [MONDAY]: 1 } },
         benefits,
         [],
         ctxNoPlan,
      );
      expect(toMajorUnitsString(r.subtotal)).toBe("80.00");
   });

   it("usage 0 não cobra", () => {
      const r = lineCall(
         { ...linePriv, usageByDayOfWeek: { [MONDAY]: 0 } },
         [],
         [],
         ctxNoPlan,
      );
      expect(toMajorUnitsString(r.subtotal)).toBe("0.00");
      expect(r.billableQuantity).toBe(0);
   });

   it("discount levado a zero não fica negativo", () => {
      const cup: PricingCoupon = {
         id: "c1",
         code: "BIG",
         scope: "team",
         priceId: null,
         meterId: null,
         direction: "discount",
         type: "percent",
         amount: "200",
         conditions: {},
      };
      const r = lineCall(
         { ...linePriv, usageByDayOfWeek: { [MONDAY]: 1 } },
         [],
         [cup],
         ctxNoPlan,
      );
      expect(toMajorUnitsString(r.subtotal)).toBe("0.00");
   });

   it("modifiers retornam metadata correto (bucket + line)", () => {
      const r = lineCall(
         { ...linePriv, usageByDayOfWeek: { [SATURDAY]: 1 } },
         [],
         [
            couponSurchargeSat(meterPriv, "20"),
            couponDiscountPlan(meterPriv, "20", planOuro),
         ],
         ctxOuro,
      );
      expect(r.modifiers).toHaveLength(2);
      expect(r.modifiers[0]).toMatchObject({
         direction: "surcharge",
         appliedTo: "bucket",
         dayOfWeek: SATURDAY,
      });
      expect(r.modifiers[1]).toMatchObject({
         direction: "discount",
         appliedTo: "line",
      });
   });
});

describe("computeLine — flat / per_unit", () => {
   it("flat com discount team", () => {
      const cup: PricingCoupon = {
         id: "c1",
         code: "CUP",
         scope: "team",
         priceId: null,
         meterId: null,
         direction: "discount",
         type: "percent",
         amount: "10",
         conditions: {},
      };
      const r = lineCall(lineFlat, [], [cup], ctxNoPlan);
      expect(toMajorUnitsString(r.subtotal)).toBe("90.00");
   });

   it("per_unit qty=3 com fixed discount R$5/unit", () => {
      const line: PricingLine = {
         ...lineFlat,
         priceId: "p-pu",
         priceType: "per_unit",
         unitPrice: "20",
         quantity: 3,
      };
      const cup: PricingCoupon = {
         id: "c1",
         code: "FIX",
         scope: "team",
         priceId: null,
         meterId: null,
         direction: "discount",
         type: "fixed",
         amount: "5",
         conditions: {},
      };
      const r = lineCall(line, [], [cup], ctxNoPlan);
      expect(toMajorUnitsString(r.subtotal)).toBe("45.00");
   });

   it("flat com priceCap aplicado", () => {
      const r = lineCall({ ...lineFlat, priceCap: "60" }, [], [], ctxNoPlan);
      expect(toMajorUnitsString(r.subtotal)).toBe("60.00");
   });

   it("metered priceType mas sem usageByDayOfWeek → fallback flat", () => {
      const line: PricingLine = {
         priceId: "p-met",
         priceName: "X",
         priceType: "metered",
         meterId: meterPriv,
         unitPrice: "80",
         priceCap: null,
         quantity: 2,
      };
      const r = lineCall(line, [], [], ctxNoPlan);
      expect(toMajorUnitsString(r.subtotal)).toBe("160.00");
   });
});

describe("computeLine — input validation", () => {
   it("priceType inválido → err WebAppError BAD_REQUEST", () => {
      const r = computeLine({
         line: {
            ...lineFlat,
            // @ts-expect-error invalid priceType for negative test
            priceType: "weird",
         },
         benefits: [],
         coupons: [],
         context: ctxNoPlan,
      });
      expect(r.isErr()).toBe(true);
      if (r.isErr()) {
         expect(r.error.code).toBe("BAD_REQUEST");
         expect(r.error.message).toBe("Entrada de precificação inválida.");
      }
   });

   it("quantity negativa → err", () => {
      const r = computeLine({
         line: { ...lineFlat, quantity: -1 },
         benefits: [],
         coupons: [],
         context: ctxNoPlan,
      });
      expect(r.isErr()).toBe(true);
   });

   it("dayOfWeek fora de [0..6] → err", () => {
      const bad: PricingCoupon = {
         id: "c",
         code: "X",
         scope: "team",
         priceId: null,
         meterId: null,
         direction: "discount",
         type: "percent",
         amount: "10",
         conditions: { dayOfWeek: [7] },
      };
      const r = computeLine({
         line: lineFlat,
         benefits: [],
         coupons: [bad],
         context: ctxNoPlan,
      });
      expect(r.isErr()).toBe(true);
   });
});

describe("computeInvoice", () => {
   const baseInput: ComputeInvoiceInput = {
      lines: [],
      benefits: [],
      lineCoupons: [],
      invoiceCoupon: null,
      redemptionCount: 0,
      context: ctxNoPlan,
   };

   it("agrega múltiplas lines no subtotal", () => {
      const r = unwrap(
         computeInvoice({
            ...baseInput,
            lines: [
               { ...lineFlat, priceId: "a", unitPrice: "100", quantity: 1 },
               { ...lineFlat, priceId: "b", unitPrice: "50", quantity: 2 },
            ],
         }),
      );
      expect(r.subtotal).toBe("200.00");
      expect(r.total).toBe("200.00");
      expect(r.lineItems).toHaveLength(2);
   });

   it("invoice coupon forever sempre aplica", () => {
      const coupon: InvoiceCoupon = {
         code: "FOR",
         type: "percent",
         amount: "10",
         duration: "forever",
         durationMonths: null,
      };
      const r = unwrap(
         computeInvoice({
            ...baseInput,
            lines: [{ ...lineFlat, unitPrice: "100", quantity: 1 }],
            invoiceCoupon: coupon,
            redemptionCount: 99,
         }),
      );
      expect(r.discountAmount).toBe("10.00");
      expect(r.total).toBe("90.00");
      expect(r.couponSnapshot?.code).toBe("FOR");
   });

   it("invoice coupon once: redemptionCount=0 aplica", () => {
      const coupon: InvoiceCoupon = {
         code: "ONCE",
         type: "percent",
         amount: "20",
         duration: "once",
         durationMonths: null,
      };
      const r = unwrap(
         computeInvoice({
            ...baseInput,
            lines: [{ ...lineFlat, unitPrice: "100", quantity: 1 }],
            invoiceCoupon: coupon,
            redemptionCount: 0,
         }),
      );
      expect(r.total).toBe("80.00");
   });

   it("invoice coupon once: redemptionCount=1 NÃO aplica", () => {
      const coupon: InvoiceCoupon = {
         code: "ONCE",
         type: "percent",
         amount: "20",
         duration: "once",
         durationMonths: null,
      };
      const r = unwrap(
         computeInvoice({
            ...baseInput,
            lines: [{ ...lineFlat, unitPrice: "100", quantity: 1 }],
            invoiceCoupon: coupon,
            redemptionCount: 1,
         }),
      );
      expect(r.discountAmount).toBe("0.00");
      expect(r.total).toBe("100.00");
      expect(r.couponSnapshot).toBeNull();
   });

   it("invoice coupon repeating: respeita durationMonths", () => {
      const coupon: InvoiceCoupon = {
         code: "REP",
         type: "fixed",
         amount: "15",
         duration: "repeating",
         durationMonths: 3,
      };
      const within = unwrap(
         computeInvoice({
            ...baseInput,
            lines: [{ ...lineFlat, unitPrice: "100", quantity: 1 }],
            invoiceCoupon: coupon,
            redemptionCount: 2,
         }),
      );
      expect(within.discountAmount).toBe("15.00");

      const past = unwrap(
         computeInvoice({
            ...baseInput,
            lines: [{ ...lineFlat, unitPrice: "100", quantity: 1 }],
            invoiceCoupon: coupon,
            redemptionCount: 3,
         }),
      );
      expect(past.discountAmount).toBe("0.00");
   });

   it("invoice coupon repeating sem durationMonths → não aplica", () => {
      const coupon: InvoiceCoupon = {
         code: "BAD",
         type: "percent",
         amount: "50",
         duration: "repeating",
         durationMonths: null,
      };
      const r = unwrap(
         computeInvoice({
            ...baseInput,
            lines: [{ ...lineFlat, unitPrice: "100", quantity: 1 }],
            invoiceCoupon: coupon,
            redemptionCount: 0,
         }),
      );
      expect(r.discountAmount).toBe("0.00");
   });

   it("total nunca fica negativo", () => {
      const coupon: InvoiceCoupon = {
         code: "HUGE",
         type: "fixed",
         amount: "9999",
         duration: "forever",
         durationMonths: null,
      };
      const r = unwrap(
         computeInvoice({
            ...baseInput,
            lines: [{ ...lineFlat, unitPrice: "10", quantity: 1 }],
            invoiceCoupon: coupon,
         }),
      );
      expect(r.total).toBe("0.00");
   });

   it("input inválido → err", () => {
      const r = computeInvoice({
         ...baseInput,
         redemptionCount: -1,
      });
      expect(r.isErr()).toBe(true);
   });

   it("modifiers agregados de todas as lines", () => {
      const cup: PricingCoupon = {
         id: "c1",
         code: "CUP",
         scope: "team",
         priceId: null,
         meterId: null,
         direction: "discount",
         type: "percent",
         amount: "10",
         conditions: {},
      };
      const r = unwrap(
         computeInvoice({
            ...baseInput,
            lines: [
               { ...lineFlat, priceId: "a" },
               { ...lineFlat, priceId: "b" },
            ],
            lineCoupons: [cup],
         }),
      );
      expect(r.modifiers).toHaveLength(2);
   });
});
