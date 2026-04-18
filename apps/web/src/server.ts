import dayjs from "dayjs";
import "@/integrations/otel/init";

import handler, { createServerEntry } from "@tanstack/react-start/server-entry";
import { env } from "@core/environment/web";
import { initLogger } from "@core/logging/root";

initLogger({ name: "montte", level: env.LOG_LEVEL });

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
