import "@/polyfill";

import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { BatchHandlerPlugin } from "@orpc/server/plugins";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { env } from "@core/environment/web";
import type { ORPCContext } from "@core/orpc/server";
import { createFileRoute } from "@tanstack/react-router";
import { useRequest } from "nitro/context";
import router from "@/integrations/orpc/router";
import { isRequestLogger } from "@/integrations/evlog/request-logger";

const handler = new OpenAPIHandler(router, {
   plugins: [
      new BatchHandlerPlugin(),
      new OpenAPIReferencePlugin({
         schemaConverters: [new ZodToJsonSchemaConverter()],
         docsProvider: "scalar",
         docsPath: "/docs",
         specPath: "/spec.json",
         specGenerateOptions: {
            info: { title: "Montte API", version: "1.0.0" },
            servers: [{ url: env.BETTER_AUTH_URL }],
            components: {
               securitySchemes: {
                  apiKey: { type: "apiKey", in: "header", name: "x-api-key" },
                  cookie: {
                     type: "apiKey",
                     in: "cookie",
                     name: "better-auth.session_token",
                  },
               },
            },
         },
      }),
   ],
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
      prefix: "/api/openapi",
      context,
   });

   return response ?? new Response("Not Found", { status: 404 });
}

export const Route = createFileRoute("/api/openapi/$")({
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
