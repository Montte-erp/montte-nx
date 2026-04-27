import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { ContractRouterClient } from "@orpc/contract";
import { billingContract } from "./contract";

const DEFAULT_BASE_URL = "https://app.montte.co";

export interface HyprPayClientConfig {
   apiKey: string;
   baseUrl?: string;
}

export type HyprPayClient = ContractRouterClient<typeof billingContract>;

export function createHyprPayClient(
   config: HyprPayClientConfig,
): HyprPayClient {
   const link = new RPCLink({
      url: `${config.baseUrl ?? DEFAULT_BASE_URL}/api/rpc`,
      headers: { "x-api-key": config.apiKey },
   });
   return createORPCClient(link);
}
