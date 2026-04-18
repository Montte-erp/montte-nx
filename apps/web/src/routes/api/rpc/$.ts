import "@/polyfill";

import { RPCHandler } from "@orpc/server/fetch";
import { BatchHandlerPlugin } from "@orpc/server/plugins";
import { FetchLoggingPlugin } from "@core/logging";
import { createFileRoute } from "@tanstack/react-router";
import pino from "pino";
import router from "@/integrations/orpc/router";
import type { ORPCContext } from "@/integrations/orpc/server";

const logger = pino({ name: "montte-web-rpc" });

const handler = new RPCHandler(router, {
   plugins: [
      new BatchHandlerPlugin(),
      new FetchLoggingPlugin<ORPCContext>({
         logger,
         generateId: () => crypto.randomUUID(),
         logRequestResponse: true,
         logRequestAbort: true,
      }),
   ],
});

async function handle({ request }: { request: Request }) {
   const context: ORPCContext = {
      headers: request.headers,
      request,
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
