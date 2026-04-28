import { describe, expect, it } from "vitest";
import { toMajorUnitsString } from "@f-o-t/money";
import {
   computeLine,
   type PricingBenefit,
   type PricingCoupon,
   type PricingContext,
   type PricingLine,
} from "../../src/services/pricing-engine";

const SUNDAY = 0;
const MONDAY = 1;
const SATURDAY = 6;

const meterSalaPriv = "00000000-0000-0000-0000-000000000001";
const meterAreaColetiva = "00000000-0000-0000-0000-000000000002";
const planOuro = "00000000-0000-0000-0000-000000001111";
const planBronze = "00000000-0000-0000-0000-000000002222";

const ctxNoPlan: PricingContext = { activePlanServiceIds: [] };
const ctxOuro: PricingContext = { activePlanServiceIds: [planOuro] };
const ctxBronze: PricingContext = { activePlanServiceIds: [planBronze] };

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

const linePrivHora: PricingLine = {
   priceId: "price-priv-hora",
   priceName: "Sala Privativa Hora",
   priceType: "metered",
   meterId: meterSalaPriv,
   unitPrice: "80",
   priceCap: null,
   quantity: 0,
   usageByDayOfWeek: {},
};

describe("pricing-engine", () => {
   it("metered sem coupons sem credits = base * qty", () => {
      const r = computeLine(
         { ...linePrivHora, usageByDayOfWeek: { [MONDAY]: 3 } },
         [],
         [],
         ctxNoPlan,
      );
      expect(toMajorUnitsString(r.subtotal)).toBe("240.00");
      expect(r.billableQuantity).toBe(3);
   });

   it("sábado + 20% surcharge sem plano: 1h sala priv = 96", () => {
      const r = computeLine(
         { ...linePrivHora, usageByDayOfWeek: { [SATURDAY]: 1 } },
         [],
         [couponSurchargeSat(meterSalaPriv, "20")],
         ctxNoPlan,
      );
      expect(toMajorUnitsString(r.subtotal)).toBe("96.00");
   });

   it("sábado surcharge não aplica em segunda", () => {
      const r = computeLine(
         { ...linePrivHora, usageByDayOfWeek: { [MONDAY]: 1 } },
         [],
         [couponSurchargeSat(meterSalaPriv, "20")],
         ctxNoPlan,
      );
      expect(toMajorUnitsString(r.subtotal)).toBe("80.00");
   });

   it("Bronze 4h sala priv: 3h segunda totalmente coberta = 0", () => {
      const benefits: PricingBenefit[] = [
         { type: "credits", meterId: meterSalaPriv, creditAmount: 4 },
      ];
      const r = computeLine(
         { ...linePrivHora, usageByDayOfWeek: { [MONDAY]: 3 } },
         benefits,
         [],
         ctxBronze,
      );
      expect(toMajorUnitsString(r.subtotal)).toBe("0.00");
      expect(r.billableQuantity).toBe(0);
   });

   it("Bronze 4h sala priv: 3h seg + 2h sáb → 1h sáb cobrada com +20% = 96", () => {
      const benefits: PricingBenefit[] = [
         { type: "credits", meterId: meterSalaPriv, creditAmount: 4 },
      ];
      const r = computeLine(
         {
            ...linePrivHora,
            usageByDayOfWeek: { [MONDAY]: 3, [SATURDAY]: 2 },
         },
         benefits,
         [couponSurchargeSat(meterSalaPriv, "20")],
         ctxBronze,
      );
      expect(toMajorUnitsString(r.subtotal)).toBe("96.00");
      expect(r.billableQuantity).toBe(1);
   });

   it("Ouro -20% sala priv 1h segunda = 64", () => {
      const r = computeLine(
         { ...linePrivHora, usageByDayOfWeek: { [MONDAY]: 1 } },
         [],
         [couponDiscountPlan(meterSalaPriv, "20", planOuro)],
         ctxOuro,
      );
      expect(toMajorUnitsString(r.subtotal)).toBe("64.00");
   });

   it("Ouro -20% NÃO aplica sem plano ativo", () => {
      const r = computeLine(
         { ...linePrivHora, usageByDayOfWeek: { [MONDAY]: 1 } },
         [],
         [couponDiscountPlan(meterSalaPriv, "20", planOuro)],
         ctxNoPlan,
      );
      expect(toMajorUnitsString(r.subtotal)).toBe("80.00");
   });

   it("Ouro + sábado: surcharge primeiro, discount depois. 1h = 80*1.20*0.80 = 76.80", () => {
      const r = computeLine(
         { ...linePrivHora, usageByDayOfWeek: { [SATURDAY]: 1 } },
         [],
         [
            couponSurchargeSat(meterSalaPriv, "20"),
            couponDiscountPlan(meterSalaPriv, "20", planOuro),
         ],
         ctxOuro,
      );
      expect(toMajorUnitsString(r.subtotal)).toBe("76.80");
   });

   it("non-metered: flat com discount", () => {
      const lineFlat: PricingLine = {
         priceId: "p-flat",
         priceName: "Mensalidade",
         priceType: "flat",
         meterId: null,
         unitPrice: "100",
         priceCap: null,
         quantity: 1,
      };
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
      const r = computeLine(lineFlat, [], [cup], ctxNoPlan);
      expect(toMajorUnitsString(r.subtotal)).toBe("90.00");
   });

   it("scope=price: aplica só no priceId match", () => {
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
      const r = computeLine(
         { ...linePrivHora, usageByDayOfWeek: { [MONDAY]: 1 } },
         [],
         [cup],
         ctxNoPlan,
      );
      expect(toMajorUnitsString(r.subtotal)).toBe("80.00");
   });

   it("priceCap limita subtotal antes de discount", () => {
      const r = computeLine(
         {
            ...linePrivHora,
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

   it("dia sem dayOfWeek conditions: surcharge aplica todos os dias", () => {
      const cup: PricingCoupon = {
         id: "c1",
         code: "TAX",
         scope: "meter",
         priceId: null,
         meterId: meterSalaPriv,
         direction: "surcharge",
         type: "percent",
         amount: "10",
         conditions: {},
      };
      const r = computeLine(
         { ...linePrivHora, usageByDayOfWeek: { [SUNDAY]: 1, [MONDAY]: 1 } },
         [],
         [cup],
         ctxNoPlan,
      );
      expect(toMajorUnitsString(r.subtotal)).toBe("176.00");
   });
});
