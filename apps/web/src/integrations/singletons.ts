import { env } from "@core/environment/web";
import { createDb } from "@core/database/client";
import { createRedis } from "@core/redis/connection";
import { createPostHog, createPromptsClient } from "@core/posthog/server";
import { createS3Client } from "@core/files/client";
import { createNotificationsClient } from "@core/notifications/client";
import { createAuth } from "@core/authentication/server";
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
export const s3Client = createS3Client({
   endpointUrl: env.AWS_ENDPOINT_URL,
   accessKeyId: env.AWS_ACCESS_KEY_ID,
   secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
   region: env.AWS_DEFAULT_REGION,
});
export const notificationsClient = createNotificationsClient({
   resendApiKey: env.RESEND_API_KEY,
});
export const auth = createAuth({
   db,
   redis,
   posthog,
   notificationsClient,
   env,
});
