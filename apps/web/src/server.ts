import "@/integrations/otel/init";
import "@/integrations/dbos/workflows";

import handler, { createServerEntry } from "@tanstack/react-start/server-entry";
import { launchDBOS } from "@/integrations/dbos/init";

launchDBOS();

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
