import { DBOS } from "@dbos-inc/dbos-sdk";
import cors from "@elysiajs/cors";
import { RPCHandler } from "@orpc/server/fetch";
import { BatchHandlerPlugin } from "@orpc/server/plugins";
import { env } from "@core/environment/server";
import {
   startHealthHeartbeat,
   stopHealthHeartbeat,
} from "@core/logging/health";
import { FetchLoggingPlugin } from "@core/logging/orpc-plugin";
import { initOtel, shutdownOtel } from "@core/logging/otel";
import { initLogger } from "@core/logging/root";
import { shutdownPosthog } from "@core/posthog/server";
import { Elysia } from "elysia";
import { auth, db, minioClient, posthog } from "./singletons";
import sdkRouter from "./orpc/router";

import "./workflows/refresh-insights";
import "./workflows/bill-occurrences";
import "./workflows/budget-alerts";

DBOS.setConfig({
   name: "montte-server",
   systemDatabaseUrl: env.DATABASE_URL,
});

initOtel({
   serviceName: "montte-server",
   posthogKey: env.POSTHOG_KEY,
   posthogHost: env.POSTHOG_HOST,
});
startHealthHeartbeat({ serviceName: "montte-server", posthog });

const logger = initLogger({ name: "montte-server", level: "info" });

const orpcHandler = new RPCHandler(sdkRouter, {
   plugins: [
      new BatchHandlerPlugin(),
      new FetchLoggingPlugin({
         logger,
         generateId: () => crypto.randomUUID(),
         logRequestResponse: true,
         logRequestAbort: true,
      }),
   ],
});

async function handleOrpcRequest({ request }: { request: Request }) {
   const context = {
      db,
      posthog,
      request,
   };

   const { response } = await orpcHandler.handle(request, {
      prefix: "/sdk/orpc",
      context,
   });

   return response ?? new Response("Not Found", { status: 404 });
}

async function main() {
   await DBOS.launch();
   logger.info("DBOS runtime started");

   const app = new Elysia({
      serve: {
         idleTimeout: 0,
      },
   })
      .derive(() => ({
         auth,
         db,
         minioBucket: env.MINIO_BUCKET,
         minioClient,
         posthog,
      }))
      .use(
         cors({
            allowedHeaders: [
               "Content-Type",
               "sdk-api-key",
               "X-API-Key",
               "X-Locale",
               "Authorization",
            ],
            credentials: true,
            methods: ["GET", "POST", "DELETE", "OPTIONS"],
            origin: true,
         }),
      )
      .post("/sdk/orpc", handleOrpcRequest)
      .get("/health", () => ({
         status: "healthy",
         timestamp: new Date().toISOString(),
      }))
      .listen(process.env.PORT ?? 9877);

   logger.info({ port: app.server?.port }, "Server started");

   const shutdown = async (signal: string) => {
      logger.info({ signal }, "Received signal, shutting down");
      await DBOS.shutdown();
      await shutdownPosthog(posthog);
      stopHealthHeartbeat();
      await shutdownOtel();
      process.exit(0);
   };

   process.on("SIGTERM", () => shutdown("SIGTERM"));
   process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((err) => {
   console.error("Fatal error", err);
   process.exit(1);
});

export type App = Elysia;
