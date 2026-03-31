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
      POSTHOG_KEY: z.string(),
      POSTHOG_PUBLIC_KEY: z.string().optional(),
      POSTHOG_PROJECT_ID: z.string(),

      RESEND_API_KEY: z.string(),

      MINIO_ENDPOINT: z.string(),
      MINIO_ACCESS_KEY: z.string().optional(),
      MINIO_SECRET_KEY: z.string().optional(),
      MINIO_BUCKET: z.string().optional().default("montte"),

      OPENROUTER_API_KEY: z.string().optional(),
      TAVILY_API_KEYS: z.string().optional(),
      EXA_API_KEYS: z.string().optional(),
      FIRECRAWL_API_KEYS: z.string().optional(),

      NODE_ENV: z
         .enum(["development", "production", "test"])
         .optional()
         .default("development"),
      APP_URL: z.url().optional(),
      SERVER_URL: z.url().optional(),
      SDK_SERVER_URL: z.url().optional().default("http://localhost:9877"),
      LOG_LEVEL: z
         .enum(["trace", "debug", "info", "warn", "error", "fatal"])
         .optional()
         .default("info"),

      WORKER_CONCURRENCY: z.coerce.number().optional().default(5),

      DISCORD_FEEDBACK_WEBHOOK_URL: z.url().optional(),

      GITHUB_FEEDBACK_TOKEN: z.string().optional(),
      GITHUB_FEEDBACK_OWNER: z.string().optional(),
      GITHUB_FEEDBACK_REPO: z.string().optional(),
   },
   runtimeEnv: process.env,
});

export type WebServerEnv = typeof env;
