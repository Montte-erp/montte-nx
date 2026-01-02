import { z } from "zod";
import { parseEnv } from "./helpers";

const EnvSchema = z.object({
   BETTER_STACK_HEARTBEAT_URL: z.string().url().optional(),
   DATABASE_URL: z.string(),
   ENCRYPTION_KEY: z.string().length(64).optional(),
   LOG_LEVEL: z
      .enum(["trace", "debug", "info", "warn", "error", "fatal"])
      .optional()
      .default("info"),
   LOGTAIL_ENDPOINT: z.string().url().optional(),
   LOGTAIL_SOURCE_TOKEN: z.string().optional(),
   REDIS_URL: z.string().optional().default("redis://localhost:6379"),
   WORKER_CONCURRENCY: z.coerce.number().optional().default(5),
   RESEND_API_KEY: z.string(),
   VAPID_PUBLIC_KEY: z.string(),
   VAPID_PRIVATE_KEY: z.string(),
   VAPID_SUBJECT: z.string().optional().default("mailto:contato@montte.co"),
});
export type WorkerEnv = z.infer<typeof EnvSchema>;
export const workerEnv: WorkerEnv = parseEnv(process.env, EnvSchema);
