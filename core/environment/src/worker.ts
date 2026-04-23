import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
   server: {
      DATABASE_URL: z.url(),
      REDIS_URL: z.url().optional().default("redis://localhost:6379"),

      POSTHOG_HOST: z.url(),
      POSTHOG_KEY: z.string().min(1),
      POSTHOG_PERSONAL_API_KEY: z.string().min(1),

      STRIPE_SECRET_KEY: z.string(),

      RESEND_API_KEY: z.string(),

      OPENROUTER_API_KEY: z.string().optional(),

      LOG_LEVEL: z
         .enum(["trace", "debug", "info", "warn", "error", "fatal"])
         .optional()
         .default("info"),
   },
   runtimeEnv: process.env,
});

export type WorkerEnv = typeof env;
