import "@/integrations/otel/init";
import "@/features/ai/backfill-keywords.workflow";

import { DBOS } from "@dbos-inc/dbos-sdk";
import handler, { createServerEntry } from "@tanstack/react-start/server-entry";
import { env } from "@core/environment/server";
import { getLogger } from "@core/logging/root";

const logger = getLogger().child({ module: "web-server" });

DBOS.setConfig({
   name: "montte-web",
   systemDatabaseUrl: env.DATABASE_URL,
   logLevel: env.LOG_LEVEL ?? "info",
});

DBOS.launch()
   .then(() => {
      logger.info("DBOS runtime started");
   })
   .catch((err) => {
      logger.error({ err }, "DBOS launch failed");
   });

const shutdown = async () => {
   await DBOS.shutdown();
};
process.on("SIGTERM", () => void shutdown());
process.on("SIGINT", () => void shutdown());

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
