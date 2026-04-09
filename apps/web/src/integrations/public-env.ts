import { z } from "zod";

const publicEnvSchema = z.object({
   VITE_POSTHOG_HOST: z.string().url(),
   VITE_POSTHOG_KEY: z.string().min(1),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

export function getPublicEnv(): PublicEnv {
   return publicEnvSchema.parse({
      VITE_POSTHOG_HOST: process.env["POSTHOG_HOST"],
      VITE_POSTHOG_KEY: process.env["POSTHOG_KEY"],
   });
}
