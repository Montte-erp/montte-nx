import Stripe from "stripe";

export function createStripeClient(secretKey: string): Stripe {
   return new Stripe(secretKey, {
      apiVersion: "2026-03-25.dahlia",
   });
}

export type StripeClient = Stripe;
