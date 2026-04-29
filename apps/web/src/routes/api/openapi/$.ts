import "@/polyfill";

import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { BatchHandlerPlugin } from "@orpc/server/plugins";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { env } from "@core/environment/web";
import { FetchLoggingPlugin } from "@core/logging/orpc-plugin";
import { createFileRoute } from "@tanstack/react-router";
import pino from "pino";
import router from "@/integrations/orpc/router";
import type { ORPCContext } from "@/integrations/orpc/server";

const logger = pino(
   { name: "montte-web-openapi" },
   pino.destination({ sync: true }),
);

const handler = new OpenAPIHandler(router, {
   plugins: [
      new BatchHandlerPlugin(),
      new FetchLoggingPlugin<ORPCContext>({
         logger,
         generateId: () => crypto.randomUUID(),
         logRequestResponse: true,
         logRequestAbort: true,
      }),
      new OpenAPIReferencePlugin({
         schemaConverters: [new ZodToJsonSchemaConverter()],
         docsProvider: "scalar",
         docsPath: "/docs",
         specPath: "/spec.json",
         specGenerateOptions: {
            info: { title: "Montte API", version: "1.0.0" },
            servers: [{ url: env.APP_URL ?? env.BETTER_AUTH_URL }],
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

async function handle({ request }: { request: Request }) {
   const context: ORPCContext = {
      headers: request.headers,
      request,
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
