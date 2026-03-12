import type { ContractRouterClient } from "@orpc/contract";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { contract } from "./contract";

const DEFAULT_HOST = "https://api.montte.com";

export function createClient(
   apiKey: string,
   host?: string,
): ContractRouterClient<typeof contract> {
   const link = new RPCLink({
      url: `${(host ?? DEFAULT_HOST).replace(/\/+$/, "")}/sdk/orpc`,
      headers: { "X-API-Key": apiKey },
   });
   return createORPCClient(link);
}
