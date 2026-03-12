import { createAuth } from "@core/authentication/server";
import { createDb } from "@core/database/client";
import { env } from "@core/environment/server";
import { getElysiaPosthogConfig } from "@core/posthog/server";
import { getStripeClient } from "@core/stripe";

export const db = createDb({ databaseUrl: env.DATABASE_URL });
export const auth = createAuth({ db, env });
export const posthog = getElysiaPosthogConfig(env);
export const stripeClient = getStripeClient(env.STRIPE_SECRET_KEY);
