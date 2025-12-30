import { z } from "zod";
import { parseEnv } from "./helpers";

const EnvSchema = z.object({
   ARCJET_ENV: z.enum(["development", "production"]),
   ARCJET_KEY: z.string(),
   LOG_LEVEL: z
      .enum(["trace", "debug", "info", "warn", "error", "fatal"])
      .default("info"),
   LOGTAIL_ENDPOINT: z.url(),
   LOGTAIL_SOURCE_TOKEN: z.string(),
   BETTER_AUTH_GOOGLE_CLIENT_ID: z.string(),
   BETTER_AUTH_GOOGLE_CLIENT_SECRET: z.string(),
   BETTER_AUTH_SECRET: z.string(),
   BETTER_AUTH_TRUSTED_ORIGINS: z.string(),
   DATABASE_URL: z.string(),
   ENCRYPTION_KEY: z
      .string()
      .length(64, "ENCRYPTION_KEY must be a 64-character hex string")
      .regex(/^[0-9a-fA-F]+$/, "ENCRYPTION_KEY must be a valid hex string"),
   SEARCH_KEY: z
      .string()
      .length(64, "SEARCH_KEY must be a 64-character hex string")
      .regex(/^[0-9a-fA-F]+$/, "SEARCH_KEY must be a valid hex string"),
   MINIO_ACCESS_KEY: z.string(),
   MINIO_BUCKET: z.string().default("content-writer"),
   MINIO_ENDPOINT: z.string(),
   MINIO_SECRET_KEY: z.string(),
   POSTHOG_HOST: z.string(),
   POSTHOG_KEY: z.string(),
   REDIS_URL: z.string(),
   RESEND_API_KEY: z.string(),
   STRIPE_BASIC_ANNUAL_PRICE_ID: z.string(),
   STRIPE_BASIC_PRICE_ID: z.string(),
   STRIPE_ERP_ANNUAL_PRICE_ID: z.string(),
   STRIPE_ERP_PRICE_ID: z.string(),
   STRIPE_SECRET_KEY: z.string(),
   STRIPE_SHARED_ANNUAL_PRICE_ID: z.string(),
   STRIPE_SHARED_PRICE_ID: z.string(),
   STRIPE_WEBHOOK_SECRET: z.string(),
   VAPID_PRIVATE_KEY: z.string(),
   VAPID_PUBLIC_KEY: z.string(),
   VAPID_SUBJECT: z.string(),
   WORKER_CONCURRENCY: z.coerce.number().default(5),
});
export type ServerEnv = z.infer<typeof EnvSchema>;
export const serverEnv: ServerEnv = parseEnv(process.env, EnvSchema);
