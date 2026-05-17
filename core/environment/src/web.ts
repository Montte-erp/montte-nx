import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
   server: {
      DATABASE_URL: z.url(),
      REDIS_URL: z.url().optional().default("redis://localhost:6379"),

      BETTER_AUTH_SECRET: z.string().min(32),
      BETTER_AUTH_URL: z.url().optional().default("http://localhost:3000"),
      BETTER_AUTH_TRUSTED_ORIGINS: z.string(),

      POSTHOG_HOST: z.url(),
      POSTHOG_KEY: z.string().min(1),
      POSTHOG_PERSONAL_API_KEY: z.string().min(1),
      LOGO_DEV_TOKEN: z.string().min(1),

      RESEND_API_KEY: z.string(),

      AWS_ENDPOINT_URL: z.string().min(1),
      AWS_S3_BUCKET_NAME: z.string().min(1).default("montte"),
      AWS_DEFAULT_REGION: z.string().min(1).default("us-east-1"),
      AWS_ACCESS_KEY_ID: z.string().min(1),
      AWS_SECRET_ACCESS_KEY: z.string().min(1),

      OPENROUTER_API_KEY: z.string().optional(),

      NODE_ENV: z
         .enum(["development", "production", "test"])
         .optional()
         .default("development"),
      LOG_LEVEL: z
         .enum(["debug", "info", "warn", "error"])
         .optional()
         .default("info"),
   },
   runtimeEnv: process.env,
});

export type WebServerEnv = typeof env;
