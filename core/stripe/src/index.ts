import { env } from "@core/environment/web/server";
import Stripe from "stripe";

export const stripeClient = new Stripe(env.STRIPE_SECRET_KEY, {
   apiVersion: "2026-02-25.clover",
});

export type StripeClient = Stripe;
