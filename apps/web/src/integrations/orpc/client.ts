import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { BatchLinkPlugin } from "@orpc/client/plugins";
import type {
   InferRouterInputs,
   InferRouterOutputs,
   RouterClient,
} from "@orpc/server";
import { createRouterClient } from "@orpc/server";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import posthogJs from "posthog-js";
import router from "./router";
import type { ORPCContext } from "./server";

const getORPCClient = createIsomorphicFn()
   .server(() =>
      createRouterClient(router, {
         context: async (): Promise<ORPCContext> => ({
            headers: getRequestHeaders(),
            request: new Request("http://localhost"),
         }),
      }),
   )
   .client((): RouterClient<typeof router> => {
      const link = new RPCLink({
         url: `${window.location.origin}/api/rpc`,
         headers: () => {
            const posthogSessionId = posthogJs?.get_session_id?.();
            return {
               ...(posthogSessionId
                  ? { "X-PostHog-Session-Id": posthogSessionId }
                  : {}),
            };
         },
         plugins: [
            new BatchLinkPlugin({
               groups: [
                  {
                     condition: (options) =>
                        !(
                           options.path[0] === "notifications" &&
                           options.path[1] === "subscribe"
                        ),
                     context: {},
                  },
               ],
            }),
         ],
         fetch: (input, init) =>
            fetch(input, {
               ...init,
               credentials: "include",
            }),
      });
      return createORPCClient(link);
   });

export const client: RouterClient<typeof router> = getORPCClient();

export const orpc = createTanstackQueryUtils(client);
export type Inputs = InferRouterInputs<typeof router>;
export type Outputs = InferRouterOutputs<typeof router>;
