import { env } from "@core/environment/web";
import { createDb } from "@core/database/client";
import { createRedis } from "@core/redis/connection";
import { createPostHog } from "@core/posthog/server";
import { createStripeClient } from "@core/stripe";
import { createMinioClient } from "@core/files/client";
import { createResendClient } from "@core/transactional/utils";
import { createAuth } from "@core/authentication/server";

export const db = createDb({ databaseUrl: env.DATABASE_URL });
export const redis = createRedis(env.REDIS_URL);
export const posthog = createPostHog(env.POSTHOG_KEY, env.POSTHOG_HOST);
export const stripeClient = createStripeClient(env.STRIPE_SECRET_KEY);
export const minioClient = createMinioClient({
   endpoint: env.MINIO_ENDPOINT,
   accessKey: env.MINIO_ACCESS_KEY,
   secretKey: env.MINIO_SECRET_KEY,
});
export const resendClient = createResendClient(env.RESEND_API_KEY);
export const auth = createAuth({
   db,
   redis,
   posthog,
   stripeClient,
   resendClient,
   env,
});
