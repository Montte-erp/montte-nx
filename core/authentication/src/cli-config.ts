import type { betterAuth } from "better-auth";
import { createAuth } from "@core/authentication/server";
import { createDb } from "@core/database/client";
import { createRedis } from "@core/redis/connection";
import { createPostHog } from "@core/posthog/server";
import { createStripeClient } from "@core/stripe";
import { createResendClient } from "@core/transactional/utils";
import { env } from "@core/environment/web/server";

const db = createDb({ databaseUrl: env.DATABASE_URL });
const redis = createRedis(env.REDIS_URL);
const posthog = createPostHog(env.POSTHOG_KEY, env.POSTHOG_HOST);
const stripeClient = createStripeClient(env.STRIPE_SECRET_KEY);
const resendClient = createResendClient(env.RESEND_API_KEY);

const auth = createAuth({
   db,
   redis,
   posthog,
   stripeClient,
   resendClient,
   env,
});

export default auth as unknown as ReturnType<typeof betterAuth>;
