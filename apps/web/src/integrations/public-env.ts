import { z } from "zod";

const publicEnvSchema = z.object({
   POSTHOG_HOST: z.string().url(),
   POSTHOG_KEY: z.string().min(1),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

export function getPublicEnv(): PublicEnv {
   return publicEnvSchema.parse({
      POSTHOG_HOST: process.env["POSTHOG_HOST"],
      POSTHOG_KEY: process.env["POSTHOG_KEY"],
   });
}
