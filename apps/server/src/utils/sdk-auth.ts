import { getLogger } from "@core/logging/root";
import { ResultAsync, err, errAsync, fromPromise, ok } from "neverthrow";
import { auth } from "../singletons";

const logger = getLogger().child({ module: "sdk-auth" });

export interface AuthData {
   organizationId: string;
   teamId: string | undefined;
   userId: string | undefined;
   plan: string;
   sdkMode: "static" | "ssr";
   remaining: number | null;
   apiKeyType: "public" | "private";
}

export type AuthError =
   | { code: "MISSING_KEY" }
   | { code: "RATE_LIMITED" }
   | { code: "INVALID_KEY" }
   | { code: "NO_ORGANIZATION" };

/**
 * Resolves an API key from the request, checking multiple sources:
 * 1. `X-API-Key` header (preferred by SDK clients)
 * 2. `sdk-api-key` header (legacy SDK clients)
 * 3. `apiKey` query parameter (sendBeacon fallback)
 */
export function resolveApiKey(request: Request): string | null {
   const xApiKey = request.headers.get("X-API-Key");
   if (xApiKey) return xApiKey;

   const sdkApiKey = request.headers.get("sdk-api-key");
   if (sdkApiKey) return sdkApiKey;

   const url = new URL(request.url);
   const queryApiKey = url.searchParams.get("apiKey");
   if (queryApiKey) return queryApiKey;

   return null;
}

/**
 * Authenticates the request using the API key.
 * Returns Ok<AuthData> on success or Err<AuthError> on failure.
 */
export function authenticateRequest(
   request: Request,
): ResultAsync<AuthData, AuthError> {
   const endpoint = new URL(request.url).pathname;
   const apiKeyValue = resolveApiKey(request);

   if (!apiKeyValue) {
      logger.error({ reason: "missing_api_key", endpoint }, "SDK auth failed");
      return errAsync<AuthData, AuthError>({ code: "MISSING_KEY" });
   }

   return fromPromise(
      auth.api.verifyApiKey({ body: { key: apiKeyValue } }),
      (): AuthError => ({ code: "INVALID_KEY" }),
   ).andThen((result) => {
      if (!result.valid || !result.key) {
         const isRateLimited = result.error?.code === "RATE_LIMITED";
         const code = isRateLimited ? "RATE_LIMITED" : "INVALID_KEY";
         logger.error(
            {
               reason: code.toLowerCase(),
               endpoint,
               organizationId: result.key?.metadata?.organizationId,
               plan: result.key?.metadata?.plan,
               remaining: result.key?.remaining,
            },
            "SDK auth failed",
         );
         return err({ code } as AuthError);
      }

      const { organizationId, teamId } = result.key.metadata ?? {};

      if (!organizationId || typeof organizationId !== "string") {
         return err<AuthData, AuthError>({ code: "NO_ORGANIZATION" });
      }

      return ok({
         organizationId,
         teamId: typeof teamId === "string" ? teamId : undefined,
         userId: result.key.referenceId ?? undefined,
         plan: (result.key.metadata?.plan as string) ?? "metered",
         sdkMode:
            (result.key.metadata?.sdkMode as "static" | "ssr") ?? "static",
         remaining: result.key.remaining ?? null,
         apiKeyType:
            (result.key.metadata?.apiKeyType as "public" | "private") ??
            "private",
      });
   });
}
