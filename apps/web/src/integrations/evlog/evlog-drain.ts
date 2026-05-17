import { env } from "@core/environment/web";
import type { DrainContext } from "evlog";
import { createPostHogDrain } from "evlog/posthog";
import { createDrainPipeline } from "evlog/pipeline";
import { definePlugin } from "nitro";

export default definePlugin((nitroApp) => {
   const posthogDrain = createPostHogDrain({
      apiKey: env.POSTHOG_KEY,
      host: env.POSTHOG_HOST,
      mode: "logs",
   });

   const drain = createDrainPipeline<DrainContext>({
      batch: { size: 50, intervalMs: 5000 },
      retry: { maxAttempts: 3, backoff: "exponential", initialDelayMs: 1000 },
   })(async (batch) => {
      await posthogDrain(batch);
   });

   nitroApp.hooks.hook("evlog:drain", drain);
   nitroApp.hooks.hook("close", () => drain.flush());
});
