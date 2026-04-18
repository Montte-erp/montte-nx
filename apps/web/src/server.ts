import dayjs from "dayjs";
import "@/integrations/otel/init";

import { DBOS } from "@dbos-inc/dbos-sdk";
import handler, { createServerEntry } from "@tanstack/react-start/server-entry";
import { launchDBOS } from "@packages/workflows/setup";
import { db, redis, posthog, stripeClient } from "@/integrations/singletons";
import { env } from "@core/environment/web";

function bootDbos() {
   launchDBOS({
      db,
      redis,
      posthog,
      stripeClient,
      systemDatabaseUrl: env.DATABASE_URL,
      logLevel: env.LOG_LEVEL,
   });
}

if (import.meta.hot) {
   const boot = async () => {
      if (import.meta.hot!.data.shutdown) {
         await import.meta.hot!.data.shutdown;
      }
      await bootDbos();
   };

   import.meta.hot.dispose(async () => {
      import.meta.hot!.data.shutdown = DBOS.shutdown();
      await import.meta.hot!.data.shutdown;
   });

   void boot();
} else {
   void bootDbos();
}

export default createServerEntry({
   fetch(request) {
      const url = new URL(request.url);

      if (url.pathname === "/api/ping") {
         if (request.method === "HEAD") {
            return new Response(null, {
               status: 200,
               headers: { "Content-Type": "application/json" },
            });
         }

         if (request.method === "GET") {
            return Response.json({
               pong: true,
               time: dayjs().toISOString(),
            });
         }
      }

      return handler.fetch(request);
   },
});
