import { HyprPayError } from "./errors";
import type {
   CreateCustomerInput,
   HyprPayCustomer,
   HyprPayListResult,
   ListCustomersInput,
   UpdateCustomerInput,
} from "./types";

const DEFAULT_BASE_URL = "https://api.montte.com.br";
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_RETRIES = 2;

export interface HyprPayClientConfig {
   apiKey: string;
   baseUrl?: string;
   timeoutMs?: number;
   retries?: number;
}

async function callProcedure<T>(
   apiKey: string,
   baseUrl: string,
   path: string,
   input: unknown,
   timeoutMs: number,
   retries: number,
): Promise<T> {
   const url = `${baseUrl}/sdk/orpc/${path}`;
   let lastError: Error = HyprPayError.network("No attempts made");

   for (let attempt = 0; attempt <= retries; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
         const response = await fetch(url, {
            method: "POST",
            headers: {
               "Content-Type": "application/json",
               "sdk-api-key": apiKey,
            },
            body: JSON.stringify(input),
            signal: controller.signal,
         });
         clearTimeout(timer);

         const body = await response.json().catch(() => ({}));

         if (!response.ok) {
            const message =
               (body as { message?: string }).message ?? response.statusText;
            throw HyprPayError.fromStatusCode(response.status, message);
         }

         return (body as { data: T }).data ?? (body as T);
      } catch (err) {
         clearTimeout(timer);
         if (err instanceof HyprPayError) {
            if (err.statusCode >= 400 && err.statusCode < 500) throw err;
            lastError = err;
         } else if (err instanceof DOMException && err.name === "AbortError") {
            lastError = HyprPayError.timeout(
               `Request timed out after ${timeoutMs}ms`,
            );
         } else {
            lastError = HyprPayError.network(
               err instanceof Error ? err.message : "Network error",
            );
         }
      }
   }

   throw lastError;
}

export function createHyprPayClient(config: HyprPayClientConfig) {
   const {
      apiKey,
      baseUrl = DEFAULT_BASE_URL,
      timeoutMs = DEFAULT_TIMEOUT_MS,
      retries = DEFAULT_RETRIES,
   } = config;

   function call<T>(path: string, input: unknown): Promise<T> {
      return callProcedure<T>(apiKey, baseUrl, path, input, timeoutMs, retries);
   }

   return {
      customers: {
         create(input: CreateCustomerInput): Promise<HyprPayCustomer> {
            return call<HyprPayCustomer>("hyprpay.create", input);
         },
         get(externalId: string): Promise<HyprPayCustomer> {
            return call<HyprPayCustomer>("hyprpay.get", { externalId });
         },
         list(
            input: ListCustomersInput = {},
         ): Promise<HyprPayListResult<HyprPayCustomer>> {
            return call<HyprPayListResult<HyprPayCustomer>>(
               "hyprpay.list",
               input,
            );
         },
         update(
            externalId: string,
            data: UpdateCustomerInput,
         ): Promise<HyprPayCustomer> {
            return call<HyprPayCustomer>("hyprpay.update", {
               externalId,
               ...data,
            });
         },
      },
   };
}

export type HyprPayClient = ReturnType<typeof createHyprPayClient>;
