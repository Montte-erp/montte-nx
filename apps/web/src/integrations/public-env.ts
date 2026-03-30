import { z } from "zod";

const publicEnvSchema = z.object({
   VITE_POSTHOG_HOST: z.string().url(),
   VITE_POSTHOG_KEY: z.string().min(1),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

declare global {
   interface Window {
      __env?: PublicEnv;
   }
}

export function getPublicEnv(): PublicEnv {
   const raw =
      typeof window !== "undefined"
         ? {
              VITE_POSTHOG_HOST: window.__env?.VITE_POSTHOG_HOST,
              VITE_POSTHOG_KEY: window.__env?.VITE_POSTHOG_KEY,
           }
         : {
              VITE_POSTHOG_HOST: process.env["VITE_POSTHOG_HOST"],
              VITE_POSTHOG_KEY: process.env["VITE_POSTHOG_KEY"],
           };

   return publicEnvSchema.parse(raw);
}
