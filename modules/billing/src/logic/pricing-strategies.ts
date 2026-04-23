import { of, multiply, add, lessThan } from "@f-o-t/money";
import type { ServicePrice } from "@core/database/schemas/services";

export function calculateFlat(price: ServicePrice) {
   return of(price.basePrice, "BRL");
}

export function calculatePerUnit(price: ServicePrice, usage: number) {
   return multiply(of(price.basePrice, "BRL"), usage);
}

export function calculateMetered(price: ServicePrice, usage: number) {
   const amount = multiply(of(price.basePrice, "BRL"), usage);
   if (!price.priceCap) return amount;
   const cap = of(price.priceCap, "BRL");
   return lessThan(amount, cap) ? amount : cap;
}

export function calculateLineItem(price: ServicePrice, usage: number) {
   if (price.type === "flat") return calculateFlat(price);
   if (price.type === "per_unit") return calculatePerUnit(price, usage);
   return calculateMetered(price, usage);
}

export function sumLineItems(amounts: ReturnType<typeof of>[]) {
   return amounts.reduce((acc, amount) => add(acc, amount), of("0", "BRL"));
}
