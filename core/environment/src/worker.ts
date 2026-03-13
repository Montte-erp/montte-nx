import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
   server: {
      DATABASE_URL: z.string().url(),
      REDIS_URL: z.string().url().optional().default("redis://localhost:6379"),

      RESEND_API_KEY: z.string().optional(),

      APP_URL: z.string().url().optional().default("https://app.montte.co"),
      LOG_LEVEL: z
         .enum(["trace", "debug", "info", "warn", "error", "fatal"])
         .optional()
         .default("info"),
      POSTHOG_HOST: z.string().url(),
      POSTHOG_KEY: z.string(),
   },
   runtimeEnv: process.env,
});

export type WorkerEnv = typeof env;
