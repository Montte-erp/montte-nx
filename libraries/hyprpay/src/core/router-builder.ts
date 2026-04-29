import { RPCHandler } from "@orpc/server/fetch";
import type { AnyRouter } from "@orpc/server";
import type { PluginContext } from "../types";

export type FetchHandler = (req: Request) => Promise<Response>;

export type RoutePrefix = `/${string}`;

export interface BuildHandlerOptions {
   prefix?: RoutePrefix;
   buildContext: (req: Request) => PluginContext | Promise<PluginContext>;
}

export function buildHandler(
   router: Record<string, AnyRouter>,
   opts: BuildHandlerOptions,
): FetchHandler {
   const prefix: RoutePrefix = opts.prefix ?? "/api/hyprpay";
   const handler: RPCHandler<PluginContext> = new RPCHandler(router);

   return async (req) => {
      const context = await opts.buildContext(req);
      const result = await handler.handle(req, { prefix, context });
      if (!result.matched || !result.response) {
         return new Response("Not found", { status: 404 });
      }
      return result.response;
   };
}
