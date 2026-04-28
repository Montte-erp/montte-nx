import { bench, describe } from "vitest";
import {
   computeInvoice,
   type ComputeInvoiceInput,
   type PricingCoupon,
   type PricingLine,
} from "../../src/services/pricing-engine";

function makeLine(i: number): PricingLine {
   const meterId = `00000000-0000-0000-0000-${String(i).padStart(12, "0")}`;
   return {
      priceId: `price-${i}`,
      priceName: `Service ${i}`,
      priceType: "metered",
      meterId,
      unitPrice: "80",
      priceCap: null,
      quantity: 0,
      usageByDayOfWeek: {
         "0": 1,
         "1": 2,
         "2": 1,
         "3": 3,
         "4": 2,
         "5": 1,
         "6": 4,
      },
   };
}

function makeMeterCoupon(
   i: number,
   dir: "discount" | "surcharge",
): PricingCoupon {
   const meterId = `00000000-0000-0000-0000-${String(i).padStart(12, "0")}`;
   return {
      id: `cup-${dir}-${i}`,
      code: `C${i}`,
      scope: "meter",
      priceId: null,
      meterId,
      direction: dir,
      type: "percent",
      amount: "10",
      conditions: { dayOfWeek: i % 2 === 0 ? [6] : undefined },
   };
}

function makePriceCoupon(i: number): PricingCoupon {
   return {
      id: `cup-price-${i}`,
      code: `P${i}`,
      scope: "price",
      priceId: `price-${i}`,
      meterId: null,
      direction: "discount",
      type: "percent",
      amount: "5",
      conditions: {},
   };
}

function makeTeamCoupon(i: number): PricingCoupon {
   return {
      id: `cup-team-${i}`,
      code: `T${i}`,
      scope: "team",
      priceId: null,
      meterId: null,
      direction: "discount",
      type: "fixed",
      amount: "1",
      conditions: {},
   };
}

function makeInput(
   lineCount: number,
   couponCount: number,
): ComputeInvoiceInput {
   const lines = Array.from({ length: lineCount }, (_, i) => makeLine(i));
   const lineCoupons: PricingCoupon[] = [];
   for (let i = 0; i < couponCount; i++) {
      const mod = i % 4;
      if (mod === 0)
         lineCoupons.push(makeMeterCoupon(i % lineCount, "surcharge"));
      else if (mod === 1)
         lineCoupons.push(makeMeterCoupon(i % lineCount, "discount"));
      else if (mod === 2) lineCoupons.push(makePriceCoupon(i % lineCount));
      else lineCoupons.push(makeTeamCoupon(i));
   }
   return {
      lines,
      benefits: [],
      lineCoupons,
      invoiceCoupon: null,
      redemptionCount: 0,
      context: { activePlanServiceIds: [] },
   };
}

const small = makeInput(10, 20);
const medium = makeInput(50, 100);
const large = makeInput(200, 500);
const xlarge = makeInput(500, 2000);

describe("computeInvoice perf", () => {
   bench("10 lines x 20 coupons", () => {
      const r = computeInvoice(small);
      if (r.isErr()) throw r.error;
   });

   bench("50 lines x 100 coupons", () => {
      const r = computeInvoice(medium);
      if (r.isErr()) throw r.error;
   });

   bench("200 lines x 500 coupons", () => {
      const r = computeInvoice(large);
      if (r.isErr()) throw r.error;
   });

   bench("500 lines x 2000 coupons", () => {
      const r = computeInvoice(xlarge);
      if (r.isErr()) throw r.error;
   });
});

describe("computeInvoice scaling — coupon dimension", () => {
   const fixedLines = 50;
   const inputs = [10, 100, 500, 2000].map((c) => makeInput(fixedLines, c));

   bench(`${fixedLines} lines x 10 coupons`, () => {
      const r = computeInvoice(inputs[0]!);
      if (r.isErr()) throw r.error;
   });
   bench(`${fixedLines} lines x 100 coupons`, () => {
      const r = computeInvoice(inputs[1]!);
      if (r.isErr()) throw r.error;
   });
   bench(`${fixedLines} lines x 500 coupons`, () => {
      const r = computeInvoice(inputs[2]!);
      if (r.isErr()) throw r.error;
   });
   bench(`${fixedLines} lines x 2000 coupons`, () => {
      const r = computeInvoice(inputs[3]!);
      if (r.isErr()) throw r.error;
   });
});
