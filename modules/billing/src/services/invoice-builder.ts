import { WebAppError } from "@core/logging/errors";
import type { Result } from "neverthrow";
import type { Benefit } from "@core/database/schemas/benefits";
import type { Coupon } from "@core/database/schemas/coupons";
import type { ServicePrice } from "@core/database/schemas/services";
import type { SubscriptionItem } from "@core/database/schemas/subscription-items";
import {
   computeInvoice,
   type ComputeInvoiceInput,
   type InvoiceComputation,
} from "@modules/billing/services/pricing/engine";
import type { InvoiceCoupon } from "@modules/billing/services/pricing/coupons";
import type {
   PricingBenefit,
   PricingLine,
} from "@modules/billing/services/pricing/lines";

export type UsageRow = { meterId: string; total: string | null };

export type InvoiceSourceData = {
   items: SubscriptionItem[];
   prices: ServicePrice[];
   usageSummary: UsageRow[];
   activeBenefits: Benefit[];
   coupon: Coupon | null;
   redemptionCount: number;
};

function resolveUnitPrice(item: SubscriptionItem, price: ServicePrice): string {
   if (item.negotiatedPrice !== null) return item.negotiatedPrice;
   return price.basePrice;
}

function meteredLine(
   price: ServicePrice & { meterId: string },
   item: SubscriptionItem,
   usageMap: Map<string, string>,
): PricingLine {
   const total = usageMap.get(price.meterId) ?? "0";
   return {
      priceId: price.id,
      priceName: price.name,
      priceType: price.type,
      meterId: price.meterId,
      unitPrice: resolveUnitPrice(item, price),
      priceCap: price.priceCap,
      quantity: 0,
      usageByDayOfWeek: { "0": total },
   };
}

function flatLine(price: ServicePrice, item: SubscriptionItem): PricingLine {
   return {
      priceId: price.id,
      priceName: price.name,
      priceType: price.type,
      meterId: price.meterId,
      unitPrice: resolveUnitPrice(item, price),
      priceCap: price.priceCap,
      quantity: item.quantity,
   };
}

function toLine(
   item: SubscriptionItem,
   priceMap: Map<string, ServicePrice>,
   usageMap: Map<string, string>,
): PricingLine | null {
   const price = priceMap.get(item.priceId);
   if (price === undefined) return null;
   if (!price.isActive) return null;
   if (price.type === "metered" && price.meterId !== null) {
      return meteredLine({ ...price, meterId: price.meterId }, item, usageMap);
   }
   return flatLine(price, item);
}

function toBenefit(b: Benefit): PricingBenefit {
   return {
      type: b.type,
      meterId: b.meterId,
      creditAmount: b.creditAmount,
   };
}

function toInvoiceCoupon(coupon: Coupon | null): InvoiceCoupon | null {
   if (coupon === null) return null;
   return {
      code: coupon.code,
      type: coupon.type,
      amount: coupon.amount,
      duration: coupon.duration,
      durationMonths: coupon.durationMonths,
   };
}

function toEngineInput(data: InvoiceSourceData): ComputeInvoiceInput {
   const priceMap = new Map(data.prices.map((p) => [p.id, p]));
   const usageMap = new Map(
      data.usageSummary.map((u) => [u.meterId, u.total ?? "0"]),
   );

   const lines = data.items
      .map((item) => toLine(item, priceMap, usageMap))
      .filter((l): l is PricingLine => l !== null);

   const benefits = data.activeBenefits
      .filter((b) => b.type === "credits")
      .map(toBenefit);

   return {
      lines,
      benefits,
      lineCoupons: [],
      invoiceCoupon: toInvoiceCoupon(data.coupon),
      redemptionCount: data.redemptionCount,
      context: { activePlanServiceIds: [] },
   };
}

export function buildInvoice(
   data: InvoiceSourceData,
): Result<InvoiceComputation, WebAppError> {
   return computeInvoice(toEngineInput(data));
}
