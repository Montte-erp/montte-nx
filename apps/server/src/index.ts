import cors from "@elysiajs/cors";
import { RPCHandler } from "@orpc/server/fetch";
import { BatchHandlerPlugin } from "@orpc/server/plugins";
import { env } from "@packages/environment/server";
import {
   startHealthHeartbeat,
   stopHealthHeartbeat,
} from "@packages/logging/health";
import { FetchLoggingPlugin } from "@packages/logging/orpc-plugin";
import { initOtel, shutdownOtel } from "@packages/logging/otel";
import { initLogger } from "@packages/logging/root";
import { shutdownPosthog } from "@packages/posthog/server";
import { Elysia } from "elysia";
import { auth } from "./integrations/auth";
import { db } from "./integrations/database";
import { minioClient } from "./integrations/minio";
import { posthog } from "./integrations/posthog";
import {
   mcpRequestHandler,
   protectedResourceMetadataHandler,
} from "./mcp/handler";
import sdkRouter from "./orpc/router";

// Initialize OTel SDK for PostHog logs
initOtel({
   serviceName: "montte-server",
   posthogKey: env.POSTHOG_KEY,
   posthogHost: env.POSTHOG_HOST,
});
startHealthHeartbeat({ serviceName: "montte-server", posthog });

const logger = initLogger({ name: "montte-server", level: "info" });

// Initialize oRPC handler
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

// oRPC endpoint handler
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
   .all("/mcp", ({ request }) => mcpRequestHandler(request))
   .all("/mcp/*", ({ request }) => mcpRequestHandler(request))
   .get("/.well-known/oauth-protected-resource", ({ request }) =>
      protectedResourceMetadataHandler(request),
   )
   .get("/health", () => ({
      status: "healthy",
      timestamp: new Date().toISOString(),
   }))
   .listen(process.env.PORT ?? 9877);

logger.info({ port: app.server?.port }, "Server started");

// Graceful shutdown
const shutdown = async (signal: string) => {
   logger.info({ signal }, "Received signal, shutting down");
   await shutdownPosthog(posthog);
   stopHealthHeartbeat();
   await shutdownOtel();
   process.exit(0);
};
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

export type App = typeof app;
