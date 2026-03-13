import { z } from "zod";

const clientSchema = z.object({
   VITE_POSTHOG_HOST: z.string().url(),
   VITE_POSTHOG_KEY: z.string(),
});

export const env = clientSchema.parse(import.meta.env);

export type WebClientEnv = typeof env;
