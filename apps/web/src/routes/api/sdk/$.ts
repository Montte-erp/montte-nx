import "@/polyfill";

import { RPCHandler } from "@orpc/server/fetch";
import { BatchHandlerPlugin } from "@orpc/server/plugins";
import { FetchLoggingPlugin } from "@core/logging";
import { createFileRoute } from "@tanstack/react-router";
import pino from "pino";
import { db, posthog } from "@/integrations/singletons";
import sdkRouter from "@/integrations/orpc/sdk/router";

const logger = pino({ name: "montte-web-sdk" });

const handler = new RPCHandler(sdkRouter, {
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

async function handle({ request }: { request: Request }) {
   const { response } = await handler.handle(request, {
      prefix: "/api/sdk",
      context: { db, posthog, request },
   });
   return response ?? new Response("Not Found", { status: 404 });
}

export const Route = createFileRoute("/api/sdk/$")({
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
