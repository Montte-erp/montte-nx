import { z } from "zod";

const publicEnvSchema = z.object({
   VITE_POSTHOG_HOST: z.string().url(),
   VITE_POSTHOG_KEY: z.string().min(1),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

export function getPublicEnv(): PublicEnv {
   const raw =
      typeof window !== "undefined"
         ? {
              VITE_POSTHOG_HOST: import.meta.env["VITE_POSTHOG_HOST"],
              VITE_POSTHOG_KEY: import.meta.env["VITE_POSTHOG_KEY"],
           }
         : {
              VITE_POSTHOG_HOST: process.env["POSTHOG_HOST"],
              VITE_POSTHOG_KEY: process.env["POSTHOG_KEY"],
           };

   return publicEnvSchema.parse(raw);
}
