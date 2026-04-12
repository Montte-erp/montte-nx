import "@/integrations/otel/init";
import "@/integrations/dbos/workflows";

import { DBOS } from "@dbos-inc/dbos-sdk";
import handler, { createServerEntry } from "@tanstack/react-start/server-entry";
import { launchDBOS } from "@/integrations/dbos/init";

if (import.meta.hot) {
   const boot = async () => {
      if (import.meta.hot!.data.shutdown) {
         await import.meta.hot!.data.shutdown;
      }
      launchDBOS();
   };

   import.meta.hot.dispose(async () => {
      import.meta.hot!.data.shutdown = DBOS.shutdown();
      await import.meta.hot!.data.shutdown;
   });

   void boot();
} else {
   launchDBOS();
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
               time: new Date().toISOString(),
            });
         }
      }

      return handler.fetch(request);
   },
});
