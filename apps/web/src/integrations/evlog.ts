import { auth } from "@/integrations/singletons";
import { env } from "@core/environment/web";
import type { DrainContext, RequestLogger } from "evlog";
import { createAuthIdentifier } from "evlog/better-auth";
import { createPostHogDrain } from "evlog/posthog";
import { createDrainPipeline } from "evlog/pipeline";
import { definePlugin } from "nitro";
import { useRequest } from "nitro/context";

export function getRequestLog(): RequestLogger {
   return useRequest().context!.log as RequestLogger;
}

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

   const identify = createAuthIdentifier(auth, {
      maskEmail: true,
      exclude: ["/api/auth/**", "/api/_evlog/**"],
      extend: (session) => ({
         organizationId: session.session.activeOrganizationId,
         teamId: session.session.activeTeamId,
      }),
   });

   nitroApp.hooks.hook("evlog:drain", drain);
   nitroApp.hooks.hook("close", () => drain.flush());
   nitroApp.hooks.hook("request", async (event) => {
      const log = event.req.context!.log as RequestLogger;

      await identify({
         path: new URL(event.req.url, "http://localhost").pathname,
         headers: event.req.headers,
         context: { log },
      });
   });
});
