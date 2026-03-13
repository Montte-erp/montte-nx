import Stripe from "stripe";

export function createStripeClient(secretKey: string): Stripe {
   return new Stripe(secretKey, {
      apiVersion: "2026-02-25.clover",
   });
}

export type StripeClient = Stripe;
