import { env } from "@core/environment/web";
import { createDb } from "@core/database/client";
import { createRedis } from "@core/redis/connection";
import { createPostHog, createPromptsClient } from "@core/posthog/server";
import { createStripeClient } from "@core/stripe";
import { createMinioClient } from "@core/files/client";
import { createResendClient } from "@core/transactional/utils";
import { createAuth } from "@core/authentication/server";
import { createHyprpay } from "@core/hyprpay/client";
import { DBOSClient } from "@dbos-inc/dbos-sdk";

export const workflowClient = DBOSClient.create({
   systemDatabaseUrl: env.DATABASE_URL,
});

export const db = createDb({ databaseUrl: env.DATABASE_URL });
export const redis = createRedis(env.REDIS_URL);
export const posthog = createPostHog(env.POSTHOG_KEY, env.POSTHOG_HOST);
export const posthogPrompts = createPromptsClient({
   personalApiKey: env.POSTHOG_PERSONAL_API_KEY,
   projectApiKey: env.POSTHOG_KEY,
   host: env.POSTHOG_HOST,
});
export const stripeClient = createStripeClient(env.STRIPE_SECRET_KEY);
export const hyprpayClient = createHyprpay(env.HYPRPAY_API_KEY);
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
   resendClient,
   env,
});
