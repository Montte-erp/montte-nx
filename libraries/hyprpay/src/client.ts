import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { ContractRouterClient } from "@orpc/contract";
import { ResultAsync } from "neverthrow";
import { hyprpayContract } from "./contract";
import type { HyprPayCustomerFromContract as HyprPayCustomer } from "./contract";
import { HyprPayError } from "./errors";
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

function mapToHyprPayError(err: unknown): HyprPayError {
   if (err instanceof HyprPayError) return err;
   if (err && typeof err === "object" && "status" in err) {
      const status = Number((err as { status: number }).status);
      const message = err instanceof Error ? err.message : "Unknown error";
      return HyprPayError.fromStatusCode(status, message);
   }
   if (err instanceof Error && err.message.toLowerCase().includes("timeout")) {
      return HyprPayError.timeout(err.message);
   }
   return HyprPayError.network(
      err instanceof Error ? err.message : "Network error",
   );
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
         create(
            input: CreateCustomerInput,
         ): ResultAsync<HyprPayCustomer, HyprPayError> {
            return ResultAsync.fromPromise(
               orpc.create(input),
               mapToHyprPayError,
            );
         },
         get(externalId: string): ResultAsync<HyprPayCustomer, HyprPayError> {
            return ResultAsync.fromPromise(
               orpc.get({ externalId }),
               mapToHyprPayError,
            );
         },
         list(
            input: ListCustomersInput = {},
         ): ResultAsync<HyprPayListResult<HyprPayCustomer>, HyprPayError> {
            return ResultAsync.fromPromise(
               orpc.list({ page: input.page ?? 1, limit: input.limit ?? 20 }),
               mapToHyprPayError,
            );
         },
         update(
            externalId: string,
            data: UpdateCustomerInput,
         ): ResultAsync<HyprPayCustomer, HyprPayError> {
            return ResultAsync.fromPromise(
               orpc.update({ externalId, ...data }),
               mapToHyprPayError,
            );
         },
      },
   };
}

export type HyprPayClient = ReturnType<typeof createHyprPayClient>;
