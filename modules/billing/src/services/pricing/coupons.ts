import {
   add,
   divide,
   greaterThan,
   multiply,
   of,
   subtract,
   zero,
   type Money,
} from "@f-o-t/money";
import { z } from "zod";
import { couponSchema } from "@core/database/schemas/coupons";

const pricingConditionsSchema = z.object({
   dayOfWeek: z.array(z.number().int().min(0).max(6)).optional(),
   meterIds: z.array(z.string()).optional(),
   planServiceIds: z.array(z.string()).optional(),
});

export const PricingCouponSchema = couponSchema
   .pick({
      id: true,
      code: true,
      scope: true,
      priceId: true,
      meterId: true,
      direction: true,
      type: true,
      amount: true,
   })
   .extend({
      id: z.string(),
      priceId: z.string().nullable(),
      meterId: z.string().nullable(),
      conditions: pricingConditionsSchema,
   });

export const InvoiceCouponSchema = couponSchema.pick({
   code: true,
   type: true,
   amount: true,
   duration: true,
   durationMonths: true,
});

export type PricingCoupon = z.infer<typeof PricingCouponSchema>;
export type InvoiceCoupon = z.infer<typeof InvoiceCouponSchema>;

export type ModifierApplied = {
   couponId: string;
   code: string;
   direction: "discount" | "surcharge";
   amount: string;
   appliedTo: "line" | "bucket";
   dayOfWeek?: number;
};

const ZERO = zero("BRL");

export type CouponIndex = {
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

export function buildCouponIndex(coupons: PricingCoupon[]): CouponIndex {
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

export function lookupApplicable(
   idx: CouponIndex,
   priceId: string,
   meterId: string | null,
): PricingCoupon[] {
   const fromPrice = idx.byPrice.get(priceId);
   const fromMeter = meterId === null ? undefined : idx.byMeter.get(meterId);
   if (fromPrice === undefined && fromMeter === undefined) return idx.team;
   const out: PricingCoupon[] = idx.team.slice();
   if (fromPrice !== undefined) out.push(...fromPrice);
   if (fromMeter !== undefined) out.push(...fromMeter);
   return out;
}

export function dayMatches(c: PricingCoupon, dow: number): boolean {
   const days = c.conditions.dayOfWeek;
   if (!days?.length) return true;
   return days.includes(dow);
}

export function isLineLevel(c: PricingCoupon): boolean {
   return !c.conditions.dayOfWeek?.length;
}

export function percentOf(base: Money, percentStr: string): Money {
   return divide(multiply(base, percentStr), "100");
}

function computeDelta(c: PricingCoupon, base: Money, quantity: number): Money {
   if (c.type === "percent") return percentOf(base, c.amount);
   return multiply(of(c.amount, "BRL"), quantity);
}

export function applyModifier(
   base: Money,
   c: PricingCoupon,
   quantity: number,
): Money {
   const delta = computeDelta(c, base, quantity);
   if (c.direction === "surcharge") return add(base, delta);
   return subtract(base, delta);
}

export function clampPositive(m: Money): Money {
   if (greaterThan(m, ZERO)) return m;
   return ZERO;
}

export function toModifier(
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

export type Pipe = { value: Money; chunks: ModifierApplied[][] };
export type Step = (p: Pipe) => Pipe;

export function startPipe(value: Money): Pipe {
   return { value, chunks: [] };
}

export function pipe(init: Pipe, ...steps: Step[]): Pipe {
   return steps.reduce((p, step) => step(p), init);
}

function identity(p: Pipe): Pipe {
   return p;
}

export function stepCap(cap: string | null): Step {
   if (cap === null) return identity;
   const capped = of(cap, "BRL");
   return (p) => {
      if (greaterThan(p.value, capped))
         return { value: capped, chunks: p.chunks };
      return p;
   };
}

export function stepLineSurcharges(
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

export function stepLineDiscounts(
   discounts: PricingCoupon[],
   quantity: number,
): Step {
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

export type DayBucket = { value: Money; modifiers: ModifierApplied[] };

export function bucketWithSurcharges(
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

export function flattenChunks(chunks: ModifierApplied[][]): ModifierApplied[] {
   return chunks.flat();
}
