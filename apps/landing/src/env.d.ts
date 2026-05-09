import type { PostHog } from "posthog-js";

interface ImportMetaEnv {
   readonly PUBLIC_POSTHOG_KEY: string;
   readonly PUBLIC_POSTHOG_HOST: string;
}

interface ImportMeta {
   readonly env: ImportMetaEnv;
}

declare global {
   interface Window {
      posthog?: PostHog;
   }
}

export {};
