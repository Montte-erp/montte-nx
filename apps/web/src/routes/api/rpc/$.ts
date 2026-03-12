import "@/polyfill";
import "@/integrations/otel/init";

import { RPCHandler } from "@orpc/server/fetch";
import { BatchHandlerPlugin } from "@orpc/server/plugins";
import { FetchLoggingPlugin } from "@core/logging/orpc-plugin";
import { createFileRoute } from "@tanstack/react-router";
import pino from "pino";
import router from "@/integrations/orpc/router";
import type { ORPCContextWithAuth } from "@/integrations/orpc/server";
import { auth } from "@core/authentication/server";
import { db } from "@core/database/client";
import { posthog } from "@core/posthog/server";
import { stripeClient } from "@core/stripe";

const logger = pino({ name: "montte-web-rpc" });

const handler = new RPCHandler(router, {
   plugins: [
      new BatchHandlerPlugin(),
      new FetchLoggingPlugin<ORPCContextWithAuth>({
         logger,
         generateId: () => crypto.randomUUID(),
         logRequestResponse: true,
         logRequestAbort: true,
      }),
   ],
});

async function handle({ request }: { request: Request }) {
   // Fetch session per-request (cannot be cached)
   let session: Awaited<ReturnType<typeof auth.api.getSession>> | null = null;
   try {
      session = await auth.api.getSession({ headers: request.headers });
   } catch {
      // Session fetch failed, continue without session
      session = null;
   }

   // Create fully-formed context with all dependencies
   const context: ORPCContextWithAuth = {
      headers: request.headers,
      request,
      auth,
      db,
      session,
      posthog,
      stripeClient,
   };

   const { response } = await handler.handle(request, {
      prefix: "/api/rpc",
      context,
   });

   return response ?? new Response("Not Found", { status: 404 });
}

export const Route = createFileRoute("/api/rpc/$")({
   server: {
      handlers: {
         HEAD: handle,
         GET: handle,
         POST: handle,
         PUT: handle,
         PATCH: handle,
         DELETE: handle,
      },
   },
});
