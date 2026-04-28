import {
   add,
   greaterThan,
   multiply,
   of,
   percentage,
   subtract,
   zero,
   type Money,
} from "@f-o-t/money";

export type PricingLine = {
   priceId: string;
   priceName: string;
   priceType: "flat" | "per_unit" | "metered";
   meterId: string | null;
   unitPrice: string;
   priceCap: string | null;
   quantity: number;
   usageByDayOfWeek?: Record<number, number>;
};

export type PricingBenefit = {
   type: string;
   meterId: string | null;
   creditAmount: number | null;
};

export type PricingCoupon = {
   id: string;
   code: string;
   scope: "team" | "price" | "meter";
   priceId: string | null;
   meterId: string | null;
   direction: "discount" | "surcharge";
   type: "percent" | "fixed";
   amount: string;
   conditions: {
      dayOfWeek?: number[];
      meterIds?: string[];
      planServiceIds?: string[];
   };
};

export type PricingContext = {
   activePlanServiceIds: string[];
};

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

function matchesPlan(c: PricingCoupon, ctx: PricingContext): boolean {
   const ids = c.conditions.planServiceIds;
   if (!ids || ids.length === 0) return true;
   return ids.some((id) => ctx.activePlanServiceIds.includes(id));
}

function matchesMeter(c: PricingCoupon, line: PricingLine): boolean {
   const meterIds = c.conditions.meterIds;
   if (!meterIds || meterIds.length === 0) return true;
   return line.meterId != null && meterIds.includes(line.meterId);
}

function appliesToLine(c: PricingCoupon, line: PricingLine): boolean {
   if (c.scope === "team") return true;
   if (c.scope === "price") return c.priceId === line.priceId;
   if (c.scope === "meter") return c.meterId === line.meterId;
   return false;
}

function dayMatches(c: PricingCoupon, dow: number): boolean {
   const days = c.conditions.dayOfWeek;
   if (!days || days.length === 0) return true;
   return days.includes(dow);
}

function applyModifier(base: Money, c: PricingCoupon, quantity: number): Money {
   const isPercent = c.type === "percent";
   const delta = isPercent
      ? percentage(base, Number(c.amount))
      : multiply(of(c.amount, "BRL"), quantity);
   return c.direction === "surcharge"
      ? add(base, delta)
      : subtract(base, delta);
}

function clampPositive(m: Money): Money {
   return greaterThan(m, zero("BRL")) ? m : zero("BRL");
}

export function computeLine(
   line: PricingLine,
   benefits: PricingBenefit[],
   coupons: PricingCoupon[],
   ctx: PricingContext,
): LineComputation {
   const unit = of(line.unitPrice, "BRL");
   const applicable = coupons.filter(
      (c) =>
         appliesToLine(c, line) && matchesPlan(c, ctx) && matchesMeter(c, line),
   );
   const surcharges = applicable.filter((c) => c.direction === "surcharge");
   const discounts = applicable.filter((c) => c.direction === "discount");
   const modifiers: ModifierApplied[] = [];

   if (line.priceType === "metered" && line.meterId && line.usageByDayOfWeek) {
      const credit = benefits.find(
         (b) => b.type === "credits" && b.meterId === line.meterId,
      );
      let creditPool = credit?.creditAmount ?? 0;

      const dows = Object.keys(line.usageByDayOfWeek)
         .map(Number)
         .sort((a, b) => a - b);

      let lineTotal = zero("BRL");
      let billable = 0;

      for (const dow of dows) {
         const used = line.usageByDayOfWeek[dow] ?? 0;
         if (used <= 0) continue;
         const consumed = Math.min(creditPool, used);
         creditPool -= consumed;
         const remaining = used - consumed;
         if (remaining <= 0) continue;
         billable += remaining;

         let bucket = multiply(unit, remaining);
         for (const s of surcharges) {
            if (!dayMatches(s, dow)) continue;
            bucket = applyModifier(bucket, s, remaining);
            modifiers.push({
               couponId: s.id,
               code: s.code,
               direction: "surcharge",
               amount: s.amount,
               appliedTo: "bucket",
               dayOfWeek: dow,
            });
         }
         lineTotal = add(lineTotal, bucket);
      }

      if (line.priceCap != null) {
         const cap = of(line.priceCap, "BRL");
         if (greaterThan(lineTotal, cap)) lineTotal = cap;
      }

      for (const d of discounts) {
         if (d.conditions.dayOfWeek?.length) continue;
         lineTotal = clampPositive(applyModifier(lineTotal, d, billable));
         modifiers.push({
            couponId: d.id,
            code: d.code,
            direction: "discount",
            amount: d.amount,
            appliedTo: "line",
         });
      }

      return {
         priceId: line.priceId,
         meterId: line.meterId,
         billableQuantity: billable,
         subtotal: lineTotal,
         modifiers,
      };
   }

   let base = multiply(unit, line.quantity);
   if (line.priceCap != null) {
      const cap = of(line.priceCap, "BRL");
      if (greaterThan(base, cap)) base = cap;
   }
   for (const s of surcharges) {
      if (s.conditions.dayOfWeek?.length) continue;
      base = applyModifier(base, s, line.quantity);
      modifiers.push({
         couponId: s.id,
         code: s.code,
         direction: "surcharge",
         amount: s.amount,
         appliedTo: "line",
      });
   }
   for (const d of discounts) {
      if (d.conditions.dayOfWeek?.length) continue;
      base = clampPositive(applyModifier(base, d, line.quantity));
      modifiers.push({
         couponId: d.id,
         code: d.code,
         direction: "discount",
         amount: d.amount,
         appliedTo: "line",
      });
   }

   return {
      priceId: line.priceId,
      meterId: line.meterId,
      billableQuantity: line.quantity,
      subtotal: base,
      modifiers,
   };
}
