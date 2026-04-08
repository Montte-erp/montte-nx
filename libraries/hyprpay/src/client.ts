import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { ContractRouterClient } from "@orpc/contract";
import { hyprpayContract } from "./contract";
import type { HyprPayCustomerFromContract as HyprPayCustomer } from "./contract";
import type {
   CreateCustomerInput,
   HyprPayListResult,
   ListCustomersInput,
   UpdateCustomerInput,
} from "./types";

const DEFAULT_BASE_URL = "https://api.montte.com.br";

export interface HyprPayClientConfig {
   apiKey: string;
   baseUrl?: string;
}

export function createHyprPayClient(config: HyprPayClientConfig) {
   const { apiKey, baseUrl = DEFAULT_BASE_URL } = config;

   const link = new RPCLink({
      url: `${baseUrl}/sdk/orpc`,
      headers: { "sdk-api-key": apiKey },
   });

   const orpc: ContractRouterClient<typeof hyprpayContract> =
      createORPCClient(link);

   return {
      customers: {
         create(input: CreateCustomerInput): Promise<HyprPayCustomer> {
            return orpc.create(input);
         },
         get(externalId: string): Promise<HyprPayCustomer> {
            return orpc.get({ externalId });
         },
         list(
            input: ListCustomersInput = {},
         ): Promise<HyprPayListResult<HyprPayCustomer>> {
            return orpc.list({
               page: input.page ?? 1,
               limit: input.limit ?? 20,
            });
         },
         update(
            externalId: string,
            data: UpdateCustomerInput,
         ): Promise<HyprPayCustomer> {
            return orpc.update({ externalId, ...data });
         },
      },
   };
}

export type HyprPayClient = ReturnType<typeof createHyprPayClient>;
