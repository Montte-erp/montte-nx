import { auth } from "@/integrations/singletons";
import { createAuthIdentifier } from "evlog/better-auth";
import { definePlugin } from "nitro";
import { isRequestLogger } from "./request-logger";

export default definePlugin((nitroApp) => {
   const identify = createAuthIdentifier(auth, {
      maskEmail: true,
      exclude: ["/api/auth/**", "/api/_evlog/**"],
      extend: (session) => ({
         organizationId: session.session.activeOrganizationId,
         teamId: session.session.activeTeamId,
      }),
   });

   nitroApp.hooks.hook("request", async (event) => {
      const log = event.req.context?.log;
      if (!isRequestLogger(log)) return;

      await identify({
         path: new URL(event.req.url, "http://localhost").pathname,
         headers: event.req.headers,
         context: { log },
      });
   });
});
