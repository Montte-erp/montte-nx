import { z } from "zod";

const workerSchema = z.object({
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
});

export const env = workerSchema.parse(process.env);

export type WorkerEnv = typeof env;
