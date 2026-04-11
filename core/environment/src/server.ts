import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
   server: {
      DATABASE_URL: z.url(),
      REDIS_URL: z.url().optional().default("redis://localhost:6379"),

      BETTER_AUTH_SECRET: z.string().min(32),
      BETTER_AUTH_URL: z.url().optional().default("http://localhost:3000"),
      BETTER_AUTH_TRUSTED_ORIGINS: z.string(),
      BETTER_AUTH_GOOGLE_CLIENT_ID: z.string(),
      BETTER_AUTH_GOOGLE_CLIENT_SECRET: z.string(),

      STRIPE_SECRET_KEY: z.string(),
      STRIPE_WEBHOOK_SECRET: z.string(),
      STRIPE_BOOST_PRICE_ID: z.string().optional(),
      STRIPE_SCALE_PRICE_ID: z.string().optional(),
      STRIPE_ENTERPRISE_PRICE_ID: z.string().optional(),

      POSTHOG_HOST: z.url(),
      POSTHOG_KEY: z.string().min(1),

      RESEND_API_KEY: z.string(),

      MINIO_ENDPOINT: z.string(),
      MINIO_ACCESS_KEY: z.string().optional(),
      MINIO_SECRET_KEY: z.string().optional(),
      MINIO_BUCKET: z.string().optional().default("montte"),

      LOG_LEVEL: z
         .enum(["trace", "debug", "info", "warn", "error", "fatal"])
         .optional()
         .default("info"),

      SERVER_URL: z.string().url(),
   },
   runtimeEnv: process.env,
});

export type ServerEnv = typeof env;
