import "@/polyfill";
import "@/integrations/otel/init";

import { SmartCoercionPlugin } from "@orpc/json-schema";
import { onError } from "@orpc/server";
import { CompressionPlugin, RPCHandler } from "@orpc/server/fetch";
import { BatchHandlerPlugin } from "@orpc/server/plugins";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { FetchLoggingPlugin } from "@core/logging/orpc-plugin";
import { getLogger } from "@core/logging/root";
import { createFileRoute } from "@tanstack/react-router";

import router from "@/integrations/orpc/router";
import type {
   ORPCContext,
   ORPCContextWithAuth,
} from "@/integrations/orpc/server";

const logger = getLogger().child({ module: "api:rpc" });

const handler = new RPCHandler(router, {
   interceptors: [
      onError((error) => {
         logger.error({ err: error }, "oRPC handler error");
      }),
   ],
   plugins: [
      new CompressionPlugin(),

      new BatchHandlerPlugin(),
      new SmartCoercionPlugin({
         schemaConverters: [new ZodToJsonSchemaConverter()],
      }),
      new FetchLoggingPlugin<ORPCContextWithAuth>({
         logger,
         generateId: () => crypto.randomUUID(),
         logRequestResponse: true,
         logRequestAbort: true,
      }),
   ],
});

async function handle({ request }: { request: Request }) {
   const headers = new Headers(request.headers);

   const { response } = await handler.handle(request, {
      prefix: "/api",
      context: {
         headers,
         request,
      } satisfies ORPCContext,
   });

   return response ?? new Response("Not Found", { status: 404 });
}

export const Route = createFileRoute("/api/$")({
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
