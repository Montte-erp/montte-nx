import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { ContractRouterClient } from "@orpc/contract";
import { ResultAsync } from "neverthrow";
import { hyprpayContract } from "./contract";
import type { HyprPayCustomerFromContract as HyprPayCustomer } from "./contract";
import { HyprPayError } from "./errors";
import type {
   AddSubscriptionItemInput,
   CancelSubscriptionInput,
   CheckBenefitInput,
   CreateCustomerInput,
   CreateSubscriptionInput,
   HyprPayListResult,
   IngestUsageInput,
   ListCustomersInput,
   ListUsageInput,
   UpdateCustomerInput,
   UpdateSubscriptionItemInput,
   ValidateCouponInput,
} from "./types";

const DEFAULT_BASE_URL = "https://app.montte.co";

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
      url: `${baseUrl}/api/sdk/hyprpay`,
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

      subscriptions: {
         create(input: CreateSubscriptionInput) {
            return ResultAsync.fromPromise(
               orpc.subscriptions.create(input),
               mapToHyprPayError,
            );
         },
         cancel(input: CancelSubscriptionInput) {
            return ResultAsync.fromPromise(
               orpc.subscriptions.cancel({
                  subscriptionId: input.subscriptionId,
                  cancelAtPeriodEnd: input.cancelAtPeriodEnd ?? false,
               }),
               mapToHyprPayError,
            );
         },
         list(customerId: string) {
            return ResultAsync.fromPromise(
               orpc.subscriptions.list({ customerId }),
               mapToHyprPayError,
            );
         },
         addItem(input: AddSubscriptionItemInput) {
            return ResultAsync.fromPromise(
               orpc.subscriptions.addItem(input),
               mapToHyprPayError,
            );
         },
         updateItem(input: UpdateSubscriptionItemInput) {
            return ResultAsync.fromPromise(
               orpc.subscriptions.updateItem(input),
               mapToHyprPayError,
            );
         },
         removeItem(itemId: string) {
            return ResultAsync.fromPromise(
               orpc.subscriptions.removeItem({ itemId }),
               mapToHyprPayError,
            );
         },
      },

      usage: {
         ingest(input: IngestUsageInput) {
            return ResultAsync.fromPromise(
               orpc.usage.ingest(input),
               mapToHyprPayError,
            );
         },
         list(input: ListUsageInput) {
            return ResultAsync.fromPromise(
               orpc.usage.list(input),
               mapToHyprPayError,
            );
         },
      },

      benefits: {
         check(input: CheckBenefitInput) {
            return ResultAsync.fromPromise(
               orpc.benefits.check(input),
               mapToHyprPayError,
            );
         },
         list(customerId: string) {
            return ResultAsync.fromPromise(
               orpc.benefits.list({ customerId }),
               mapToHyprPayError,
            );
         },
      },

      coupons: {
         validate(input: ValidateCouponInput) {
            return ResultAsync.fromPromise(
               orpc.coupons.validate(input),
               mapToHyprPayError,
            );
         },
      },

      customerPortal: {
         createSession(customerId: string) {
            return ResultAsync.fromPromise(
               orpc.customerPortal.createSession({ customerId }),
               mapToHyprPayError,
            );
         },
      },
   };
}

export type HyprPayClient = ReturnType<typeof createHyprPayClient>;
