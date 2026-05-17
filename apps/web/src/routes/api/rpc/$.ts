import "@/polyfill";

import { RPCHandler } from "@orpc/server/fetch";
import { BatchHandlerPlugin } from "@orpc/server/plugins";
import type { ORPCContext } from "@core/orpc/server";
import { createFileRoute } from "@tanstack/react-router";
import { useRequest } from "nitro/context";
import router from "@/integrations/orpc/router";
import { isRequestLogger } from "@/integrations/evlog/request-logger";

const handler = new RPCHandler(router, {
   plugins: [new BatchHandlerPlugin()],
});

function getRequestLog() {
   try {
      const log = useRequest().context?.log;
      return isRequestLogger(log) ? log : undefined;
   } catch {
      return undefined;
   }
}

async function handle({ request }: { request: Request }) {
   const context: ORPCContext = {
      headers: request.headers,
      request,
      log: getRequestLog(),
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
